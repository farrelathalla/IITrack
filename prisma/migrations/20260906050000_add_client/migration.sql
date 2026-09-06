-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,
    "npwp" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_revisions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,
    "npwp" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_revisions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- Nama client unik tanpa memandang huruf besar-kecil, supaya "HMIF ITB" dan
-- "hmif itb" tidak jadi dua master data yang isinya sama.
CREATE UNIQUE INDEX "clients_name_lower_key" ON "clients" (LOWER("name"));

-- CreateIndex
CREATE UNIQUE INDEX "client_revisions_clientId_revision_key" ON "client_revisions"("clientId", "revision");

-- CreateIndex
CREATE INDEX "client_revisions_clientId_idx" ON "client_revisions"("clientId");

-- CreateIndex
CREATE INDEX "projects_clientId_idx" ON "projects"("clientId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_revisions" ADD CONSTRAINT "client_revisions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_revisions" ADD CONSTRAINT "client_revisions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Potret lama tidak boleh diubah atau dihapus. Itulah yang menjaga rujukan
-- project yang sudah berjalan tetap kebaca meski nama client kemudian berganti.
CREATE TRIGGER client_revisions_no_update
    BEFORE UPDATE ON "client_revisions"
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER client_revisions_no_delete
    BEFORE DELETE ON "client_revisions"
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
