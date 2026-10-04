import { AndExpression, CompiledQuery, EntityMeta, NotExpression, OrderExpression, OrExpression, QueryCompiler, QueryState, SelectExpression, WhereExpression } from "@orm-lite/types";

type OperatorHandler = (
    column: string,
    value: unknown,
    params: unknown[],
) => string;

const OPERATORS: Record<string, OperatorHandler> = {
    eq: (col, val, params) => {
        if (val === null) return `${col} IS NULL`;
        params.push(val);
        return `${col} = ?`;
    },
    ne: (col, val, params) => {
        if (val === null) return `${col} IS NOT NULL`;
        params.push(val);
        return `${col} <> ?`;
    },
    gt: (col, val, params) => (params.push(val), `${col} > ?`),
    gte: (col, val, params) => (params.push(val), `${col} >= ?`),
    lt: (col, val, params) => (params.push(val), `${col} < ?`),
    lte: (col, val, params) => (params.push(val), `${col} <= ?`),
    in: (col, val, params) => {
        if (!Array.isArray(val)) throw new Error("in requires an array.");
        if (val.length === 0) return "1 = 0";
        params.push(...val);
        return `${col} IN (${val.map(() => "?").join(", ")})`;
    },
    notIn: (col, val, params) => {
        if (!Array.isArray(val)) throw new Error("notIn requires an array.");
        if (val.length === 0) return "1 = 1";
        params.push(...val);
        return `${col} NOT IN (${val.map(() => "?").join(", ")})`;
    },
    between: (col, val, params) => {
        if (!Array.isArray(val) || val.length !== 2) {
            throw new Error("between requires exactly two values.");
        }
        params.push(val[0], val[1]);
        return `${col} BETWEEN ? AND ?`;
    },
    contains: (col, val, params) => (params.push(`%${String(val)}%`), `${col} LIKE ?`),
    startsWith: (col, val, params) => (params.push(`${String(val)}%`), `${col} LIKE ?`),
    endsWith: (col, val, params) => (params.push(`%${String(val)}`), `${col} LIKE ?`),
    isNull: (col, val) => (val ? `${col} IS NULL` : `${col} IS NOT NULL`),
    isNotNull: (col, val) => (val ? `${col} IS NOT NULL` : `${col} IS NULL`),
};

export class SqlQueryCompiler implements QueryCompiler {
    compileCreateTable(
        metadata: EntityMeta,
    ): CompiledQuery {
        if (!metadata.name) {
            throw new Error("Table name missing.");
        }

        if (!metadata.columns?.length) {
            throw new Error(
                `No columns defined for table "${metadata.name}".`,
            );
        }

        const columns = metadata.columns.map(
            (column) => {

                let sql =
                    `${this.quoteIdentifier(column.name)} ${column.type}`;

                if (column.primaryKey) {
                    sql += " PRIMARY KEY";
                }

                if (column.unique) {
                    sql += " UNIQUE";
                }

                if (!column.nullable) {
                    sql += " NOT NULL";
                }

                if (column.default !== undefined) {
                    sql += " DEFAULT " +
                        this.compileDefaultValue(
                            column.default,
                        );
                }

                return sql;
            },
        );

        const sql =
            `CREATE TABLE IF NOT EXISTS ` +
            `${this.quoteIdentifier(metadata.name)} ` +
            `(${columns.join(", ")})`;

        return {
            sql,
            params: [],
        };
    };

    compileInsert<T>(
        metadata: EntityMeta,
        values: T | T[],
    ): CompiledQuery {
        if (!metadata.name) {
            throw new Error("Table name missing.");
        }

        const rows = Array.isArray(values)
            ? values
            : [values];

        if (rows.length === 0) {
            throw new Error(
                "Cannot insert an empty collection.",
            );
        }

        const firstRow =
            rows[0] as Record<string, unknown>;

        const properties =
            Object.keys(firstRow);

        if (properties.length === 0) {
            throw new Error(
                "Cannot insert an empty object.",
            );
        }

        const columns = properties.map(
            (property) =>
                this.getColumn(
                    metadata,
                    property,
                ),
        );

        const columnSql = columns
            .map((column) =>
                this.quoteIdentifier(column.name),
            )
            .join(", ");

        const params: unknown[] = [];

        const valueSql = rows.map(
            (row) => {
                const record =
                    row as Record<string, unknown>;

                // Ensure every row has the same columns.
                for (const property of properties) {
                    if (!(property in record)) {
                        throw new Error(
                            `Missing property "${property}" ` +
                            `in bulk insert row.`,
                        );
                    }
                }

                const placeholders =
                    properties.map((property) => {
                        params.push(record[property]);
                        return "?";
                    });

                return `(${placeholders.join(", ")})`;
            },
        );

        const sql =
            `INSERT INTO ${this.quoteIdentifier(
                metadata.name,
            )} ` +
            `(${columnSql}) VALUES ` +
            valueSql.join(", ");

        return {
            sql,
            params,
        };
    }

    // =========================================================
    // SELECT
    // =========================================================

    compileSelect<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
    ): CompiledQuery {
        if (!metadata.name) throw "table name missing";

        const params: unknown[] = [];

        const columns = this.compileSelectColumns(
            metadata,
            state.select,
        );

        let sql = `SELECT ${columns}`;
        sql += ` FROM ${this.quoteIdentifier(metadata.name)}`;

        if (state.where) {
            const where = this.compileWhere(
                metadata,
                state.where,
                params,
            );

            if (where) {
                sql += ` WHERE ${where}`;
            }
        }

        if (state.orderBy) {
            const order = this.compileOrderBy<T>(
                state.orderBy,
            );

            if (order) {
                sql += ` ${order}`;
            }
        }

        if (state.limit !== undefined) {
            sql += ` LIMIT ?`;
            params.push(state.limit);
        }

        if (state.offset !== undefined) {
            /*
             * SQLite allows OFFSET only together with LIMIT.
             *
             * If only skip() was specified, use:
             *
             * LIMIT -1 OFFSET ?
             */
            if (state.limit === undefined) {
                sql += ` LIMIT -1`;
            }

            sql += ` OFFSET ?`;
            params.push(state.offset);
        }

        return {
            sql,
            params,
        };
    }

    // =========================================================
    // COUNT
    // =========================================================

    compileCount<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
    ): CompiledQuery {
        if (!metadata.name) throw "table name missing";

        const params: unknown[] = [];

        let sql =
            `SELECT COUNT(*) AS "count"` +
            ` FROM ${this.quoteIdentifier(metadata.name)}`;

        if (state.where) {
            const where = this.compileWhere(
                metadata,
                state.where,
                params,
            );

            if (where) {
                sql += ` WHERE ${where}`;
            }
        }

        return {
            sql,
            params,
        };
    }

    // =========================================================
    // UPDATE
    // =========================================================

    compileUpdate<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
        values: Partial<T>,
    ): CompiledQuery {
        if (!metadata.name) throw "table name missing";

        const params: unknown[] = [];

        const entries = Object.entries(values);

        if (entries.length === 0) {
            throw new Error(
                "Cannot compile UPDATE without values.",
            );
        }

        const assignments = entries.map(
            ([property, value]) => {
                const column = this.getColumn(
                    metadata,
                    property,
                );

                params.push(value);

                return `${this.quoteIdentifier(
                    column.name,
                )} = ?`;
            },
        );

        let sql =
            `UPDATE ${this.quoteIdentifier(
                metadata.name,
            )}`;

        sql += ` SET ${assignments.join(", ")}`;

        if (state.where) {
            const where = this.compileWhere(
                metadata,
                state.where,
                params,
            );

            if (where) {
                sql += ` WHERE ${where}`;
            }
        }

        return {
            sql,
            params,
        };
    }

    // =========================================================
    // DELETE
    // =========================================================

    compileDelete<T>(
        metadata: EntityMeta,
        state: QueryState<T>,
    ): CompiledQuery {
        if (!metadata.name) throw "table name missing";

        const params: unknown[] = [];

        let sql =
            `DELETE FROM ${this.quoteIdentifier(
                metadata.name,
            )}`;

        if (state.where) {
            const where = this.compileWhere(
                metadata,
                state.where,
                params,
            );

            if (where) {
                sql += ` WHERE ${where}`;
            }
        }

        return {
            sql,
            params,
        };
    }

    // =========================================================
    // SELECT columns
    // =========================================================

    private compileSelectColumns<T>(
        metadata: EntityMeta,
        select?: SelectExpression<T>,
    ): string {
        // No select()
        //
        // SELECT *
        //
        if (!select) {
            return "*";
        }

        const properties =
            Object.keys(select);

        // select({})
        //
        // SELECT *
        //
        if (properties.length === 0) {
            return "*";
        }

        const columns = properties
            .filter(
                (property) =>
                    select[property as keyof T] === true,
            )
            .map((property) => {

                const column =
                    this.getColumn(
                        metadata,
                        property,
                    );

                return this.quoteIdentifier(
                    column.name,
                );
            });

        // Defensive case:
        //
        // select({ field: false })
        //
        if (columns.length === 0) {
            return "*";
        }

        return columns.join(", ");
    }

    // =========================================================
    // WHERE
    // =========================================================

    private compileWhere<T>(
        metadata: EntityMeta,
        expression: WhereExpression<T>,
        params: unknown[],
    ): string {
        const parts: string[] = [];

        // ----------------------------------------------------------
        // Field conditions
        // ----------------------------------------------------------

        for (
            const [property, condition]
            of Object.entries(expression)
        ) {

            if (
                property === "and" ||
                property === "or" ||
                property === "not"
            ) {
                continue;
            }

            if (condition === undefined) {
                continue;
            }

            const column =
                this.getColumn(
                    metadata,
                    property,
                );

            const sql =
                this.compileFieldCondition(
                    column.name,
                    condition,
                    params,
                );

            if (sql) {
                parts.push(sql);
            }
        }


        // ----------------------------------------------------------
        // AND
        // ----------------------------------------------------------
        if (this.isAndExpression(expression)) {
            const expressions = expression.and
                .map((item) =>
                    this.compileWhere(
                        metadata,
                        item,
                        params,
                    ),
                )
                .filter(
                    (sql): sql is string =>
                        Boolean(sql),
                );

            if (expressions.length > 0) {
                parts.push(
                    `(${expressions.join(" AND ")})`,
                );
            }
        }



        // ----------------------------------------------------------
        // OR
        // ----------------------------------------------------------

        if (this.isOrExpression(expression)) {

            const expressions = expression.or
                .map((item) =>
                    this.compileWhere(
                        metadata,
                        item,
                        params,
                    ),
                )
                .filter(
                    (sql): sql is string =>
                        Boolean(sql),
                );

            if (expressions.length > 0) {
                parts.push(
                    `(${expressions.join(" OR ")})`,
                );
            }
        }


        // ----------------------------------------------------------
        // NOT
        // ----------------------------------------------------------

        if (this.isNotExpression(expression)) {

            const inner = this.compileWhere(
                metadata,
                expression.not,
                params,
            );

            if (inner) {
                parts.push(
                    `NOT (${inner})`,
                );
            }
        }


        // ----------------------------------------------------------
        // Same-level fields are ANDed
        // ----------------------------------------------------------

        return parts.join(" AND ");
    }

    // =========================================================
    // Field condition
    // =========================================================

    private compileFieldCondition(
        columnName: string,
        condition: unknown,
        params: unknown[],
    ): string {
        const column = this.quoteIdentifier(columnName);

        if (condition === null) {
            return `${column} IS NULL`;
        }

        if (typeof condition !== "object") {
            params.push(condition);
            return `${column} = ?`;
        }

        const parts: string[] = [];

        for (const [operator, value] of Object.entries(
            condition as Record<string, unknown>,
        )) {
            const handler = OPERATORS[operator];
            if (!handler) {
                throw new Error(
                    `Unsupported where operator "${operator}".`,
                );
            }
            parts.push(handler(column, value, params));
        }

        if (parts.length === 0) {
            return "";
        }

        if (parts.length === 1) {
            return parts[0];
        }

        return `(${parts.join(" AND ")})`;
    }

    // =========================================================
    // ORDER BY
    // =========================================================

    private compileOrderBy<T>(
        orderBy?: OrderExpression<T>,
    ): string {
        if (!orderBy) {
            return "";
        }

        const columns: string[] = [];

        for (const [property, direction] of Object.entries(orderBy)) {
            if (!direction) {
                continue;
            }

            columns.push(
                `${this.quoteIdentifier(property)} ${direction}`,
            );
        }

        if (columns.length === 0) {
            return "";
        }

        return `ORDER BY ${columns.join(", ")}`;
    }

    // =========================================================
    // Metadata helpers
    // =========================================================

    private getColumn(
        metadata: EntityMeta,
        property: string,
    ) {
        const column = metadata.columns?.find(
            (column) =>
                column.property === property,
        );

        if (!column) {
            throw new Error(
                `Unknown property "${property}" on entity "${metadata.name}".`,
            );
        }

        return column;
    }

    // =========================================================
    // SQL identifier
    // =========================================================

    private quoteIdentifier(
        identifier: string,
    ): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }



    private isAndExpression<T>(
        expression: WhereExpression<T>,
    ): expression is AndExpression<T> {
        return (
            "and" in expression &&
            Array.isArray(expression.and)
        );
    }

    private isOrExpression<T>(
        expression: WhereExpression<T>,
    ): expression is OrExpression<T> {
        return (
            "or" in expression &&
            Array.isArray(expression.or)
        );
    }

    private isNotExpression<T>(
        expression: WhereExpression<T>,
    ): expression is NotExpression<T> {
        return (
            "not" in expression &&
            expression.not !== undefined &&
            typeof expression.not === "object"
        );
    }
    private compileDefaultValue(
        value: unknown,
    ): string {

        if (value === null) {
            return "NULL";
        }

        if (typeof value === "number") {
            return String(value);
        }

        if (typeof value === "boolean") {
            return value ? "1" : "0";
        }

        if (typeof value === "string") {
            return `'${value.replace(/'/g, "''")}'`;
        }

        throw new Error(
            `Unsupported default value: ${String(value)}`,
        );
    }
}