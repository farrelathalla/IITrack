-- CreateEnum
CREATE TYPE "StaffingRequestStatus" AS ENUM ('SUBMITTED', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "staffing_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "roleNeeded" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "neededBy" TIMESTAMP(3) NOT NULL,
    "technicalNeeds" TEXT NOT NULL,
    "deliverable" TEXT NOT NULL,
    "status" "StaffingRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submissionId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staffing_requests_submissionId_key" ON "staffing_requests"("submissionId");

-- CreateIndex
CREATE INDEX "staffing_requests_projectId_idx" ON "staffing_requests"("projectId");

-- CreateIndex
CREATE INDEX "staffing_requests_status_idx" ON "staffing_requests"("status");

-- AddForeignKey
ALTER TABLE "staffing_requests" ADD CONSTRAINT "staffing_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_requests" ADD CONSTRAINT "staffing_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_requests" ADD CONSTRAINT "staffing_requests_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_requests" ADD CONSTRAINT "staffing_requests_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Jumlah orang yang diminta harus masuk akal.
ALTER TABLE "staffing_requests" ADD CONSTRAINT "staffing_requests_headcount_positive"
    CHECK ("headcount" >= 1);
