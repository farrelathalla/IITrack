-- Edit/hapus project awal, undangan akun, dan dua persetujuan Project Charter.

ALTER TABLE "users" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_inviteTokenHash_key" ON "users"("inviteTokenHash");

ALTER TABLE "projects" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "submissions" ADD COLUMN "opsApprovedAt" TIMESTAMP(3);
ALTER TABLE "submissions" ADD COLUMN "opsApprovedById" TEXT;
ALTER TABLE "submissions" ADD COLUMN "techApprovedAt" TIMESTAMP(3);
ALTER TABLE "submissions" ADD COLUMN "techApprovedById" TEXT;

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_opsApprovedById_fkey" FOREIGN KEY ("opsApprovedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_techApprovedById_fkey" FOREIGN KEY ("techApprovedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
