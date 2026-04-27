/*
  Warnings:

  - A unique constraint covering the columns `[slug,organizationId]` on the table `Price` will be added. If there are existing duplicate values, this will fail.
  - Made the column `organizationId` on table `CalendarEvent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `Client` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `Price` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `TeamMember` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CalendarEvent" DROP CONSTRAINT "CalendarEvent_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Price" DROP CONSTRAINT "Price_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_organizationId_fkey";

-- AlterTable
ALTER TABLE "CalendarEvent" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Price" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeamMember" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Price_slug_organizationId_key" ON "Price"("slug", "organizationId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
