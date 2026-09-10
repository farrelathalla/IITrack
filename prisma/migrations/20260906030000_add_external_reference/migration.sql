-- CreateEnum
CREATE TYPE "ReferenceKind" AS ENUM ('GOOGLE_DRIVE', 'NOTION', 'GITHUB_REPO', 'OTHER');

-- CreateTable
CREATE TABLE "external_references" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ReferenceKind" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_references_projectId_url_key" ON "external_references"("projectId", "url");

-- CreateIndex
CREATE INDEX "external_references_projectId_kind_idx" ON "external_references"("projectId", "kind");

-- AddForeignKey
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hanya https yang disimpan. Alamat ini dibuka orang lain dari Project Hub,
-- jadi bentuknya dijaga basis data, bukan hanya oleh kode yang menulisnya.
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_https_only"
    CHECK ("url" LIKE 'https://%');
