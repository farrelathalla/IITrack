-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('RECORDED', 'VALID');

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "proofNote" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'RECORDED',
    "resolution" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_invoiceId_key" ON "receipts"("invoiceId");

-- CreateIndex
CREATE INDEX "receipts_projectId_idx" ON "receipts"("projectId");

-- CreateIndex
CREATE INDEX "receipts_status_idx" ON "receipts"("status");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receipts" ADD CONSTRAINT "receipts_amount_positive"
    CHECK ("amount" > 0);

-- Kuitansi yang sudah dinyatakan valid wajib punya penanda siapa dan kapan.
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_validated_has_actor"
    CHECK ("status" <> 'VALID' OR ("validatedById" IS NOT NULL AND "validatedAt" IS NOT NULL));

-- Dua aturan inti F20 ditegakkan basis data, bukan hanya aplikasi.
--
-- Pertama, kuitansi dan invoice rujukannya harus menunjuk project yang sama;
-- tanpa ini salah satu dari dua rujukan bisa menyimpang tanpa ketahuan.
--
-- Kedua, kuitansi yang nilainya berbeda dari invoice tidak boleh berstatus
-- VALID selama penyelesaiannya belum ditulis (UAT-NFR-007). Selisihnya sendiri
-- tidak dilarang, karena pembayaran client memang bisa berbeda karena biaya
-- transfer; yang dilarang adalah menyatakannya valid tanpa penjelasan.
--
-- Sengaja trigger BEFORE biasa, bukan CONSTRAINT TRIGGER DEFERRABLE. Keduanya
-- hanya perlu membaca baris invoice yang sudah ada, jadi tidak ada alasan
-- menunda pemeriksaannya sampai COMMIT.
CREATE OR REPLACE FUNCTION receipts_consistent_with_invoice() RETURNS trigger AS $$
DECLARE
    invoice_project text;
    invoice_amount numeric;
BEGIN
    SELECT "projectId", "amount" INTO invoice_project, invoice_amount
      FROM "invoices" WHERE "id" = NEW."invoiceId";

    IF invoice_project IS DISTINCT FROM NEW."projectId" THEN
        RAISE EXCEPTION 'Kuitansi % dan invoice rujukannya menunjuk project yang berbeda.', NEW."id";
    END IF;

    IF NEW."status" = 'VALID'
       AND NEW."amount" <> invoice_amount
       AND (NEW."resolution" IS NULL OR btrim(NEW."resolution") = '') THEN
        RAISE EXCEPTION 'Kuitansi % berbeda nilai dari invoice rujukannya, jadi tidak bisa dinyatakan valid tanpa penyelesaian tertulis.', NEW."id";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipts_consistent_with_invoice
    BEFORE INSERT OR UPDATE ON "receipts"
    FOR EACH ROW EXECUTE FUNCTION receipts_consistent_with_invoice();
