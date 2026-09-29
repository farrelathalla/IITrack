import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import {
  acceptInvitation,
  issueInvitation,
  readInvitation,
} from "@/server/admin/invitations";
import { saveApprovers } from "@/server/admin/settings";
import { addUser } from "@/server/admin/users";
import { viewerOf } from "@/server/auth/actor";
import { attemptLogin } from "@/server/auth/login";
import { deleteProject, updateProjectDetails } from "@/server/project/details";
import { saveDocument, submitDocument } from "@/server/project/documents";
import { listProjects, searchProjects } from "@/server/project/queries";
import { loadSnapshot } from "@/server/project/snapshot";
import { addBlocker } from "@/server/project/tech";
import { loadProjectView } from "@/server/project/view";
import { createActor, testDb, uniqueEmail } from "../support/database";
import {
  createTeam,
  decidePending,
  newProject,
  type Team,
  throughMouSubmitted,
  throughStage4,
} from "../support/world";

describe("Feedback 29 Sep: tech blocker sejak Stage 4", () => {
  let team: Team;
  beforeAll(async () => {
    team = await createTeam();
  });

  it("developer bisa menambah blocker di Stage 4, sama seperti Update Progress", async () => {
    const code = await newProject(team, "Blocker Stage 4");
    await throughStage4(team, code);
    await addBlocker({
      actor: team.dev,
      projectId: code,
      description: "Akses server staging belum diberikan",
    });
    const project = await loadSnapshot(code);
    expect(project?.blockers.map((b) => b.description)).toEqual([
      "Akses server staging belum diberikan",
    ]);
  });

  it("sebelum Stage 4 terbuka, blocker tetap ditolak dengan alasan", async () => {
    const code = await newProject(team, "Blocker Terlalu Awal");
    await expect(
      addBlocker({ actor: team.cto, projectId: code, description: "x" }),
    ).rejects.toThrow(/terlebih dahulu/);
  });
});

describe("Feedback 29 Sep: edit detail dan hapus project", () => {
  let team: Team;
  beforeAll(async () => {
    team = await createTeam();
  });

  it("PM mengubah detail awal; perubahan dicatat dengan nilai lama dan baru", async () => {
    const code = await newProject(team, "Nama Lama");
    await updateProjectDetails({
      actor: team.pm,
      projectId: code,
      input: {
        name: "Nama Baru",
        client: "PT Client Uji",
        type: "ADVISORY",
        source: "",
        targetStart: "2026-08-01",
        targetEnd: "2027-01-31",
        internalNote: "Diperpanjang",
      },
    });
    const project = await loadSnapshot(code);
    expect(project?.name).toBe("Nama Baru");
    expect(project?.type).toBe("ADVISORY");
    expect(project?.code).toBe(code);
    const log = await testDb.activityLog.findFirstOrThrow({
      where: { project: { code }, action: "project.details_updated" },
    });
    expect(log.summary).toContain("Nama Nama Lama → Nama Baru");

    await expect(
      updateProjectDetails({
        actor: team.otherPm,
        projectId: code,
        input: {
          name: "Coba",
          client: "X",
          targetStart: "2026-08-01",
          targetEnd: "2026-09-01",
        },
      }),
    ).rejects.toThrow(/Hanya PM project atau COO/);
  });

  it("target selesai tidak boleh sebelum target mulai", async () => {
    const code = await newProject(team);
    await expect(
      updateProjectDetails({
        actor: team.coo,
        projectId: code,
        input: {
          name: "X",
          client: "Y",
          targetStart: "2026-10-01",
          targetEnd: "2026-09-01",
        },
      }),
    ).rejects.toThrow("Target selesai harus setelah target mulai.");
  });

  it("COO menghapus project: hilang dari daftar dan pencarian, tidak bisa diubah, riwayat tetap", async () => {
    const code = await newProject(team, "Akan Dihapus");
    await expect(
      deleteProject({ actor: team.pm, projectId: code, reason: "batal" }),
    ).rejects.toThrow("Hanya COO atau Vice COO yang bisa menghapus project.");
    await expect(
      deleteProject({ actor: team.coo, projectId: code, reason: " " }),
    ).rejects.toThrow("Alasan penghapusan wajib diisi.");

    await deleteProject({
      actor: team.coo,
      projectId: code,
      reason: "Client membatalkan",
    });

    expect(await loadSnapshot(code)).toBeNull();
    expect(await loadProjectView(code, viewerOf(team.coo))).toBeNull();
    const listed = await listProjects(viewerOf(team.coo), { closed: false });
    expect(listed.some((item) => item.project.code === code)).toBe(false);
    expect(
      (await searchProjects("Akan Dihapus")).some((p) => p.code === code),
    ).toBe(false);
    await expect(
      saveDocument({
        actor: team.pm,
        projectId: code,
        input: { kind: "REQUIREMENT_GATHERING", url: "https://example.com/x" },
      }),
    ).rejects.toThrow("Project tidak ditemukan.");

    const row = await testDb.project.findUniqueOrThrow({ where: { code } });
    expect(row.deleteReason).toBe("Client membatalkan");
    const log = await testDb.activityLog.findFirst({
      where: { projectId: row.id, action: "project.deleted" },
    });
    expect(log).not.toBeNull();
    const notice = await testDb.notification.findFirst({
      where: { userId: team.pm.userId, message: { contains: "dihapus" } },
    });
    expect(notice?.message).toContain("Client membatalkan");
  });
});

describe("Feedback 29 Sep: approver yang dipilih berlaku di server", () => {
  let team: Team;
  let previous: unknown;
  beforeAll(async () => {
    team = await createTeam();
    previous = (
      await testDb.setting.findUnique({ where: { key: "approvers" } })
    )?.value;
  });
  afterAll(async () => {
    if (previous === undefined) {
      await testDb.setting.deleteMany({ where: { key: "approvers" } });
    } else {
      await testDb.setting.update({
        where: { key: "approvers" },
        data: { value: previous as object },
      });
    }
  });

  it("COO mengatur approver MoU ke Vice COO; COO sendiri lalu ditolak, Vice COO bisa", async () => {
    await expect(
      saveApprovers({
        actor: team.coo,
        approvers: {
          PROGRAMMER_CONTRACT: {
            primaryUserId: team.cto.userId,
            delegateUserId: null,
          },
        },
      }),
    ).rejects.toThrow(/tidak berwenang/);
    await expect(
      saveApprovers({
        actor: team.coo,
        approvers: {
          MOU: { primaryUserId: team.cto.userId, delegateUserId: null },
        },
      }),
    ).rejects.toThrow(/harus pemegang jabatan/);

    await saveApprovers({
      actor: team.coo,
      approvers: {
        MOU: { primaryUserId: team.vcoo.userId, delegateUserId: null },
      },
    });

    const code = await newProject(team, "Approver Terpilih");
    await throughMouSubmitted(team, code);
    const notified = await testDb.notification.findMany({
      where: {
        message: { contains: "MoU Project Approver Terpilih" },
        href: { contains: code },
      },
      select: { userId: true },
    });
    expect(notified.map((n) => n.userId)).toEqual([team.vcoo.userId]);

    await expect(
      decidePending(code, "MOU", team.coo, "APPROVE"),
    ).rejects.toThrow(/diputuskan oleh Vice COO Uji/);
    await decidePending(code, "MOU", team.vcoo, "APPROVE");
    const view = await loadProjectView(code, viewerOf(team.pm));
    expect(view?.approverNames.MOU).toBe("Vice COO Uji (Vice COO)");
  });

  it("approver yang jabatannya sudah berakhir diabaikan, jadi pengajuan tidak tersangkut", async () => {
    const ghost = await createActor("COO", team.periodId, "COO Lama");
    await saveApprovers({
      actor: team.admin,
      approvers: {
        PROJECT_CHARTER: { primaryUserId: ghost.userId, delegateUserId: null },
      },
    });
    await testDb.roleAssignment.updateMany({
      where: { userId: ghost.userId },
      data: { endedAt: new Date(Date.now() - 1000) },
    });
    const code = await newProject(team, "Approver Hilang");
    await saveDocument({
      actor: team.pm,
      projectId: code,
      input: { kind: "REQUIREMENT_GATHERING", url: "https://example.com/r" },
    });
    const { completeStage1 } = await import("@/server/project/documents");
    await completeStage1({ actor: team.pm, projectId: code });
    await saveDocument({
      actor: team.pm,
      projectId: code,
      input: { kind: "PROJECT_CHARTER", url: "https://example.com/c" },
    });
    await submitDocument({
      actor: team.pm,
      projectId: code,
      kind: "PROJECT_CHARTER",
    });
    await decidePending(code, "PROJECT_CHARTER", team.coo, "APPROVE");
  });
});

describe("Feedback 29 Sep: link undangan untuk anggota baru", () => {
  let team: Team;
  beforeAll(async () => {
    team = await createTeam();
  });

  it("Tambah User tanpa kata sandi menghasilkan link; anggota membuat kata sandi lalu bisa masuk", async () => {
    const email = uniqueEmail("baru");
    const token = await addUser({
      actor: team.admin,
      input: {
        name: "Anggota Baru",
        email,
        role: "TECH_DEVELOPER",
        periodId: team.periodId,
      },
    });
    expect(token).toEqual(expect.any(String));
    if (!token) throw new Error("token kosong");

    expect(await readInvitation(token)).toMatchObject({
      status: "valid",
      name: "Anggota Baru",
      hasPassword: false,
    });
    const before = await attemptLogin({ email, password: "rahasia123" });
    expect(before.authenticated).toBe(false);

    await expect(
      acceptInvitation({ token, password: "rahasia123", confirm: "beda" }),
    ).rejects.toThrow("Konfirmasi kata sandi tidak sama.");
    const userId = await acceptInvitation({
      token,
      password: "rahasia123",
      confirm: "rahasia123",
    });
    const user = await testDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBe(email);
    expect(await verifyPassword("rahasia123", user.passwordHash ?? "")).toBe(
      true,
    );
    expect(
      (await attemptLogin({ email, password: "rahasia123" })).authenticated,
    ).toBe(true);

    await expect(
      acceptInvitation({ token, password: "lainlain1", confirm: "lainlain1" }),
    ).rejects.toThrow(/sudah dipakai/);
  });

  it("link baru membatalkan link lama; link kedaluwarsa ditolak; hanya Super Admin yang membuat", async () => {
    const email = uniqueEmail("lupa");
    const first = await addUser({
      actor: team.admin,
      input: {
        name: "Lupa Sandi",
        email,
        role: "PROJECT_MANAGER",
        periodId: team.periodId,
      },
    });
    if (!first) throw new Error("token kosong");
    const user = await testDb.user.findUniqueOrThrow({ where: { email } });

    await expect(
      issueInvitation({ actor: team.coo, userId: user.id }),
    ).rejects.toThrow();
    const second = await issueInvitation({
      actor: team.admin,
      userId: user.id,
    });
    expect(await readInvitation(first)).toMatchObject({
      status: "invalid",
      reason: expect.stringMatching(/diganti/),
    });

    await testDb.invitation.updateMany({
      where: { userId: user.id, usedAt: null, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      acceptInvitation({
        token: second,
        password: "rahasia123",
        confirm: "rahasia123",
      }),
    ).rejects.toThrow(/kedaluwarsa/);
  });

  it("kata sandi awal tetap bisa diisi langsung tanpa link", async () => {
    const token = await addUser({
      actor: team.admin,
      input: {
        name: "Pakai Sandi",
        email: uniqueEmail("sandi"),
        role: "FINANCE_POC",
        periodId: team.periodId,
        password: "sandiawal1",
      },
    });
    expect(token).toBeNull();
  });
});
