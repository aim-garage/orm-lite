import { CompiledQuery, DatabaseDriver, EntityMeta, OrderExpression, QueryState, SelectExpression, SelectResult, WhereExpression } from "@orm-lite/types";

const tableSyncRegistry = new WeakMap<EntityMeta, Promise<void>>();

export class Queryable<TEntity, TResult = TEntity> {
  constructor(
    readonly driver: DatabaseDriver,
    readonly metadata: EntityMeta,
    private readonly state: QueryState<TEntity> = {},
  ) {
  }

  async ensureTable(): Promise<void> {
    if (!this.metadata.createTable) return;

    let syncPromise = tableSyncRegistry.get(this.metadata);
    if (!syncPromise) {
      syncPromise = (async () => {
        const query = this.driver.compiler.compileCreateTable(this.metadata);
        await this.driver.exec(query.sql);
      })();
      tableSyncRegistry.set(this.metadata, syncPromise);
    }
    return syncPromise;
  }

  where(
    expression: WhereExpression<TEntity>,
  ): Queryable<TEntity, TResult> {
    const where = this.state.where
      ? {
        and: [
          this.state.where,
          expression,
        ],
      }
      : expression;

    return this.clone({
      where,
    });
  }

  select<S extends SelectExpression<TEntity>>(
    fields?: S,
  ): Queryable<TEntity, SelectResult<TEntity, S>> {
    const select =
      fields && Object.keys(fields).length > 0
        ? fields
        : undefined;

    return new Queryable<
      TEntity,
      SelectResult<TEntity, S>
    >(
      this.driver,
      this.metadata,
      {
        ...this.state,
        select,
      },
    );
  }

  orderBy<O extends OrderExpression<TEntity>>(
    orderBy?: O,
  ): Queryable<TEntity, TResult> {
    return this.clone({
      orderBy,
    });
  }

  toSql(): CompiledQuery {
    return this.driver.compiler.compileSelect(
      this.metadata,
      this.state,
    );
  }

  async toList(): Promise<TResult[]> {
    // await this.ensureTable();
    const { sql, params } = this.driver.compiler.compileSelect(
      this.metadata,
      this.state,
    );
    return this.driver.all<TResult>(sql, params);
  }

  async first(): Promise<TResult | undefined> {
    // await this.ensureTable();
    const { sql, params } = this.driver.compiler.compileSelect(
      this.metadata,
      {
        ...this.state,
        limit: 1,
      },
    );
    return this.driver.get<TResult>(sql, params);
  }


  private clone(
    patch: Partial<QueryState<TEntity>>,
  ): Queryable<TEntity, TResult> {
    return new Queryable<TEntity, TResult>(
      this.driver,
      this.metadata,
      {
        ...this.state,
        ...patch,
      },
    );
  }
}