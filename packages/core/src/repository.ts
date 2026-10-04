import { DatabaseDriver } from "@orm-lite/types";
import { EntityMeta } from "./types";
import { getEntityMetadata } from "./decorators";

export class Repository<T extends object> {
  metadata: EntityMeta;
  constructor(
    private entity: new () => T,
    private db: DatabaseDriver,
  ) {
    this.metadata = getEntityMetadata(this.entity);
  }

  async createTableSQL(entity: Function) {
    if (!this.metadata) {
      throw new Error("Entity not registered");
    }

    const columns =
      this.metadata.columns?.map((column) => {
        let sql = `"${column.property}" ${column.type}`;

        if (column.primary) {
          sql += " PRIMARY KEY";
        }

        return sql;
      }) ?? [];

    return `
    CREATE TABLE IF NOT EXISTS "${this.metadata.tableName}" (
      ${columns.join(",\n")}
    )
  `;
  }

  async findAll(): Promise<T[]> {
    if (!this.metadata) {
      throw new Error("Entity not registered");
    }
    const query = `SELECT * from ${this.metadata.tableName}`;
    return await this.db.findAll<T>(query);
  }

  async syncTable() {}
}
