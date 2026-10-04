import { EntityMeta } from "./Decorators";
import { CompiledQuery, QueryState } from "./Query";

export interface QueryCompiler {
    compileCreateTable(
        metadata: EntityMeta,
    ): CompiledQuery;

    compileInsert<T>(
        metadata: EntityMeta,
        values: T | T[],
    ): CompiledQuery;

    compileSelect<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
    ): CompiledQuery;

    compileCount<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
    ): CompiledQuery;

    compileUpdate<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
        values: Partial<T>,
    ): CompiledQuery;

    compileDelete<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
    ): CompiledQuery;
}