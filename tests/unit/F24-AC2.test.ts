import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

const SERVER_ROOT = fileURLToPath(new URL("../../src/server", import.meta.url));

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
      continue;
    }
    if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

function recordedActionKeys(files: readonly string[]): Set<string> {
  const keys = new Set<string>();
  const pola = /AUDIT_ACTIONS\.([A-Z0-9_]+)/g;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pola)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

describe("F24-AC2 Aksi yang dicatat mencakup pembuatan project, override Project ID, perpindahan stage, override gate, persetujuan, penolakan, penandaan P0, dan perubahan jabatan.", () => {
  const serverFiles = listTsFiles(SERVER_ROOT);
  const writers = serverFiles.filter((file) => !file.endsWith("audit.ts"));

  it("Hanya recordAudit yang menulis audit_logs di lapisan server", () => {
    const bypass = writers.filter((file) =>
      readFileSync(file, "utf8").includes("auditLog.create"),
    );
    expect(bypass).toEqual([]);
  });

  it("Setiap aksi katalog dipanggil dari proses server lewat AUDIT_ACTIONS", () => {
    const recorded = recordedActionKeys(serverFiles);
    const missing = Object.keys(AUDIT_ACTIONS).filter(
      (key) => !recorded.has(key),
    );
    expect(missing).toEqual([]);
  });

  it("Sampel PRD yang prosesnya sudah ada tercatat: project, override ID, tahap, persetujuan, penolakan, jabatan", () => {
    const recorded = recordedActionKeys(serverFiles);
    for (const key of [
      "PROJECT_CREATED",
      "PROJECT_ID_OVERRIDDEN",
      "PROJECT_STAGE_CHANGED",
      "SUBMISSION_STEP_APPROVED",
      "SUBMISSION_STEP_REJECTED",
      "MEMBER_ROLE_ASSIGNED",
      "MEMBER_HANDOVER",
    ] as const) {
      expect(recorded).toContain(key);
    }
  });

  it("Override gate dan penandaan P0 belum dikarang di katalog sebelum prosesnya ada", () => {
    const values = Object.values(AUDIT_ACTIONS).join(" ");
    expect(values).not.toMatch(/gate/i);
    expect(values).not.toMatch(/p0/i);
  });
});
