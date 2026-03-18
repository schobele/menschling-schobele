#!/usr/bin/env bun
import { Command } from "commander";
import { discoverDomains } from "./shared/registry";

const program = new Command()
  .name("mensch")
  .description("Menschling agent toolbox")
  .version("0.1.0")
  .configureHelp({ sortSubcommands: true, showGlobalOptions: true });

await discoverDomains(program);
program.parse();
