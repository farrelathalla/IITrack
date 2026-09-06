import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StageDefinition } from "@/lib/project/stages";
import { assignProjectManager } from "@/server/project/assignment";
import type { ProjectReader } from "@/server/project/hub";
import { readProjectHub, readProjectList } from "@/server/project/hub";
import { assignMember } from "@/server/project/members";
import { addReference } from "@/server/project/references";
import { registerProject } from "@/server/project/registration";
import { changeProjectStage } from "@/server/project/stage";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f08-";
const PERIOD = uniquePeriod();

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", order: 1, label: "Tahap Satu" },
];

/**
 * Membungkus klien basis data supaya jumlah permintaannya bisa dihitung.
 *
 * "Satu permintaan data" adalah inti task ini, jadi jumlahnya diuji, bukan
 * hanya diklaim di komentar kode.
 */
function countingReader(): { reader: ProjectReader; count: () => number } {
  let calls = 0;
  const reader: ProjectReader = {
    project: new Proxy(testDb.project, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (
          typeof value === "function" &&
          (prop === "findUnique" || prop === "findMany")
        ) {
          return (...args: unknown[]) => {
            calls += 1;
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return value;
      },
    }) as typeof testDb.project,
  };
  return { reader, count: () => calls };
}

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let pmLain: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  pmLain = await actorFrom(
    uniqueEmail(`${PREFIX}pm2-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}fin-`),
    "FINANCE_POC",
    "FINANCE",
  );

  const hasil = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Hub",
      clientName: "PT Contoh",
      period: PERIOD,
      value: 25_000_000,
    },
  });
  if (!hasil.registered) throw new Error(`Pendaftaran gagal: ${hasil.reason}`);
  projectId = hasil.id;

  await assignProjectManager({
    actor: coo.actor,
    projectDbId: projectId,
    pmUserId: pm.userId,
  });
  await assignMember({
    actor: coo.actor,
    projectDbId: projectId,
    userId: pm.userId,
    division: "OPERATIONAL",
  });
  await changeProjectStage({
    actor: coo.actor,
    projectDbId: projectId,
    toStage: "tahap_satu",
    catalogue: CONTOH,
  });
  await addReference({
    actor: coo.actor,
    projectDbId: projectId,
    url: "https://drive.google.com/drive/folders/hub",
    label: "Folder project",
  });
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F08-AC3 Halaman detail menjadi titik akses ke dokumen, termin, Finance, staffing, repository, riwayat, dan pending action sesuai hak akses.", () => {
  it("Seluruh isi halaman diambil dalam satu permintaan data, bukan belasan", async () => {
    const { reader, count } = countingReader();

    await readProjectHub(coo.actor, projectId, new Date(), reader, CONTOH);

    expect(count()).toBe(1);
  });

  it("Satu permintaan itu sudah memuat identitas, tahap, tim, riwayat, dan rujukan", async () => {
    const hub = await readProjectHub(
      coo.actor,
      projectId,
      new Date(),
      testDb,
      CONTOH,
    );

    expect(hub).not.toBeNull();
    expect(hub?.projectId).toMatch(/^IIT-/);
    expect(hub?.name).toBe("Project Hub");
    expect(hub?.clientName).toBe("PT Contoh");
    expect(hub?.stage?.label).toBe("Tahap Satu");
    expect(hub?.assignedPm?.id).toBe(pm.userId);
    expect(hub?.members.length).toBeGreaterThanOrEqual(1);
    expect(hub?.stageHistory.length).toBeGreaterThanOrEqual(1);
    expect(hub?.references.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(hub?.staffingRequests)).toBe(true);
    expect(Array.isArray(hub?.pendingSubmissions)).toBe(true);
  });

  it("Project yang tidak ada mengembalikan kosong, bukan melempar kesalahan", async () => {
    const hub = await readProjectHub(
      coo.actor,
      "00000000-0000-0000-0000-000000000000",
      new Date(),
      testDb,
      CONTOH,
    );

    expect(hub).toBeNull();
  });
});

describe("F08-AC2 Nilai project hanya muncul kalau jabatan pengguna mengizinkan.", () => {
  it("COO melihat nilai project", async () => {
    const hub = await readProjectHub(
      coo.actor,
      projectId,
      new Date(),
      testDb,
      CONTOH,
    );

    expect(hub?.value).toBe("25000000");
  });

  it("PM yang ditugaskan melihat nilai project yang ditugaskan kepadanya", async () => {
    const hub = await readProjectHub(
      pm.actor,
      projectId,
      new Date(),
      testDb,
      CONTOH,
    );

    expect(hub?.value).toBe("25000000");
  });

  it("UAT-HUB-002, PM yang bukan pelaksana tetap melihat halamannya, tetapi tanpa nilai project", async () => {
    const hub = await readProjectHub(
      pmLain.actor,
      projectId,
      new Date(),
      testDb,
      CONTOH,
    );

    expect(hub).not.toBeNull();
    expect(hub?.name).toBe("Project Hub");
    expect(hub?.value).toBeNull();
  });

  it("Tata letak tetap utuh ketika kolom nilai tidak ada sama sekali", async () => {
    const hub = await readProjectHub(
      pmLain.actor,
      projectId,
      new Date(),
      testDb,
      CONTOH,
    );

    // Bidang lain tetap terisi, hanya nilainya yang kosong.
    expect(hub?.projectId).toMatch(/^IIT-/);
    expect(hub?.stage?.label).toBe("Tahap Satu");
    expect(hub?.assignedPm?.id).toBe(pm.userId);
  });
});

describe("F08-AC1 Daftar project menampilkan Project ID, nama, client, PM, stage, dan waktu perubahan terakhir.", () => {
  it("UAT-HUB-001, daftar memuat keenam kolom tersebut", async () => {
    const daftar = await readProjectList(coo.actor, new Date(), testDb, CONTOH);
    const baris = daftar.find((row) => row.id === projectId);

    expect(baris).toBeDefined();
    expect(baris?.projectId).toMatch(/^IIT-/);
    expect(baris?.name).toBe("Project Hub");
    expect(baris?.clientName).toBe("PT Contoh");
    expect(baris?.assignedPm).toContain(PREFIX);
    expect(baris?.stage).toBe("Tahap Satu");
    expect(baris?.updatedAt).toBeInstanceOf(Date);
  });

  it("Seluruh daftar diambil dalam satu permintaan data", async () => {
    const { reader, count } = countingReader();

    await readProjectList(coo.actor, new Date(), reader, CONTOH);

    expect(count()).toBe(1);
  });

  it("Nilai project disaring per baris sesuai penugasan pembacanya", async () => {
    const milikPm = (
      await readProjectList(pm.actor, new Date(), testDb, CONTOH)
    ).find((row) => row.id === projectId);
    const milikOrangLain = (
      await readProjectList(pmLain.actor, new Date(), testDb, CONTOH)
    ).find((row) => row.id === projectId);

    expect(milikPm?.value).toBe("25000000");
    expect(milikOrangLain?.value).toBeNull();
  });

  it("Finance POC melihat daftarnya tanpa nilai project yang tidak ditugaskan kepadanya", async () => {
    const baris = (
      await readProjectList(financePoc.actor, new Date(), testDb, CONTOH)
    ).find((row) => row.id === projectId);

    expect(baris).toBeDefined();
    expect(baris?.value).toBeNull();
  });
});
