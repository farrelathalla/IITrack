import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Actor } from "@/lib/auth/types";
import { recordActivity } from "@/server/activity";
import { prisma } from "@/server/db";
import { ActionError, parseInput } from "@/server/project/mutate";

/** Edit Profil: pengguna mengubah namanya sendiri (PRD bab 8.7). */
export async function updateOwnName(actor: Actor, name: string): Promise<void> {
  const value = parseInput(z.string().trim().min(1, "Nama wajib diisi."), name);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.userId },
      data: { name: value },
    });
    await recordActivity(tx, {
      actorId: actor.userId,
      action: "profile.updated",
      summary: `Mengubah nama profil menjadi ${value}`,
      division: "SYSTEM",
      objectType: "user",
      objectId: actor.userId,
    });
  });
}

export async function changeOwnPassword(
  actor: Actor,
  input: { current: string; next: string },
): Promise<void> {
  const next = parseInput(
    z.string().min(8, "Kata sandi baru minimal 8 karakter."),
    input.next,
  );
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { passwordHash: true },
  });
  if (
    !user?.passwordHash ||
    !(await verifyPassword(input.current, user.passwordHash))
  ) {
    throw new ActionError("Kata sandi saat ini salah.", {
      current: "Kata sandi saat ini salah.",
    });
  }
  const passwordHash = await hashPassword(next);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.userId },
      data: { passwordHash },
    });
    await recordActivity(tx, {
      actorId: actor.userId,
      action: "profile.password_changed",
      summary: "Mengganti kata sandi",
      division: "SYSTEM",
      objectType: "user",
      objectId: actor.userId,
    });
  });
}
