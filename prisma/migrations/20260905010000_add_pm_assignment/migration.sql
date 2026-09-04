-- AlterTable
ALTER TABLE "projects" ADD COLUMN "clientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "assignedPmId" TEXT;
ALTER TABLE "projects" ADD COLUMN "pmAssignedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "projects_assignedPmId_idx" ON "projects"("assignedPmId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_assignedPmId_fkey" FOREIGN KEY ("assignedPmId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
