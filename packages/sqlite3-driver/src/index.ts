import { DatabaseDriver } from "@orm-lite/types";
import sqlite3 from "sqlite3";

export class Sqlite3Driver implements DatabaseDriver {
  private db: sqlite3.Database;
  constructor(...args: ConstructorParameters<typeof sqlite3.Database>) {
    this.db = new sqlite3.Database(...args);
  }

  findAll<T>(sql: string): Promise<T[]> {
    // console.log(`[SQLite3 @ ${this.db.path}] Executing: ${sql}`);
    // console.log(`[MariaDB @ ${this.config.host}] Executing: ${sql}`);
    console.log(`[SQLite3] Executing: ${sql}`);
    return new Promise<T[]>((resolve, reject) => {
      this.db.all<T>(sql, (err, row) => {
        if (err) return reject(err);
        return resolve(row);
      });
    });
  }
}
