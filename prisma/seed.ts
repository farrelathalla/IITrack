import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Data contoh untuk pengembangan dan pengujian manual. Bukan data produksi:
 * seluruh akun memakai kata sandi yang sama dan sengaja mudah ditebak.
 */
const PERIOD = "2026/2027";
const PERIOD_START = new Date("2026-08-01T00:00:00.000Z");
const PERIOD_END = new Date("2027-08-01T00:00:00.000Z");
const PASSWORD = "iitrack-dev-2627";

const MEMBERS = [
  {
    email: "coo@iit.test",
    name: "Contoh COO",
    role: "COO",
    division: "OPERATIONAL",
    isSystemAdmin: false,
  },
  {
    email: "cfo@iit.test",
    name: "Contoh CFO",
    role: "CFO",
    division: "FINANCE",
    isSystemAdmin: false,
  },
  {
    email: "cto@iit.test",
    name: "Contoh CTO",
    role: "CTO",
    division: "TECHDEV",
    isSystemAdmin: false,
  },
  {
    email: "pm@iit.test",
    name: "Contoh PM",
    role: "PROJECT_MANAGER",
    division: "OPERATIONAL",
    isSystemAdmin: false,
  },
  {
    email: "admin@iit.test",
    name: "Contoh Authorized TechDev",
    role: "TECHDEV_MEMBER",
    division: "TECHDEV",
    isSystemAdmin: true,
  },
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diisi.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const passwordHash = await hashPassword(PASSWORD);

  for (const member of MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: { name: member.name, status: "ACTIVE", passwordHash },
      create: {
        email: member.email,
        name: member.name,
        status: "ACTIVE",
        passwordHash,
      },
    });

    const existing = await prisma.roleAssignment.findFirst({
      where: { userId: user.id, role: member.role, period: PERIOD },
    });

    if (!existing) {
      await prisma.roleAssignment.create({
        data: {
          userId: user.id,
          role: member.role,
          division: member.division,
          period: PERIOD,
          startDate: PERIOD_START,
          endDate: PERIOD_END,
          isSystemAdmin: member.isSystemAdmin,
        },
      });
    }
  }

  console.log(`${MEMBERS.length} akun contoh siap. Kata sandi: ${PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
