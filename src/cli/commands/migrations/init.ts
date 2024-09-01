import {CliCommand, CliOptions} from "../../types";
import {getDB} from "../../../utils/get-db";

export const InitCommand: CliCommand = {
  description: "Initialize database",
  subcommands: {},

  getOptionsHelp(): CliOptions {
    return {};
  },

  async handler(name: string, argv: string[]): Promise<void> {
    const unknownOptions = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i].startsWith('-')) {
        unknownOptions.push(argv)
      }
    }
    if (unknownOptions.length > 0) {
      throw new Error(`Unknown options: ${unknownOptions.join(', ')}`)
    }

    const db = await getDB();
    await db.run("CREATE TABLE migration_history (" +
      "id INTEGER PRIMARY KEY NOT NULL" +
      ",public_id TEXT NOT NULL UNIQUE" +
      ")");
    console.log(`[${name}] Created "migration_history" table`);
    await db.run("CREATE TABLE migration_lock (" +
      "is_locked INTEGER NOT NULL" +
      ")");
    console.log(`[${name}] Created "migration_lock" table`);
    await db.run("INSERT INTO migration_lock VALUES (" +
      "0" +
      ")");
    console.log(`[${name}] Set migration lock to false`);
  }
}
