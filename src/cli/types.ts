import {Database} from "sqlite";

export interface CliOption {
  value_placeholders: string[],
  description: string,
}

export type CliOptions = { [option: string]: CliOption };

export interface CliCommand {
  description: string,
  subcommands: { [command: string]: CliCommand }

  getOptionsHelp(): CliOptions,
  handler(name: string, argv: string[]): Promise<void>,
}

export interface Migration {
  name: string,
  up(db: Database): Promise<void>,
  down(db: Database): Promise<void>,
}

interface Option {
  name: string,
  parseValues(): unknown;
}

type InferOptions<T extends Option[]> = {
  [k in T[number]['name']]: ReturnType<T[number]['parseValues']>;
}
const options: Option[] = [{
  name: "name",
  parseValues(): string {
    return ""
  }
}];
type inf = InferOptions<typeof options>;
const x: inf = {

}
