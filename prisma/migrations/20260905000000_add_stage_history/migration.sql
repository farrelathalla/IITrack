-- AlterTable
ALTER TABLE "projects" ADD COLUMN "stage" TEXT;

-- CreateTable
CREATE TABLE "project_stage_history" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_stage_history_projectId_createdAt_idx" ON "project_stage_history"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_stage_history" ADD CONSTRAINT "project_stage_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stage_history" ADD CONSTRAINT "project_stage_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Riwayat perpindahan tahap hanya boleh ditambah. Sama seperti jejak aktivitas,
-- larangannya ditegakkan basis data supaya riwayatnya tidak bisa dimanipulasi
-- oleh siapa pun, bukan hanya oleh kode yang berdisiplin (F09-AC3).
CREATE TRIGGER project_stage_history_no_update
    BEFORE UPDATE ON "project_stage_history"
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER project_stage_history_no_delete
    BEFORE DELETE ON "project_stage_history"
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
