/*
  Warnings:

  - Added the required column `updatedAt` to the `ClientFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientFile" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "ClientFile_clientId_sortOrder_idx" ON "ClientFile"("clientId", "sortOrder");
