import { DatabaseDriver, QueryCompiler, RunResult } from "@orm-lite/types";
import sqlite3 from "sqlite3";
import { SqlQueryCompiler } from "./Sqlite3.Compiler";


export class Sqlite3Driver implements DatabaseDriver {
    private db: sqlite3.Database;
    compiler: QueryCompiler;

    constructor(...args: ConstructorParameters<typeof sqlite3.Database>) {
        this.db = new sqlite3.Database(...args);
        this.compiler = new SqlQueryCompiler();
    }

    run(sql: string, params?: unknown[]): Promise<RunResult> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, function (err) {
                if (err) return reject(err);
                resolve({
                    lastID: this.lastID,
                    changes: this.changes,
                });
            });
        });
    }
    exec(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    get<T>(sql: string, params: unknown): Promise<T> {
        // console.log(`[SQLite3 @ ${this.db.path}] Executing: ${sql}`);
        // console.log(`[MariaDB @ ${this.config.host}] Executing: ${sql}`);
        console.log(`[SQLite3] Executing: ${sql}`);
        return new Promise<T>((resolve, reject) => {
            this.db.get<T>(sql, params, (err, row) => {
                if (err) return reject(err);
                return resolve(row);
            });
        });
    }
    all<T>(sql: string, params: unknown[]): Promise<T[]> {
        // console.log(`[SQLite3 @ ${this.db.path}] Executing: ${sql}`);
        // console.log(`[MariaDB @ ${this.config.host}] Executing: ${sql}`);
        console.log(`[SQLite3] Executing: ${sql}`);
        return new Promise<T[]>((resolve, reject) => {
            this.db.all<T>(sql, params, (err, row) => {
                if (err) return reject(err);
                return resolve(row);
            });
        });
    }
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close(function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }
}
