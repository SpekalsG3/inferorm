import { CliCommand, CliOptions } from "../../types";
import {getDB} from "../../../utils/get-db";
import { Database } from "sqlite";
import { MigrationsList } from "../../../migrations";

const RollbackOptions: CliOptions = {
  count: {
    description: "Number of migrations to rollback",
    value_placeholders: ["u32"],
  },
  name: {
    description: "Name of migration to rollback up to",
    value_placeholders: ["text"],
  },
  all: {
    description: "Rollback all migrations",
    value_placeholders: [],
  },
}

interface ParsedOptions {
  count?: number,
  name?: string,
  all: boolean,
}

async function execute(name: string, db: Database, options: ParsedOptions): Promise<void> {
  {
    let checkCount = 0
      + ((options.count  !== undefined) ? 1 : 0)
      + ((options.name   !== undefined) ? 1 : 0)
      + ( options.all                   ? 1 : 0)
    if (checkCount === 0) {
      throw new Error(`[${name}] At least one option is required: "count", "name" or "all"`)
    } else if (checkCount > 1) {
      throw new Error(`[${name}] cannot provide "count", "name" and "all" options simultaneously`);
    }
  }

  const history = await db.all<{
    id: number,
    public_id: string,
  }[]>("SELECT id, public_id FROM migration_history ORDER BY id ASC");

  let stop = history.length; // to prevent accidental rollback of all migrations
  if (options.all) {
    stop = 0;
  } else if (options.count !== undefined) {
    stop = history.length - options.count;
    if (stop < 0) {
      stop = 0;
    }
  } else if (options.name) {
    for (stop = 0; stop < history.length; stop++) {
      if (MigrationsList[stop].name === options.name) {
        break;
      }
    }
    if (stop === history.length) {
      throw new Error(`[${name}] Failed to find a migration for rollback with the name "${options.name}"`)
    }
  }

  let count = 0;
  for (let i = history.length - 1; i >= stop; i--) {
    const migration = MigrationsList[i];

    if (history[i].public_id !== migration.name) {
      throw new Error(`Order of migrations does not match migration history (${history[i].public_id} != ${migration.name})`)
    }

    await db.exec("BEGIN TRANSACTION");
    try {
      await db.exec(`DELETE FROM migration_history WHERE public_id = "${migration.name}"`);

      await migration.down(db);

      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }

    console.log(`[${name}] Rollback migration "${migration.name}"`);
    count += 1;
  }

  if (count === 0) {
    console.log(`[${name}] Rollbacked ${count} migrations`);
  }
}

export const RollbackCommand: CliCommand = {
  description: "Rollback",
  subcommands: {},

  getOptionsHelp(): CliOptions {
    return RollbackOptions;
  },

  async handler(name: string, argv: string[]): Promise<void> {
    const parsedOptions: ParsedOptions = {
      all: false,
    }

    const unknownOptions = [];
    for (let i = 0; i < argv.length; i++) {
      if (!argv[i].startsWith('-')) {
        throw new Error(`[${name}] Expected option but received command "${argv[i]}"`);
      }

      const option = argv[i].split('-').at(-1);
      switch (option) {
        case "count": {
          if (parsedOptions.count !== undefined) {
            throw new Error(`Received option "count" more then once`);
          }
          const count = Number(argv[++i]);
          if (isNaN(count)) {
            throw new Error(`Invalid value provided for option "count": ${argv[i]}`);
          }
          parsedOptions.count = count;
          break;
        }
        case "name": {
          if (parsedOptions.name !== undefined) {
            throw new Error(`Received option "name" more then once`);
          }
          parsedOptions.name = argv[++i];
          break;
        }
        case "all": {
          if (parsedOptions.all) {
            throw new Error(`Received option "all" more then once`);
          }
          parsedOptions.all = true;
          break;
        }
        default: {
          unknownOptions.push(argv)
        }
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
      await execute(name, db, parsedOptions);
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
