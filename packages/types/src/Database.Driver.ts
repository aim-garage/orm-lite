import { QueryCompiler } from "./Query.Compiler";

export type RunResult = {
    lastID?: number;
    changes?: number;
};


export type DatabaseDriver = {
    compiler: QueryCompiler;

    run(sql: string, params?: unknown[]): Promise<RunResult>;

    get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;

    all<T>(sql: string, params?: unknown[]): Promise<T[]>;

    exec(sql: string): Promise<void>;

    close(): Promise<void>;
};