import { open } from "@op-engineering/op-sqlite";
import { getDirectory } from "@legend-apps/file-system";
export type { DB, QueryResult } from "@op-engineering/op-sqlite";
export async function openDatabase(name: string) {
  if (!/^[a-zA-Z0-9_-]+\.sqlite$/.test(name)) throw new Error("Database name must be a simple .sqlite filename");
  return open({ name, location: await getDirectory("data") });
}
