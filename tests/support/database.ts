import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL belum diisi. Jalankan `bunx prisma dev`, salin URL-nya ke .env, lalu ulangi.",
  );
}

/** Klien khusus test integrasi, terpisah dari klien aplikasi. */
export const testDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Membersihkan data yang dibuat sebuah berkas test, dikenali dari awalan email.
 *
 * Trigger append-only dimatikan sementara khusus di sini. Jaminan pada F24
 * berlaku untuk jabatan di dalam aplikasi, bukan untuk pemilik basis data, dan
 * test memang memiliki basis datanya sendiri. Kode aplikasi tidak boleh
 * memakai jalan ini.
 */
export async function cleanUpUsers(emailPrefix: string): Promise<void> {
  await testDb.$executeRawUnsafe(
    'ALTER TABLE "audit_logs" DISABLE TRIGGER USER',
  );
  try {
    await testDb.auditLog.deleteMany({
      where: { actor: { email: { startsWith: emailPrefix } } },
    });
  } finally {
    await testDb.$executeRawUnsafe(
      'ALTER TABLE "audit_logs" ENABLE TRIGGER USER',
    );
  }

  await testDb.user.deleteMany({
    where: { email: { startsWith: emailPrefix } },
  });
}
