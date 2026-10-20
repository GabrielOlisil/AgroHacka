import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

export type SqlValue = string | number | null;
export interface Statement {
  sql: string;
  values?: SqlValue[];
}
export interface SqlDatabase {
  select<T>(sql: string, values?: SqlValue[]): Promise<T[]>;
  execute(sql: string, values?: SqlValue[]): Promise<void>;
  transaction(statements: Statement[]): Promise<void>;
}

export async function openDatabase(): Promise<SqlDatabase> {
  const db = await Database.load("sqlite:agrohacka.db");
  return {
    select: <T>(sql: string, values: SqlValue[] = []) =>
      db.select<T[]>(sql, values),
    async execute(sql, values = []) {
      await db.execute(sql, values);
    },
    // BEGIN/COMMIT separados no plugin podem usar conexões diferentes do pool.
    // O comando Rust mantém todas as instruções na mesma transação SQLx.
    transaction: (statements) => invoke("execute_transaction", { statements }),
  };
}
