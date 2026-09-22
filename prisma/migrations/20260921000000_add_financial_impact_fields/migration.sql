-- AlterTable
ALTER TABLE "NonConformity" ADD COLUMN     "hasFinancialImpact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "financialImpactTarget" TEXT,
ADD COLUMN     "financialImpactAmount" DOUBLE PRECISION;
