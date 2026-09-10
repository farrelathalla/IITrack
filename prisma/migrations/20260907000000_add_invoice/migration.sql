-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "terminId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_submissionId_key" ON "invoices"("submissionId");

-- CreateIndex
CREATE INDEX "invoices_projectId_idx" ON "invoices"("projectId");

-- CreateIndex
CREATE INDEX "invoices_terminId_idx" ON "invoices"("terminId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_terminId_fkey" FOREIGN KEY ("terminId") REFERENCES "termins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nilai tagihan tidak pernah nol atau negatif. Dijaga basis data supaya angka
-- mustahil tidak bisa masuk lewat jalur mana pun, termasuk perbaikan manual.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_positive"
    CHECK ("amount" > 0);

-- Satu invoice selalu menagih termin milik project yang sama. Tanpa ini, salah
-- satu dari dua rujukan bisa menunjuk project lain tanpa ketahuan.
CREATE OR REPLACE FUNCTION invoices_termin_belongs_to_project() RETURNS trigger AS $$
DECLARE
    termin_project text;
BEGIN
    SELECT "projectId" INTO termin_project FROM "termins" WHERE "id" = NEW."terminId";

    IF termin_project IS DISTINCT FROM NEW."projectId" THEN
        RAISE EXCEPTION 'Invoice % menagih termin milik project lain.', NEW."id";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_termin_belongs_to_project
    BEFORE INSERT OR UPDATE ON "invoices"
    FOR EACH ROW EXECUTE FUNCTION invoices_termin_belongs_to_project();
