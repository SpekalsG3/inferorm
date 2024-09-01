import {CliCommand, CliOptions} from "../../types";
import {InitCommand} from "./init";
import {RunCommand} from "./run";
import {RollbackCommand} from "./rollback";

export const MigrationCommand: CliCommand = {
  description: "ORM functions",
  subcommands: {
    init: InitCommand,
    run: RunCommand,
    rollback: RollbackCommand,
  },

  async handler(name: string, argv: string[]): Promise<void> {
    throw new Error("Use help to get list of available commands");
  },

  getOptionsHelp(): CliOptions {
    return {}
  }
}
