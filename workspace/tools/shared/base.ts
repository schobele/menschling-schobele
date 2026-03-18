import { logger } from "../../../lib/logger";
import { MenschError } from "../../../lib/errors";
import type { CommandResult } from "../../../lib/types";

export type { CommandResult };

export function output<T>(result: CommandResult<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.success ? 0 : 1);
}

export function handler<TFlags>(
  fn: (flags: TFlags) => Promise<CommandResult>
): (flags: TFlags) => Promise<void> {
  return async (flags: TFlags) => {
    try {
      output(await fn(flags));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof MenschError ? err.code : "UNKNOWN_ERROR";
      logger.error({ err, code }, "Command failed");
      output({ success: false, error: message, code });
    }
  };
}
