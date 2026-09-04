-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_objectType_objectId_idx" ON "audit_logs"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
-- RESTRICT, bukan SET NULL. Akun pengurus dinonaktifkan, tidak pernah dihapus,
-- dan riwayat yang pernah ia buat tidak boleh ikut hilang (PRD F30). SET NULL
-- juga akan meng-UPDATE audit_logs, yang justru ditolak trigger di bawah.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Jejak aktivitas hanya boleh ditambah. Larangan ini ditegakkan basis data,
-- bukan disiplin kode, supaya jabatan mana pun termasuk pemegang System
-- Administrator privilege tidak dapat mengubah atau menghapus catatan lama.
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Catatan jejak aktivitas tidak dapat diubah maupun dihapus oleh jabatan mana pun.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE ON "audit_logs"
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_delete
    BEFORE DELETE ON "audit_logs"
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
