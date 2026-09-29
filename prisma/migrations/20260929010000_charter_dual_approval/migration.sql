-- Project Charter disetujui dua sisi: COO/VCOO dan CTO/VCTO (jawaban CTO, 29 Sep 2026).
-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "opsApprovedAt" TIMESTAMP(3),
ADD COLUMN     "opsApprovedById" TEXT,
ADD COLUMN     "techApprovedAt" TIMESTAMP(3),
ADD COLUMN     "techApprovedById" TEXT;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_opsApprovedById_fkey" FOREIGN KEY ("opsApprovedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_techApprovedById_fkey" FOREIGN KEY ("techApprovedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

