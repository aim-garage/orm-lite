export type WhereExpression<T> =
    | FieldExpression<T>
    | AndExpression<T>
    | OrExpression<T>
    | NotExpression<T>;

export interface FieldExpression<T> {
    [field: string]: OperatorExpression<T>;
}

export interface AndExpression<T> {
    and: WhereExpression<T>[];
}

export interface OrExpression<T> {
    or: WhereExpression<T>[];
}

export interface NotExpression<T> {
    not: WhereExpression<T>;
}
export interface OperatorExpression<T> {
    eq?: unknown;
    ne?: unknown;
    gt?: unknown;
    gte?: unknown;
    lt?: unknown;
    lte?: unknown;
    in?: unknown[];
    notIn?: unknown[];
    between?: [unknown, unknown];

    contains?: string;
    startsWith?: string;
    endsWith?: string;

    isNull?: boolean;
    isNotNull?: boolean;
}
export type SelectExpression<T> = {
    [K in keyof T]?: boolean;
};


export type SelectResult<
    TEntity,
    S extends SelectExpression<TEntity>,
> = keyof S extends never
    ? TEntity
    : {
        [K in keyof S & keyof TEntity]: TEntity[K];
    };