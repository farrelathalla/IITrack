-- Baseline skema IITrack untuk IIT-PRD-IITRACK-DEV-2026 (revisi 24 September 2026).
--
-- Migrasi lama (PRD 2026 versi awal) dihapus dan diganti satu baseline ini,
-- karena model domainnya berubah menyeluruh: sembilan stage tetap, alur status
-- termin, Finance POC per project, dan Super Admin sebagai jabatan. Belum ada
-- basis data bersama yang isinya harus dipertahankan saat keputusan ini diambil.

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'COO', 'VICE_COO', 'PROJECT_MANAGER', 'CTO', 'VICE_CTO', 'TECH_DEVELOPER', 'CFO', 'VICE_CFO', 'FINANCE_POC');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('DEVELOPMENT', 'ADVISORY', 'HIRING', 'DEPLOYMENT', 'INTEGRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectSource" AS ENUM ('BUSINESS_DEVELOPMENT', 'NON_BD', 'INTERNAL', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FinalStatus" AS ENUM ('EARLY', 'ON_TIME', 'LATE');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('PM', 'DEVELOPER', 'FINANCE_POC');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('REQUIREMENT_GATHERING', 'PROJECT_CHARTER', 'GANTT_CHART', 'MOU', 'PROGRAMMER_CONTRACT', 'PROGRESS_REPORT', 'TESTING_RESULT', 'BAST', 'CLIENT_FEEDBACK', 'PROGRAMMER_FEEDBACK', 'PROJECT_DOCUMENTATION', 'SOURCE_CODE_DOCUMENTATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('MISSING', 'IN_PROGRESS', 'SUBMITTED', 'DONE');

-- CreateEnum
CREATE TYPE "SubmissionKind" AS ENUM ('PROJECT_CHARTER', 'MOU', 'PROGRAMMER_CONTRACT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StaffingStatus" AS ENUM ('WAITING_TECHDEV', 'DEVELOPER_ASSIGNED');

-- CreateEnum
CREATE TYPE "TermStep" AS ENUM ('NOT_STARTED', 'INVOICE_REQUESTED', 'PROCESSING', 'INVOICE_APPROVED', 'SENT_TO_CLIENT', 'PROOF_SUBMITTED', 'PAYMENT_RECEIVED', 'RECEIPT_ISSUED', 'DONE');

-- CreateEnum
CREATE TYPE "UatStatus" AS ENUM ('NOT_STARTED', 'SCHEDULED', 'PASSED', 'NEEDS_FIX');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'APPROVED', 'DISBURSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityResult" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "periodId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "type" "ProjectType",
    "source" "ProjectSource",
    "targetStart" TIMESTAMP(3) NOT NULL,
    "targetEnd" TIMESTAMP(3) NOT NULL,
    "internalNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "finalStatus" "FinalStatus",
    "stage1DoneAt" TIMESTAMP(3),
    "developmentDoneAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_number_counters" (
    "periodCode" TEXT NOT NULL,
    "highestIssued" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_number_counters_pkey" PRIMARY KEY ("periodCode")
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "techRole" TEXT,
    "assignedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stages" (
    "projectId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("projectId","stage")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "developerId" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'MISSING',
    "deadline" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "SubmissionKind" NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "feedback" TEXT,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_requests" (
    "projectId" TEXT NOT NULL,
    "technicalNeeds" TEXT NOT NULL,
    "roleRequested" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "neededBy" TIMESTAMP(3) NOT NULL,
    "status" "StaffingStatus" NOT NULL DEFAULT 'WAITING_TECHDEV',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),

    CONSTRAINT "staffing_requests_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "tech_infos" (
    "projectId" TEXT NOT NULL,
    "githubRepo" TEXT,
    "sprintPlanning" TEXT,
    "currentSprint" TEXT,
    "progressPercent" INTEGER,
    "nextMilestone" TEXT,
    "latestUpdate" TEXT,
    "latestUpdateAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_infos_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "tech_blockers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tech_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "dueNote" TEXT,
    "step" "TermStep" NOT NULL DEFAULT 'NOT_STARTED',
    "feedback" TEXT,
    "invoiceRequestUrl" TEXT,
    "approvedInvoiceUrl" TEXT,
    "transferProofUrl" TEXT,
    "receiptUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "projectId" TEXT NOT NULL,
    "uatStatus" "UatStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "projectId" TEXT NOT NULL,
    "status" "DisbursementStatus" NOT NULL,
    "feedback" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "disbursedById" TEXT,
    "disbursedAt" TIMESTAMP(3),

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "stage" INTEGER,
    "division" TEXT,
    "result" "ActivityResult" NOT NULL DEFAULT 'UPDATED',
    "feedback" TEXT,
    "objectType" TEXT,
    "objectId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "periods_name_key" ON "periods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "periods_code_key" ON "periods"("code");

-- CreateIndex
CREATE INDEX "role_assignments_userId_idx" ON "role_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_periodCode_sequence_key" ON "projects"("periodCode", "sequence");

-- CreateIndex
CREATE INDEX "project_assignments_projectId_role_idx" ON "project_assignments"("projectId", "role");

-- CreateIndex
CREATE INDEX "project_assignments_userId_idx" ON "project_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_projectId_kind_developerId_key" ON "documents"("projectId", "kind", "developerId");

-- CreateIndex
CREATE INDEX "submissions_projectId_kind_idx" ON "submissions"("projectId", "kind");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "tech_blockers_projectId_idx" ON "tech_blockers"("projectId");

-- CreateIndex
CREATE INDEX "milestones_projectId_idx" ON "milestones"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "terms_projectId_sequence_key" ON "terms"("projectId", "sequence");

-- CreateIndex
CREATE INDEX "activity_logs_projectId_createdAt_idx" ON "activity_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_requests" ADD CONSTRAINT "staffing_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_infos" ADD CONSTRAINT "tech_infos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_blockers" ADD CONSTRAINT "tech_blockers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_blockers" ADD CONSTRAINT "tech_blockers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Riwayat aktivitas hanya bisa ditambah (PRD bab 13). Ditegakkan basis data,
-- bukan hanya disiplin kode, supaya berlaku juga bagi yang mengakses basis
-- datanya langsung.
CREATE FUNCTION activity_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Riwayat aktivitas tidak bisa diubah atau dihapus.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_logs_no_update
  BEFORE UPDATE ON "activity_logs"
  FOR EACH ROW EXECUTE FUNCTION activity_logs_append_only();

CREATE TRIGGER activity_logs_no_delete
  BEFORE DELETE ON "activity_logs"
  FOR EACH ROW EXECUTE FUNCTION activity_logs_append_only();

-- Nilai persentase dan nominal termin tidak boleh negatif. Aturan total 100%
-- dicek aplikasi (src/lib/finance/terms.ts) karena berlaku per project.
ALTER TABLE "terms"
  ADD CONSTRAINT "terms_percentage_range" CHECK ("percentage" > 0 AND "percentage" <= 100),
  ADD CONSTRAINT "terms_amount_non_negative" CHECK ("amount" >= 0),
  ADD CONSTRAINT "terms_sequence_positive" CHECK ("sequence" >= 1);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_target_order" CHECK ("targetEnd" >= "targetStart");

ALTER TABLE "periods"
  ADD CONSTRAINT "periods_date_order" CHECK ("endDate" > "startDate");

ALTER TABLE "project_stages"
  ADD CONSTRAINT "project_stages_stage_range" CHECK ("stage" BETWEEN 1 AND 9);

-- Satu penugasan aktif untuk PM dan Finance POC per project. Developer boleh
-- lebih dari satu, tetapi orang yang sama tidak ditugaskan dua kali bersamaan.
CREATE UNIQUE INDEX "project_assignments_single_active_pm"
  ON "project_assignments" ("projectId", "role")
  WHERE "endedAt" IS NULL AND "role" IN ('PM', 'FINANCE_POC');

CREATE UNIQUE INDEX "project_assignments_single_active_member"
  ON "project_assignments" ("projectId", "role", "userId")
  WHERE "endedAt" IS NULL;

-- Satu pengajuan menunggu per dokumen. Menjamin "satu alur aktif" dan membuat
-- pengajuan ganda karena klik dua kali ditolak basis data.
CREATE UNIQUE INDEX "submissions_single_pending"
  ON "submissions" ("documentId")
  WHERE "status" = 'PENDING';
