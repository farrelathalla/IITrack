import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import {
  createClient,
  listClients,
  updateClient,
} from "@/server/client/management";
import { registerProject } from "@/server/project/registration";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f06-";
const PERIOD = uniquePeriod();
const NAMA = `HMIF ${PERIOD}`;

let coo: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let clientId: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  officer = await actorFrom(
    uniqueEmail(`${PREFIX}off-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F06-AC1 Client tersimpan sebagai master data dan bisa dipilih saat membuat project.", () => {
  it("UAT-CLIENT-002, Officer Operational dapat menambah client", async () => {
    const hasil = await createClient({
      actor: officer.actor,
      draft: {
        name: NAMA,
        contact: "hmif@itb.test",
        address: "Bandung",
        npwp: "01.234.567.8-901.000",
      },
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    clientId = hasil.clientId;

    const row = await testDb.client.findUniqueOrThrow({
      where: { id: clientId },
      include: { revisions: true },
    });
    expect(row.name).toBe(NAMA);
    expect(row.npwp).toBe("012345678901000");
    expect(row.revisions).toHaveLength(1);
    expect(row.revisions[0].revision).toBe(1);
  });

  it("Nama yang sama tidak boleh diketik ulang sebagai client baru", async () => {
    const hasil = await createClient({
      actor: officer.actor,
      draft: { name: NAMA.toLowerCase() },
    });
    expect(hasil.ok).toBe(false);
  });

  it("PM tidak boleh menambah master data client", async () => {
    const hasil = await createClient({
      actor: pm.actor,
      draft: { name: `PM ${PERIOD}` },
    });
    expect(hasil.ok).toBe(false);
  });

  it("Client bisa dipilih saat mendaftarkan project", async () => {
    const daftar = await listClients(pm.actor);
    expect(daftar.ok).toBe(true);
    if (!daftar.ok) return;
    expect(daftar.clients.some((c) => c.id === clientId)).toBe(true);

    const project = await registerProject({
      actor: pm.actor,
      input: {
        name: "Project Client Master",
        clientName: "akan diganti dari master",
        clientId,
        period: PERIOD,
      },
    });
    expect(project.registered).toBe(true);
    if (!project.registered) return;

    const row = await testDb.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(row.clientId).toBe(clientId);
    expect(row.clientName).toBe(NAMA);
  });
});

describe("F06-AC2 Perubahannya berlaku pada seluruh project yang merujuknya dan masuk audit log.", () => {
  it("UAT-USER-001, mengubah client menambah revisi tanpa menghapus potret lama", async () => {
    const namaBaru = `${NAMA} Baru`;
    const hasil = await updateClient({
      actor: coo.actor,
      clientId,
      draft: {
        name: namaBaru,
        contact: "baru@itb.test",
        address: "Jakarta",
      },
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.revision).toBe(2);

    const revisi = await testDb.clientRevision.findMany({
      where: { clientId },
      orderBy: { revision: "asc" },
    });
    expect(revisi).toHaveLength(2);
    expect(revisi[0].name).toBe(NAMA);
    expect(revisi[1].name).toBe(namaBaru);
  });

  it("Nama baru tampil di seluruh project yang merujuk client itu", async () => {
    const projects = await testDb.project.findMany({
      where: { clientId },
    });
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((p) => p.clientName === `${NAMA} Baru`)).toBe(true);
  });

  it("Potret lama tidak bisa diubah langsung di basis data", async () => {
    const lama = await testDb.clientRevision.findFirstOrThrow({
      where: { clientId, revision: 1 },
    });

    await expect(
      testDb.clientRevision.update({
        where: { id: lama.id },
        data: { name: "Dihapus diam-diam" },
      }),
    ).rejects.toThrow();
  });

  it("Perubahan masuk jejak aktivitas", async () => {
    const jejak = await testDb.auditLog.findMany({
      where: {
        objectType: AUDIT_OBJECTS.CLIENT,
        objectId: clientId,
      },
    });

    expect(
      jejak.some((entry) => entry.action === AUDIT_ACTIONS.CLIENT_CREATED),
    ).toBe(true);
    expect(
      jejak.some((entry) => entry.action === AUDIT_ACTIONS.CLIENT_UPDATED),
    ).toBe(true);
  });
});
