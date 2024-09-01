import { CliCommand, CliOptions } from "../types";
import { MigrationCommand } from "./migrations";

export const MainCommand: CliCommand = {
  description: "ORM functions",
  subcommands: {
    migrations: MigrationCommand,
  },

  async handler(name: string, argv: string[]): Promise<void> {
    throw new Error("Use help to get list of available commands");
  },

  getOptionsHelp(): CliOptions {
    return {}
  }
}
