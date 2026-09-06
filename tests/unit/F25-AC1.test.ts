import { describe, expect, it } from "vitest";
import {
  classifyReferenceUrl,
  normalizeReferenceUrl,
  parseGithubRepo,
} from "@/lib/project/external-reference";

describe("F25-AC1 Tautan tersimpan bersama Project ID dan membuka resource project yang benar, tidak tertukar dengan project lain.", () => {
  it("Tautan Google Drive dikenali dari hostnya", () => {
    expect(
      classifyReferenceUrl("https://drive.google.com/drive/folders/abc"),
    ).toBe("GOOGLE_DRIVE");
    expect(classifyReferenceUrl("https://docs.google.com/document/d/abc")).toBe(
      "GOOGLE_DRIVE",
    );
  });

  it("Tautan Notion dikenali, termasuk subdomain ruang kerja", () => {
    expect(classifyReferenceUrl("https://www.notion.so/Halaman-abc")).toBe(
      "NOTION",
    );
    expect(classifyReferenceUrl("https://iit.notion.site/Halaman-abc")).toBe(
      "NOTION",
    );
  });

  it("Tautan GitHub dikenali sebagai repository", () => {
    expect(classifyReferenceUrl("https://github.com/InkubatorIT/IITrack")).toBe(
      "GITHUB_REPO",
    );
  });

  it("Host lain dikenali sebagai rujukan biasa, bukan ditolak", () => {
    expect(classifyReferenceUrl("https://contoh.co.id/berkas")).toBe("OTHER");
  });

  it("Alamat yang bukan URL ditolak", () => {
    for (const salah of [
      "",
      "bukan url",
      "drive.google.com/abc",
      "ftp://x.com/a",
    ]) {
      expect(classifyReferenceUrl(salah)).toBeNull();
    }
  });

  it("Alamat http biasa ditolak, hanya https yang diterima", () => {
    expect(
      classifyReferenceUrl("http://drive.google.com/drive/folders/abc"),
    ).toBeNull();
  });

  it("Repository GitHub diurai menjadi pemilik dan nama repositorynya", () => {
    expect(parseGithubRepo("https://github.com/InkubatorIT/IITrack")).toEqual({
      owner: "InkubatorIT",
      repo: "IITrack",
    });
  });

  it("Akhiran .git dan garis miring penutup tidak mengubah hasil uraian", () => {
    expect(
      parseGithubRepo("https://github.com/InkubatorIT/IITrack.git"),
    ).toEqual({
      owner: "InkubatorIT",
      repo: "IITrack",
    });
    expect(parseGithubRepo("https://github.com/InkubatorIT/IITrack/")).toEqual({
      owner: "InkubatorIT",
      repo: "IITrack",
    });
  });

  it("Alamat GitHub yang bukan repository dikembalikan kosong", () => {
    for (const bukanRepo of [
      "https://github.com/InkubatorIT",
      "https://github.com/",
      "https://gitlab.com/a/b",
    ]) {
      expect(parseGithubRepo(bukanRepo)).toBeNull();
    }
  });

  it("Alamat dinormalkan supaya dua tulisan yang sama tidak tersimpan dua kali", () => {
    expect(normalizeReferenceUrl("https://github.com/IIT/Track/")).toBe(
      "https://github.com/IIT/Track",
    );
    expect(normalizeReferenceUrl("https://GitHub.com/IIT/Track")).toBe(
      "https://github.com/IIT/Track",
    );
  });

  it("Bagian setelah tanda pagar dibuang, karena tidak mengubah resource yang dibuka", () => {
    expect(
      normalizeReferenceUrl("https://www.notion.so/Halaman#bagian-2"),
    ).toBe("https://www.notion.so/Halaman");
  });
});
