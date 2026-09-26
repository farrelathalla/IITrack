import { z } from "zod";
import { canGlobally } from "@/lib/auth/access";
import { hashPassword } from "@/lib/auth/password";
import { activeRole } from "@/lib/auth/period";
import { ROLE_DIVISION, ROLE_LABELS, ROLE_ORDER } from "@/lib/auth/roles";
import type { Actor, Division, RoleName } from "@/lib/auth/types";
import { recordActivity, type Tx } from "@/server/activity";
import { ACTOR_SELECT, toActor, viewerOf } from "@/server/auth/actor";
import { revokeAllSessionsFor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { notify, notifyRoles } from "@/server/notify";
import { ActionError, parseInput } from "@/server/project/mutate";

function requireSuperAdmin(actor: Actor, now: Date) {
  const decision = canGlobally(viewerOf(actor, now), "users.manage");
  if (!decision.allowed) throw new ActionError(decision.reason);
}

// ─── Daftar pengguna ──────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: RoleName | null;
  /** Jabatan terakhir yang pernah dipegang, untuk akun yang sudah nonaktif. */
  lastRole: RoleName | null;
  division: Division | null;
  period: string | null;
  periodId: string | null;
  active: boolean;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export async function listUsers(now: Date = new Date()): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    select: {
      ...ACTOR_SELECT,
      email: true,
      revokedAt: true,
      revokeReason: true,
      roleAssignments: {
        orderBy: { createdAt: "desc" },
        select: {
          role: true,
          endedAt: true,
          periodId: true,
          period: { select: { name: true, startDate: true, endDate: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((user) => {
    const role = activeRole(toActor(user), now);
    const latest = user.roleAssignments[0];
    const current =
      user.roleAssignments.find((a) => a.role === role && !a.endedAt) ?? latest;
    const shown = (role ?? latest?.role ?? null) as RoleName | null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      lastRole: (latest?.role as RoleName | undefined) ?? null,
      division: shown ? ROLE_DIVISION[shown] : null,
      period: current?.period.name ?? null,
      periodId: current?.periodId ?? null,
      active: role !== null,
      revokedAt: user.revokedAt,
      revokeReason: user.revokeReason,
    };
  });
}

export async function listPeriods() {
  return prisma.period.findMany({ orderBy: { startDate: "desc" } });
}

// ─── Tambah user ──────────────────────────────────────────────────────────

const roleSchema = z.enum(ROLE_ORDER as [RoleName, ...RoleName[]], {
  message: "Pilih jabatan.",
});

const addUserSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi."),
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  role: roleSchema,
  periodId: z.string().min(1, "Pilih periode jabatan."),
  password: z.string().min(8, "Kata sandi awal minimal 8 karakter."),
});

/**
 * Tambah User (PRD bab 2.5). Akun langsung aktif dan bisa login dengan kata
 * sandi awal yang disampaikan Super Admin kepada pemiliknya.
 */
export async function addUser(params: {
  actor: Actor;
  input: z.input<typeof addUserSchema>;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  requireSuperAdmin(params.actor, now);
  const input = parseInput(addUserSchema, params.input);
  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    const period = await tx.period.findUnique({
      where: { id: input.periodId },
    });
    if (!period) throw new ActionError("Periode tidak ditemukan.");
    const existing = await tx.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ActionError(
        "Email ini sudah terdaftar. Gunakan Edit Role untuk mengubah jabatannya.",
        { email: "Email sudah terdaftar." },
      );
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        status: "ACTIVE",
        roleAssignments: {
          create: {
            role: input.role,
            periodId: period.id,
            grantedById: params.actor.userId,
          },
        },
      },
    });

    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "user.added",
      summary: `Menambahkan akun ${user.name} sebagai ${ROLE_LABELS[input.role]} periode ${period.name}`,
      division: "SYSTEM",
      result: "CREATED",
      objectType: "user",
      objectId: user.id,
    });
    await notify(tx, {
      userIds: [user.id],
      message: `Akses IITrack Anda aktif sebagai ${ROLE_LABELS[input.role]} periode ${period.name}.`,
      href: "/settings/profile",
    });
  });
}

// ─── Edit Role ────────────────────────────────────────────────────────────

const editRoleSchema = z.object({
  userId: z.string().min(1),
  role: roleSchema,
  periodId: z.string().min(1, "Pilih periode jabatan."),
});

/**
 * Edit Role (PRD bab 2.5): hak akses lama berakhir dan hak akses baru berlaku
 * seketika. Jabatan lama ditutup, bukan ditimpa, sehingga riwayatnya utuh.
 */
export async function editRole(params: {
  actor: Actor;
  input: z.input<typeof editRoleSchema>;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  requireSuperAdmin(params.actor, now);
  const input = parseInput(editRoleSchema, params.input);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: ACTOR_SELECT,
    });
    if (!user) throw new ActionError("Akun tidak ditemukan.");
    const period = await tx.period.findUnique({
      where: { id: input.periodId },
    });
    if (!period) throw new ActionError("Periode tidak ditemukan.");

    const before = activeRole(toActor(user), now);
    if (before === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN") {
      await assertAnotherSuperAdmin(tx, user.id, now);
    }

    await tx.roleAssignment.updateMany({
      where: { userId: user.id, endedAt: null },
      data: { endedAt: now },
    });
    await tx.roleAssignment.create({
      data: {
        userId: user.id,
        role: input.role,
        periodId: period.id,
        grantedById: params.actor.userId,
      },
    });
    if (user.status !== "ACTIVE") {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          revokedAt: null,
          revokedById: null,
          revokeReason: null,
        },
      });
    }

    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "user.role_changed",
      summary: `Mengubah jabatan ${user.name}${before ? ` dari ${ROLE_LABELS[before]}` : ""} menjadi ${ROLE_LABELS[input.role]} periode ${period.name}`,
      division: "SYSTEM",
      objectType: "user",
      objectId: user.id,
    });
    await notify(tx, {
      userIds: [user.id],
      message: `Akses IITrack Anda aktif sebagai ${ROLE_LABELS[input.role]} periode ${period.name}.`,
      href: "/settings/profile",
    });
    await notifyReassignment(tx, user.id, user.name, now);
  });
}

// ─── Cabut Akses ──────────────────────────────────────────────────────────

const revokeSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(1, "Alasan pencabutan wajib diisi."),
});

/**
 * Cabut Akses (PRD bab 2.5): sesi berakhir seketika, akun tidak bisa login,
 * dan riwayat aktivitasnya tetap tersimpan karena akun tidak pernah dihapus.
 */
export async function revokeAccess(params: {
  actor: Actor;
  input: z.input<typeof revokeSchema>;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  requireSuperAdmin(params.actor, now);
  const input = parseInput(revokeSchema, params.input);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: ACTOR_SELECT,
    });
    if (!user) throw new ActionError("Akun tidak ditemukan.");
    if (user.status === "INACTIVE")
      throw new ActionError("Akses akun ini sudah dicabut.");

    if (activeRole(toActor(user), now) === "SUPER_ADMIN") {
      await assertAnotherSuperAdmin(tx, user.id, now);
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        status: "INACTIVE",
        revokedAt: now,
        revokedById: params.actor.userId,
        revokeReason: input.reason,
      },
    });
    await tx.roleAssignment.updateMany({
      where: { userId: user.id, endedAt: null },
      data: { endedAt: now },
    });
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });

    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "user.revoked",
      summary: `Mencabut akses ${user.name}`,
      division: "SYSTEM",
      result: "REJECTED",
      feedback: input.reason,
      objectType: "user",
      objectId: user.id,
    });
    await notifyReassignment(tx, user.id, user.name, now);
  });

  // Jaring pengaman di luar transaksi: pemeriksaan per permintaan juga menolak
  // sesi akun nonaktif, tetapi pencabutan eksplisit membuatnya seketika.
  await revokeAllSessionsFor(input.userId);
}

/** Super Admin tidak bisa mencabut dirinya bila ia satu-satunya yang aktif. */
async function assertAnotherSuperAdmin(tx: Tx, userId: string, now: Date) {
  const others = await tx.roleAssignment.count({
    where: {
      role: "SUPER_ADMIN",
      userId: { not: userId },
      endedAt: null,
      period: { startDate: { lte: now }, endDate: { gt: now } },
      user: { status: "ACTIVE" },
    },
  });
  if (others === 0) {
    throw new ActionError(
      "Tidak bisa: ini satu-satunya Super Admin aktif. Tambahkan Super Admin lain terlebih dahulu.",
    );
  }
}

/**
 * Memberi tahu C-Level divisi terkait bila orang yang aksesnya berubah masih
 * ditugaskan di project aktif (PRD bab 11).
 */
async function notifyReassignment(
  tx: Tx,
  userId: string,
  name: string,
  now: Date,
) {
  const assignments = await tx.projectAssignment.findMany({
    where: { userId, endedAt: null, project: { closedAt: null } },
    select: { role: true, projectId: true },
  });
  if (assignments.length === 0) return;

  // Setelah perubahan, apakah jabatannya masih cocok dengan perannya?
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: ACTOR_SELECT,
  });
  const role = user ? activeRole(toActor(user), now) : null;

  const leads = {
    PM: { roles: ["COO", "VICE_COO"] as RoleName[], fits: "PROJECT_MANAGER" },
    DEVELOPER: {
      roles: ["CTO", "VICE_CTO"] as RoleName[],
      fits: "TECH_DEVELOPER",
    },
    FINANCE_POC: {
      roles: ["CFO", "VICE_CFO"] as RoleName[],
      fits: "FINANCE_POC",
    },
  } as const;

  for (const [projectRole, lead] of Object.entries(leads)) {
    if (role === lead.fits) continue;
    const count = new Set(
      assignments.filter((a) => a.role === projectRole).map((a) => a.projectId),
    ).size;
    if (count === 0) continue;
    await notifyRoles(tx, lead.roles, {
      message: `${count} project perlu penugasan ulang karena akun ${name} sudah tidak aktif.`,
      href: "/",
    });
  }
}

// ─── Kata sandi dan periode ───────────────────────────────────────────────

export async function resetPassword(params: {
  actor: Actor;
  userId: string;
  password: string;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  requireSuperAdmin(params.actor, now);
  const password = parseInput(
    z.string().min(8, "Kata sandi minimal 8 karakter."),
    params.password,
  );
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: params.userId },
      data: { passwordHash },
      select: { id: true, name: true },
    });
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "user.password_reset",
      summary: `Mengatur ulang kata sandi ${user.name}`,
      division: "SYSTEM",
      objectType: "user",
      objectId: user.id,
    });
  });
}

const periodSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Nama periode berformat 2027/2028."),
    startDate: z.coerce.date({ message: "Tanggal mulai tidak valid." }),
    endDate: z.coerce.date({ message: "Tanggal akhir tidak valid." }),
  })
  .refine((v) => v.endDate > v.startDate, {
    path: ["endDate"],
    message: "Tanggal akhir harus setelah tanggal mulai.",
  });

/** Kode Project ID dari nama periode: "2027/2028" → "2728". */
export function periodCode(name: string): string {
  const [a, b] = name.split("/");
  return `${a.slice(2)}${b.slice(2)}`;
}

export async function createPeriod(params: {
  actor: Actor;
  input: { name: string; startDate: Date | string; endDate: Date | string };
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  requireSuperAdmin(params.actor, now);
  const input = parseInput(periodSchema, params.input);
  const code = periodCode(input.name);

  await prisma.$transaction(async (tx) => {
    const clash = await tx.period.findFirst({
      where: { OR: [{ name: input.name }, { code }] },
    });
    if (clash) throw new ActionError(`Periode ${input.name} sudah ada.`);
    await tx.period.create({
      data: {
        name: input.name,
        code,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "period.created",
      summary: `Membuat periode ${input.name}`,
      division: "SYSTEM",
      result: "CREATED",
    });
  });
}

/** Pengguna aktif pemegang salah satu jabatan, untuk pilihan approver. */
export async function activeUsersByRoles(
  roles: readonly RoleName[],
  now: Date = new Date(),
): Promise<{ id: string; name: string; email: string }[]> {
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roleAssignments: {
        some: {
          role: { in: [...roles] },
          OR: [{ endedAt: null }, { endedAt: { gt: now } }],
          period: { startDate: { lte: now }, endDate: { gt: now } },
        },
      },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
