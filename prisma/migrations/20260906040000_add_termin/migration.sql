-- CreateEnum
CREATE TYPE "TerminStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "termins" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "TerminStatus" NOT NULL DEFAULT 'UNPAID',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "termins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "termins_projectId_sequence_key" ON "termins"("projectId", "sequence");

-- CreateIndex
CREATE INDEX "termins_projectId_idx" ON "termins"("projectId");

-- AddForeignKey
ALTER TABLE "termins" ADD CONSTRAINT "termins_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termins" ADD CONSTRAINT "termins_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Persentase per baris dijaga di sini supaya nilai mustahil tidak lolos lewat
-- Prisma. Total 100 persen dan urutan 1..n dicek trigger tertunda di bawah,
-- karena baru bermakna setelah seluruh skema tertulis dalam satu transaksi.
ALTER TABLE "termins" ADD CONSTRAINT "termins_percentage_range"
    CHECK ("percentage" > 0 AND "percentage" <= 100);

ALTER TABLE "termins" ADD CONSTRAINT "termins_amount_positive"
    CHECK ("amount" > 0);

ALTER TABLE "termins" ADD CONSTRAINT "termins_sequence_positive"
    CHECK ("sequence" >= 1);

ALTER TABLE "termins" ADD CONSTRAINT "termins_dp_percentage_range"
    CHECK ("sequence" <> 1 OR ("percentage" >= 25 AND "percentage" <= 50));

CREATE OR REPLACE FUNCTION termins_scheme_consistent() RETURNS trigger AS $$
DECLARE
    pid text;
    n int;
    total numeric;
    min_seq int;
    max_seq int;
BEGIN
    IF TG_OP = 'DELETE' THEN
        pid := OLD."projectId";
    ELSE
        pid := NEW."projectId";
    END IF;

    SELECT COUNT(*)::int,
           COALESCE(SUM("percentage"), 0),
           COALESCE(MIN("sequence"), 0),
           COALESCE(MAX("sequence"), 0)
      INTO n, total, min_seq, max_seq
      FROM termins
     WHERE "projectId" = pid;

    -- Project tanpa jadwal diperbolehkan (belum disusun).
    IF n = 0 THEN
        RETURN NULL;
    END IF;

    IF min_seq <> 1 OR max_seq <> n THEN
        RAISE EXCEPTION 'Nomor termin harus berurutan mulai dari 1 tanpa lompatan.';
    END IF;

    IF total <> 100 THEN
        RAISE EXCEPTION 'Jumlah persentase termin pada sebuah project harus tepat 100.';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER termins_scheme_consistent
    AFTER INSERT OR UPDATE OR DELETE ON termins
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION termins_scheme_consistent();
