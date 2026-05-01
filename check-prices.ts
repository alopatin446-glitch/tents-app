import { prisma } from './src/lib/prisma';

async function main() {
    const prices = await prisma.price.findMany({
        where: {},
        orderBy: [
            { category: 'asc' },
            { slug: 'asc' },
        ],
        select: {
            slug: true,
            name: true,
            value: true,
            unit: true,
            category: true,
            organizationId: true,
        },
    });

    console.table(prices);
}

main()
    .catch((error) => {
        console.error(error);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });