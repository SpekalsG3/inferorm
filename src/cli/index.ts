import { MainCommand } from "./commands";

async function cli() {
  const argv = process.argv;
  const commandName = ['cli'];

  let i = 2;
  let command = MainCommand;
  for (i; i < argv.length; i++) {
    const str = argv[i];
    if (str.startsWith("-")) {
      break;
    }

    command = command.subcommands[str];
    if (command === undefined) {
      throw new Error(`[${commandName.join(' ')}]: Unknown command "${str}"`)
    }
    commandName.push(str);
  }
  const name = commandName.join(' ');
  try {
    await command.handler(name, argv.slice(i))
  } catch (e) {
    throw new Error(`[${name}]: ${e}`);
  }
}

cli()
  .then(() => console.log("\nMigration CLI successful!"))
  .catch((e) => console.log(`Migration CLI failed\n\n${e}`));
