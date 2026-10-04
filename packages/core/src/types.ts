import { Repository } from "./repository";

export interface ColumnMeta {
  property: string;
  type: string;
  primary?: boolean;
}

export interface EntityMeta {
  tableName?: string;
  columns?: ColumnMeta[];
}

export type EntityClass<T extends object = object> = new (...args: any[]) => T;

// Mapped type resolving each entity key to its corresponding Repository<Entity>
export type EntityRepositories<T extends Record<string, EntityClass<any>>> = {
  [K in keyof T]: Repository<InstanceType<T[K]>>;
};
