import { DatabaseDriver } from "@orm-lite/types";
import { Repository } from "./repository";
import { EntityClass, EntityRepositories } from "./types";

// 1. The underlying implementation class
class DatabaseBase<TEntities extends Record<string, EntityClass<any>>> {
  private repositoryCache = new Map<string, Repository<any>>();

  constructor(
    public readonly connection: DatabaseDriver,
    private readonly entities: TEntities,
  ) {
    return new Proxy(this, {
      get(target: any, prop: string | symbol, receiver: any) {
        // Return class methods/properties if they exist on the instance
        if (prop in target) {
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        }

        // Lazily create and cache repository for entity names
        if (typeof prop === "string" && prop in target.entities) {
          if (!target.repositoryCache.has(prop)) {
            const EntityCtor = target.entities[prop];
            target.repositoryCache.set(
              prop,
              new Repository(EntityCtor, target.connection),
            );
          }
          return target.repositoryCache.get(prop);
        }

        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async syncAll(): Promise<void> {
    for (const key of Object.keys(this.entities)) {
      const repo = (this as any)[key] as Repository<any>;
      if (repo && typeof repo.syncTable === "function") {
        await repo.syncTable();
      }
    }
  }

  async close(): Promise<void> {
    // await this.connection.close();
  }
}

// 2. Define the constructor signature that tells TypeScript about the dynamic repository properties
export type OrmLiteDatabaseType = {
  new <TEntities extends Record<string, EntityClass<any>>>(
    connection: DatabaseDriver,
    entities: TEntities,
  ): DatabaseBase<TEntities> & EntityRepositories<TEntities>;
};

// Declaration merging: tells TypeScript that Database instances carry the entity repositories
// 3. Export as Database
export const OrmLiteDatabase = DatabaseBase as unknown as OrmLiteDatabaseType;

export type OrmLiteDatabase<T extends Record<string, EntityClass<any>>> =
  DatabaseBase<T> & EntityRepositories<T>;
