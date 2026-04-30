-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "contentUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "createdByRole" TEXT,
ADD COLUMN     "lastOpenedAt" TIMESTAMP(3),
ADD COLUMN     "lastOpenedById" TEXT,
ADD COLUMN     "lastOpenedByName" TEXT,
ADD COLUMN     "lastOpenedByRole" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "updatedByName" TEXT,
ADD COLUMN     "updatedByRole" TEXT;
