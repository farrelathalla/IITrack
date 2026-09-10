import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Data contoh untuk pengembangan dan pengujian manual. Bukan data produksi:
 * seluruh akun memakai kata sandi yang sama dan sengaja mudah ditebak.
 *
 * Daftarnya mengikuti aktor yang disebut IIT-UAT-OPS26/27 pada test case yang
 * dijalankan, lihat docs/uat-execution-scope.md. Beberapa test case menuntut dua
 * orang berjabatan sama, misalnya PM yang ditugaskan dan PM yang tidak, jadi
 * jabatan tersebut punya dua akun.
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

  // Wakil. UAT-RBAC-003 dan UAT-RBAC-004 menulis aktornya sebagai "CFO / Vice
  // CFO" dan "CTO / Vice CTO", jadi keduanya harus bisa diuji.
  {
    email: "vcoo@iit.test",
    name: "Contoh Vice COO",
    role: "VICE_COO",
    division: "OPERATIONAL",
    isSystemAdmin: false,
  },
  {
    email: "vcfo@iit.test",
    name: "Contoh Vice CFO",
    role: "VICE_CFO",
    division: "FINANCE",
    isSystemAdmin: false,
  },
  {
    email: "vcto@iit.test",
    name: "Contoh Vice CTO",
    role: "VICE_CTO",
    division: "TECHDEV",
    isSystemAdmin: false,
  },

  // Langkah kedua rantai persetujuan invoice. Tanpa akun ini UAT-APR-001 sampai
  // 004 dan UAT-INV berhenti di tengah, karena tidak ada yang bisa memutuskan
  // langkah POC dokumentasi.
  {
    email: "officer@iit.test",
    name: "Contoh Officer Operational",
    role: "OFFICER_OPERATIONAL",
    division: "OPERATIONAL",
    isSystemAdmin: false,
  },

  // Finance POC. Yang kedua dipakai UAT-ASSIGN-002, yang menuntut Finance POC
  // lain tidak ikut memperoleh hak pada project yang bukan penugasannya.
  {
    email: "poc@iit.test",
    name: "Contoh Finance POC A",
    role: "FINANCE_POC",
    division: "FINANCE",
    isSystemAdmin: false,
  },
  {
    email: "poc2@iit.test",
    name: "Contoh Finance POC B",
    role: "FINANCE_POC",
    division: "FINANCE",
    isSystemAdmin: false,
  },

  // PM kedua untuk UAT-RBAC-001, UAT-RBAC-006, dan UAT-ASSIGN-007, yang
  // seluruhnya membandingkan PM yang ditugaskan dengan PM yang tidak.
  {
    email: "pm2@iit.test",
    name: "Contoh PM B",
    role: "PROJECT_MANAGER",
    division: "OPERATIONAL",
    isSystemAdmin: false,
  },

  // Pelaksana TechDev tanpa System Administrator privilege. Yang kedua dipakai
  // UAT-ASSIGN-005, yang memindahkan penugasan dari satu orang ke orang lain.
  {
    email: "dev@iit.test",
    name: "Contoh TechDev A",
    role: "TECHDEV_MEMBER",
    division: "TECHDEV",
    isSystemAdmin: false,
  },
  {
    email: "dev2@iit.test",
    name: "Contoh TechDev B",
    role: "TECHDEV_MEMBER",
    division: "TECHDEV",
    isSystemAdmin: false,
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
