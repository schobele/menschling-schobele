import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { healthAction } from "./health.ts";
import { envAction } from "./env.ts";
import { manifestAction } from "./manifest.ts";
import { shutdownAction } from "./shutdown.ts";

export function register(program: Command): void {
  const system = program.command("system").description("Workspace introspection");

  system
    .command("health")
    .description("Check service connectivity")
    .action(handler(healthAction));

  system
    .command("env")
    .description("Show loaded config (redacted)")
    .action(handler(envAction));

  system
    .command("manifest")
    .description("Knowledge manifest stats")
    .option("--stats", "Include detailed stats")
    .action(handler(manifestAction));

  system
    .command("shutdown")
    .description("Commit and push all workspace changes (graceful shutdown)")
    .action(handler(shutdownAction));
}
