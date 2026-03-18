import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { syncAction } from "./sync.ts";
import { searchAction } from "./search.ts";
import { writeAction } from "./write.ts";
import { inspectAction } from "./inspect.ts";

export function register(program: Command): void {
  const knowledge = program.command("knowledge").description("Obsidian vault + vector store");

  knowledge
    .command("search")
    .description("Semantic search via OpenAI vector store")
    .requiredOption("--query <text>", "Search query")
    .option("--filter <key=value>", "Filter results")
    .option("--top <n>", "Max results", parseInt)
    .action(handler(searchAction));

  knowledge
    .command("sync")
    .description("Sync vault to OpenAI vector store")
    .option("--dry-run", "Preview changes without syncing")
    .option("--force", "Re-sync all files regardless of hash")
    .option("--path <subpath>", "Sync only files under this path")
    .action(handler(syncAction));

  knowledge
    .command("write")
    .description("Write a new knowledge document")
    .requiredOption("--path <path>", "Vault-relative path")
    .requiredOption("--title <title>", "Document title")
    .requiredOption("--category <cat>", "Category (inbox, projects, people, resources, log)")
    .requiredOption("--body <content>", "Document body (markdown)")
    .option("--tags <tags>", "Comma-separated tags")
    .action(handler(writeAction));

  knowledge
    .command("inspect")
    .description("Show manifest entry for a vault path")
    .requiredOption("--path <path>", "Vault-relative path")
    .action(handler(inspectAction));
}
