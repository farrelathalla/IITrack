import { describe, expect, it } from "vitest";
import {
  DOCUMENT_PREFIX,
  formatDocumentNumber,
  parseDocumentNumber,
} from "@/lib/document/numbering";

const PROJECT = "IIT-2627-001";

describe("F20-AC1 Bukti transfer yang diunggah PM menempel pada invoice dan Project ID yang benar.", () => {
  it("Nomor invoice berawalan 02 sesuai IITBOOK 3.7", () => {
    expect(formatDocumentNumber("INVOICE", PROJECT)).toBe("#02-IIT-2627-001");
  });

  it("Nomor kuitansi berawalan 01 sesuai IITBOOK 3.8", () => {
    expect(formatDocumentNumber("RECEIPT", PROJECT)).toBe("#01-IIT-2627-001");
  });

  it("Awalan kedua jenis dokumen berbeda, sehingga tidak pernah tertukar", () => {
    expect(DOCUMENT_PREFIX.INVOICE).not.toBe(DOCUMENT_PREFIX.RECEIPT);
    expect(formatDocumentNumber("INVOICE", PROJECT)).not.toBe(
      formatDocumentNumber("RECEIPT", PROJECT),
    );
  });

  it("Project ID yang bentuknya salah ditolak, bukan dipakai apa adanya", () => {
    for (const salah of ["IIT-2627-42", "IIT-2627-000", "2627-001", ""]) {
      expect(() => formatDocumentNumber("INVOICE", salah)).toThrow();
    }
  });

  it("Nomor dokumen dapat diurai kembali menjadi jenis dan Project ID-nya", () => {
    expect(parseDocumentNumber("#02-IIT-2627-001")).toEqual({
      kind: "INVOICE",
      projectId: PROJECT,
    });
    expect(parseDocumentNumber("#01-IIT-2627-042")).toEqual({
      kind: "RECEIPT",
      projectId: "IIT-2627-042",
    });
  });

  it("Bentuk yang tidak dikenal dikembalikan kosong, bukan ditebak", () => {
    for (const salah of [
      "#03-IIT-2627-001",
      "02-IIT-2627-001",
      "#02-IIT-2627-000",
      "#02 IIT-2627-001",
      "",
    ]) {
      expect(parseDocumentNumber(salah)).toBeNull();
    }
  });

  it("Nomor dokumen menunjuk kembali ke Project ID yang benar, bukan project lain", () => {
    const nomor = formatDocumentNumber("INVOICE", "IIT-2627-042");

    expect(parseDocumentNumber(nomor)?.projectId).toBe("IIT-2627-042");
    expect(parseDocumentNumber(nomor)?.projectId).not.toBe(PROJECT);
  });

  it("Nomor unik antar project untuk jenis dokumen yang sama", () => {
    const nomor = ["IIT-2627-001", "IIT-2627-002", "IIT-2627-003"].map((id) =>
      formatDocumentNumber("INVOICE", id),
    );

    expect(new Set(nomor).size).toBe(nomor.length);
  });

  it.todo(
    "Nomor unik antar termin pada project yang sama, menunggu pola IITBOOK untuk project bertermin lebih dari satu",
  );
});
