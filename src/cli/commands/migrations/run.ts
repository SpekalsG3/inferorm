import { CliCommand, CliOptions } from "../../types";
import {getDB} from "../../../utils/get-db";
import { Database } from "sqlite";
import { MigrationsList } from "../../../migrations";

async function execute(name: string, db: Database): Promise<void> {
  const history = await db.all<{
    id: number,
    public_id: string,
  }[]>("SELECT id, public_id FROM migration_history ORDER BY id ASC");

  let count = 0;
  const migrationToIndex: { [name: string]: number } = {};
  for (let i = 0; i < MigrationsList.length; i++) {
    const migration = MigrationsList[i];
    if (migration.name in migrationToIndex) {
      throw new Error(`Already executed migration with the name "${migration.name}" with index ${i}`)
    }
    migrationToIndex[migration.name] = i;

    if (i < history.length) {
      if (history[i].public_id !== migration.name) {
        throw new Error(`Order of migrations does not match migration history (${history[i].public_id} != ${migration.name})`)
      } else {
        continue
      }
    }

    await db.exec("BEGIN TRANSACTION");
    try {
      await db.exec("INSERT INTO migration_history (public_id) VALUES (" +
        `"${migration.name}"` +
        ")");

      await migration.up(db);

      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }

    console.log(`[${name}] Executed migration "${migration.name}"`);
    count += 1;
  }

  if (count === 0) {
    console.log(`[${name}] Executed ${count} migrations`);
  }
}

export const RunCommand: CliCommand = {
  description: "Run migrations",
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

    {
      const setLock = await db.get<{
        count: number,
      }>("UPDATE migration_lock SET is_locked = 0 RETURNING (SELECT count(*)) AS count");
      if (setLock === undefined || setLock.count != 1) {
        throw new Error("Failed to set migration lock");
      }
    }

    let error = null;
    try {
      await execute(name, db);
    } catch (e) {
      error = e;
    }

    {
      const freeLock = await db.get<{
        count: number,
      }>("UPDATE migration_lock SET is_locked = 1 RETURNING (SELECT count(*)) AS count");
      if (freeLock === undefined || freeLock.count != 1) {
        throw new Error("Failed to free migration lock");
      }
    }

    if (error !== null) {
      throw error;
    }
  }
}
