const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const list = await prisma.dailyStrategy.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  list.forEach((l, i) => {
    console.log(`[${i}] ID: ${l.id}, Date: ${l.strategyDate}, deductionPipelineJson:`, l.deductionPipelineJson?.slice(0, 160));
  });
}

main().finally(() => prisma.$disconnect());
