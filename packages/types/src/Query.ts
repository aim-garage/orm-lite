import { SelectExpression, WhereExpression } from "./Query.Expressions";

export interface QueryState<T> {
    where?: WhereExpression<T>;

    select?: SelectExpression<T>;

    // orderBy?: OrderExpression[];

    limit?: number;

    offset?: number;
}

export interface CompiledQuery {
    sql: string;
    params: unknown[];
}
