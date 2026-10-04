import { CompiledQuery, DatabaseDriver, EntityMeta, QueryState, SelectExpression, SelectResult } from "@orm-lite/types";
import { WhereExpression } from '@orm-lite/types';

export class Queryable<TEntity, TResult = TEntity> {
  constructor(
    private readonly driver: DatabaseDriver,
    private readonly metadata: EntityMeta,
    private readonly state: QueryState<TEntity> = {},
  ) {
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

  toSql(): CompiledQuery {
    return this.driver.compiler.compileSelect(
      this.metadata,
      this.state,
    );
  }

  toList(): Promise<TResult[]> {
    const { sql, params } = this.driver.compiler.compileSelect(
      this.metadata,
      this.state,
    );
    return this.driver.all<TResult>(sql, params);
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