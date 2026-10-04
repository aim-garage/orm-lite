import { AndExpression, CompiledQuery, EntityMeta, NotExpression, OrExpression, QueryCompiler, QueryState, SelectExpression, WhereExpression } from "@orm-lite/types";
// import { Select, Where } from "./sql.types";

export class SqlQueryCompiler implements QueryCompiler {
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

        // if (state.orderBy?.length) {
        //     sql += ` ORDER BY `;

        //     const orders: string[] = state.orderBy
        //         .map((order: OrderByExpression) =>
        //             this.compileOrderBy(
        //                 metadata,
        //                 order,
        //             ),
        //         )
        //         .filter(
        //             (sql: string | undefined): sql is string =>
        //                 Boolean(sql),
        //         );

        //     sql += orders.join(", ");
        // }

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
        // const parts: string[] = [];

        // /*
        //  * Field conditions
        //  *
        //  * {
        //  *   age: { gte: 21 },
        //  *   active: { eq: true }
        //  * }
        //  */
        // for (const [property, condition] of Object.entries(
        //     expression,
        // )) {
        //     if (
        //         property === "and" ||
        //         property === "or" ||
        //         property === "not"
        //     ) {
        //         continue;
        //     }

        //     if (condition === undefined) {
        //         continue;
        //     }

        //     const column = this.getColumn(
        //         metadata,
        //         property,
        //     );

        //     const sql = this.compileFieldCondition(
        //         column.name,
        //         condition as Record<string, unknown>,
        //         params,
        //     );

        //     if (sql) {
        //         parts.push(sql);
        //     }
        // }

        // /*
        //  * AND
        //  *
        //  * {
        //  *   and: [
        //  *     { age: { gte: 18 } },
        //  *     { active: { eq: true } }
        //  *   ]
        //  * }
        //  */
        // if (expression.and) {
        //     const expressions: string[] = expression.and
        //         .map((item: Where<any>) =>
        //             this.compileWhere(
        //                 metadata,
        //                 item,
        //                 params,
        //             ),
        //         )
        //         .filter(
        //             (sql: string | undefined): sql is string => Boolean(sql),
        //         );

        //     if (expressions.length > 0) {
        //         parts.push(
        //             `(${expressions.join(" AND ")})`,
        //         );
        //     }
        // }

        // /*
        //  * OR
        //  *
        //  * {
        //  *   or: [
        //  *     { role: { eq: "admin" } },
        //  *     { role: { eq: "manager" } }
        //  *   ]
        //  * }
        //  */
        // if (expression.or) {
        //     const expressions: string[] = expression.or
        //         .map((item: Where<any>) =>
        //             this.compileWhere(
        //                 metadata,
        //                 item,
        //                 params,
        //             ),
        //         )
        //         .filter(
        //             (sql: string | undefined): sql is string =>
        //                 Boolean(sql),
        //         );

        //     if (expressions.length > 0) {
        //         parts.push(
        //             `(${expressions.join(" OR ")})`,
        //         );
        //     }
        // }

        // /*
        //  * NOT
        //  *
        //  * {
        //  *   not: {
        //  *     active: { eq: true }
        //  *   }
        //  * }
        //  */
        // if (expression.not) {
        //     const inner = this.compileWhere(
        //         metadata,
        //         expression.not,
        //         params,
        //     );

        //     if (inner) {
        //         parts.push(`NOT (${inner})`);
        //     }
        // }

        // /*
        //  * All properties at the same level are ANDed.
        //  */
        // return parts.join(" AND ");
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
        condition: Record<string, unknown>,
        params: unknown[],
    ): string {
        const column = this.quoteIdentifier(
            columnName,
        );

        const parts: string[] = [];

        for (const [operator, value] of Object.entries(
            condition,
        )) {
            switch (operator) {
                // -----------------------------------------------
                // Equality
                // -----------------------------------------------

                case "eq":
                    if (value === null) {
                        parts.push(`${column} IS NULL`);
                    } else {
                        parts.push(`${column} = ?`);
                        params.push(value);
                    }
                    break;

                case "ne":
                    if (value === null) {
                        parts.push(`${column} IS NOT NULL`);
                    } else {
                        parts.push(`${column} <> ?`);
                        params.push(value);
                    }
                    break;

                // -----------------------------------------------
                // Comparison
                // -----------------------------------------------

                case "gt":
                    parts.push(`${column} > ?`);
                    params.push(value);
                    break;

                case "gte":
                    parts.push(`${column} >= ?`);
                    params.push(value);
                    break;

                case "lt":
                    parts.push(`${column} < ?`);
                    params.push(value);
                    break;

                case "lte":
                    parts.push(`${column} <= ?`);
                    params.push(value);
                    break;

                // -----------------------------------------------
                // IN
                // -----------------------------------------------

                case "in": {
                    const values = this.requireArray(
                        value,
                        "in",
                    );

                    if (values.length === 0) {
                        parts.push("1 = 0");
                        break;
                    }

                    const placeholders = values
                        .map(() => "?")
                        .join(", ");

                    parts.push(
                        `${column} IN (${placeholders})`,
                    );

                    params.push(...values);

                    break;
                }

                case "notIn": {
                    const values = this.requireArray(
                        value,
                        "notIn",
                    );

                    if (values.length === 0) {
                        parts.push("1 = 1");
                        break;
                    }

                    const placeholders = values
                        .map(() => "?")
                        .join(", ");

                    parts.push(
                        `${column} NOT IN (${placeholders})`,
                    );

                    params.push(...values);

                    break;
                }

                // -----------------------------------------------
                // BETWEEN
                // -----------------------------------------------

                case "between": {
                    if (
                        !Array.isArray(value) ||
                        value.length !== 2
                    ) {
                        throw new Error(
                            "between requires exactly two values.",
                        );
                    }

                    parts.push(
                        `${column} BETWEEN ? AND ?`,
                    );

                    params.push(value[0], value[1]);

                    break;
                }

                // -----------------------------------------------
                // String operators
                // -----------------------------------------------

                case "contains":
                    parts.push(
                        `${column} LIKE ?`,
                    );

                    params.push(`%${String(value)}%`);
                    break;

                case "startsWith":
                    parts.push(
                        `${column} LIKE ?`,
                    );

                    params.push(`${String(value)}%`);
                    break;

                case "endsWith":
                    parts.push(
                        `${column} LIKE ?`,
                    );

                    params.push(`%${String(value)}`);
                    break;

                // -----------------------------------------------
                // NULL
                // -----------------------------------------------

                case "isNull":
                    if (value) {
                        parts.push(`${column} IS NULL`);
                    } else {
                        parts.push(`${column} IS NOT NULL`);
                    }
                    break;

                case "isNotNull":
                    if (value) {
                        parts.push(`${column} IS NOT NULL`);
                    } else {
                        parts.push(`${column} IS NULL`);
                    }
                    break;

                default:
                    throw new Error(
                        `Unsupported where operator "${operator}".`,
                    );
            }
        }

        if (parts.length === 1) {
            return parts[0];
        }

        return `(${parts.join(" AND ")})`;
    }

    // =========================================================
    // ORDER BY
    // =========================================================

    // private compileOrderBy(
    //     metadata: EntityMeta,
    //     order: OrderByExpression,
    // ): string {
    //     const column = this.getColumn(
    //         metadata,
    //         order.field,
    //     );

    //     const direction =
    //         order.direction.toUpperCase();

    //     return (
    //         `${this.quoteIdentifier(column.columnName)} ` +
    //         direction
    //     );
    // }

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

    // =========================================================
    // Validation
    // =========================================================

    private requireArray(
        value: unknown,
        operator: string,
    ): unknown[] {
        if (!Array.isArray(value)) {
            throw new Error(
                `${operator} requires an array.`,
            );
        }

        return value;
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
}