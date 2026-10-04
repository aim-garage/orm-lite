import { DatabaseDriver, EntityMeta } from "@orm-lite/types";
import { Queryable } from "./Queryable";

export class Repository<T extends object> extends Queryable<T, T> {
  constructor(
    driver: DatabaseDriver,
    metadata: EntityMeta,
  ) {
    super(
      driver,
      metadata,
    );
    this.syncTable();
  }
  async syncTable(): Promise<void> {
    if (!this.metadata.createTable) return;

    const query =
      this.driver.compiler.compileCreateTable(
        this.metadata,
      );
    console.log(query);
    await this.driver.exec(query.sql);
  }
}

export type EntityClass<T extends object = object> = new (...args: any[]) => T;

// Mapped type resolving each entity key to its corresponding Repository<Entity>
export type EntityRepositories<T extends Record<string, EntityClass<any>>> = {
  [K in keyof T]: Repository<InstanceType<T[K]>>;
};
