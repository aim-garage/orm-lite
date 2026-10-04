import { DatabaseDriver } from "@orm-lite/types";
import { EntityClass, EntityRepositories, Repository } from "./Repository";
import { getEntityMetadata } from "./Decorators";

// 1. The underlying implementation class
class DatabaseBase<TEntities extends Record<string, EntityClass<any>>> {
  private repositoryCache = new Map<string, Repository<any>>();

  constructor(
    public readonly connection: DatabaseDriver,
    private readonly entities: TEntities,
  ) {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // DatabaseBase properties/methods
        if (
          typeof prop === "string" &&
          prop in target
        ) {
          const value = Reflect.get(
            target,
            prop,
            receiver,
          );

          return typeof value === "function"
            ? value.bind(target)
            : value;
        }

        // Entity repository
        if (
          typeof prop === "string" &&
          prop in target.entities
        ) {
          const key = prop as Extract<keyof TEntities, string>;

          let repository = target.repositoryCache.get(key);

          if (!repository) {
            const EntityCtor = target.entities[key];
            const metadata = getEntityMetadata(EntityCtor);

            repository = new Repository(
              target.connection,
              metadata
            );

            target.repositoryCache.set(key, repository);
          }

          return repository;
        }
        return Reflect.get(
          target,
          prop,
          receiver,
        );
      },
    }) as DatabaseBase<TEntities>;
  }

  async syncAll(): Promise<void> {
    // for (const key of Object.keys(this.entities)) {
    //   const repo = (this as any)[key] as Repository<any>;
    //   if (repo && typeof repo.syncTable === "function") {
    //     await repo.syncTable();
    //   }
    // }
    // for (const key of Object.keys(
    //   this.entities,
    // ) as Array<keyof TEntities>) {
    //   const repository =
    //     this.repositoryCache.get(key);

    //   if (
    //     repository &&
    //     typeof repository.syncTable === "function"
    //   ) {
    //     await repository.syncTable();
    //   }
    // }
  }

  async close(): Promise<void> {
    await this.connection.close();
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
