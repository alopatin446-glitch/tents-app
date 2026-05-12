const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.client.findMany({
    take: 10,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      fio: true,
      status: true,
      isPriceLocked: true,
      priceLockedAt: true,
      geometrySnapshot: true,
    },
  });

  console.table(
    rows.map((r) => ({
      id: r.id,
      fio: r.fio,
      status: r.status,
      isPriceLocked: r.isPriceLocked,
      priceLockedAt: r.priceLockedAt ? 'YES' : 'NO',
      hasGeometrySnapshot: !!r.geometrySnapshot,
      snapshotVersion: r.geometrySnapshot?.version ?? null,
      snapshotSource: r.geometrySnapshot?.source ?? null,
      windowsCount: r.geometrySnapshot?.windows
        ? Object.keys(r.geometrySnapshot.windows).length
        : 0,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });