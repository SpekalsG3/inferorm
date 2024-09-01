import { Database as DB, open } from "sqlite";
import { Database as Driver } from "sqlite3";

export async function getDB(): Promise<DB> {
  return open({
    filename: "./test.db",
    driver: Driver,
  });
}
