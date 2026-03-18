import { logger } from "../../lib/logger.ts";
import { syncAction } from "../../workspace/tools/knowledge/sync.ts";

async function main() {
  logger.info("Cron: starting knowledge sync");
  const result = await syncAction({});
  if (result.success) {
    logger.info({ data: result.data }, "Cron: sync complete");
  } else {
    logger.error({ error: result.error }, "Cron: sync failed");
    process.exit(1);
  }
}

main();
