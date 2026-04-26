-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "fio" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'negotiation',
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentType" TEXT,
    "measurementDate" TIMESTAMP(3),
    "installDate" TIMESTAMP(3),
    "items" JSONB,
    "mountingConfig" JSONB,
    "managerComment" TEXT,
    "engineerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
