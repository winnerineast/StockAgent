const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeNonCompliantStrategies() {
  const allStrategies = await prisma.dailyStrategy.findMany();
  console.log(`Found ${allStrategies.length} total strategy records.`);

  let deletedCount = 0;
  for (const s of allStrategies) {
    let isValid = false;
    if (s.deductionPipelineJson) {
      try {
        const pipeline = JSON.parse(s.deductionPipelineJson);
        if (
          pipeline &&
          Array.isArray(pipeline.traces) &&
          pipeline.traces.length > 0 &&
          pipeline.traces.every((t) => t.id && t.agentRole && t.userPrompt && !t.userPrompt.includes("[Map-Reduce Chunked Pipeline Execute"))
        ) {
          isValid = true;
        }
      } catch (e) {}
    }

    if (!isValid) {
      // 删除关联的 retrospectives (如果存在外键) 或直接删除该 strategy
      try {
        await prisma.strategyRetrospective.deleteMany({
          where: { strategyId: s.id },
        });
      } catch (e) {}

      await prisma.dailyStrategy.delete({
        where: { id: s.id },
      });
      deletedCount++;
      console.log(`Deleted non-compliant strategy: ${s.id} (${s.strategyDate})`);
    }
  }

  console.log(`Successfully purged ${deletedCount} non-compliant strategy records. Remaining: ${allStrategies.length - deletedCount}`);
}

purgeNonCompliantStrategies()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
