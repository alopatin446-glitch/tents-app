-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'INSTALLER';

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "phone" TEXT;
