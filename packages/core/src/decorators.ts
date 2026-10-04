import { ColumnMeta, EntityMeta } from "./types";

// 1. A unique internal symbol
export const METADATA_KEY = Symbol("ENTITY_METADATA");

function getOrCreateMeta(target: any): EntityMeta {
  if (!target[METADATA_KEY]) {
    target[METADATA_KEY] = {
      tableName: "",
      columns: [],
    };
  }
  return target[METADATA_KEY];
}

// 4. Inspection function
export function getEntityMetadata(entityClass: any): EntityMeta {
  // Instantiate once to trigger field initializers
  new entityClass();

  const metadata: EntityMeta | undefined = entityClass[METADATA_KEY];

  if (!metadata || !metadata.tableName) {
    throw new Error(`Class ${entityClass.name} has no @Entity metadata.`);
  }

  return metadata;
}

// 2. Class Decorator
export function Entity(tableName: string) {
  return function <T extends abstract new (...args: any[]) => any>(
    target: T,
    _context: ClassDecoratorContext<T>,
  ) {
    const meta = getOrCreateMeta(target);
    meta.tableName = tableName;
    return target;
  };
}

// 3. Field Decorator
export function Column(options: { type: string; primary?: boolean }) {
  return function (value: undefined, context: ClassFieldDecoratorContext) {
    const propertyKey = String(context.name);

    // context.addInitializer runs in the context of the constructor/instance
    context.addInitializer(function (this: any) {
      // For instance fields, this.constructor is the class
      const ctor = this.constructor;
      const meta = getOrCreateMeta(ctor);

      // Prevent duplicate registration if instantiated multiple times
      if (!meta.columns?.some((c: ColumnMeta) => c.property === propertyKey)) {
        meta.columns?.push({
          property: propertyKey,
          ...options,
        });
      }
    });

    return function (this: any, initialValue: any) {
      return initialValue;
    };
  };
}
