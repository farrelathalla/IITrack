-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "value" DECIMAL(18,2),
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_number_counters" (
    "period" TEXT NOT NULL,
    "highestIssued" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_number_counters_pkey" PRIMARY KEY ("period")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectId_key" ON "projects"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_period_sequence_key" ON "projects"("period", "sequence");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keunikan nomor dijamin basis data lewat dua jalur sekaligus: keunikan teks
-- projectId, dan keunikan pasangan periode dengan urutannya. Ditambah tiga
-- pemeriksaan berikut supaya nomor yang bentuknya salah tidak pernah bisa
-- masuk, walaupun ada kode yang menulis langsung tanpa lewat aplikasi.

-- Urutan dimulai dari satu.
ALTER TABLE "projects" ADD CONSTRAINT "projects_sequence_positive"
    CHECK ("sequence" >= 1);

-- Bentuk nomor mengikuti IIT-NNNN-NNN, menolak 000 dan nol berlebih di depan.
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_id_format"
    CHECK ("projectId" ~ '^IIT-[0-9]{4}-(00[1-9]|0[1-9][0-9]|[1-9][0-9]{2,})$');

-- Teks nomor harus sama dengan periode dan urutan yang tersimpan terurai,
-- sehingga keduanya tidak bisa berbeda diam-diam.
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_id_matches_parts"
    CHECK ("projectId" = 'IIT-' || "period" || '-' || LPAD("sequence"::text, 3, '0'));
