import { ColumnMeta, ColumnOptions, EntityMeta, EntityOptions } from "@orm-lite/types";

// 1. A unique internal symbol
export const METADATA_KEY = Symbol("ENTITY_METADATA");

function getOrCreateMeta(target: any): EntityMeta {
  if (!target[METADATA_KEY]) {
    target[METADATA_KEY] = {
      tableName: "",
      columns: [],
      virtuals: [],
    };
  }
  return target[METADATA_KEY];
}

// 4. Inspection function
export function getEntityMetadata(entityClass: any): EntityMeta {
  // Instantiate once to trigger field initializers
  new entityClass();

  const metadata: EntityMeta | undefined = entityClass[METADATA_KEY];

  if (!metadata || !metadata.name) {
    throw new Error(`Class ${entityClass.name} has no @Entity metadata.`);
  }

  return metadata;
}

// 2. Class Decorator
export function Entity(options: EntityOptions = {}) {
  return function <T extends abstract new (...args: any[]) => any>(
    target: T,
    _context: ClassDecoratorContext<T>,
  ) {
    const meta = getOrCreateMeta(target);
    meta.name = options.name ?? target.name;
    meta.createTable = options.createTable ?? false;
    return target;
  };
}

// 3. Field Decorator
export function Column(options: ColumnOptions) {
  return function (value: undefined, context: ClassFieldDecoratorContext) {
    const propertyKey = String(context.name);

    // context.addInitializer runs in the context of the constructor/instance
    context.addInitializer(function (this: any) {
      // For instance fields, this.constructor is the class
      const ctor = this.constructor;
      const meta = getOrCreateMeta(ctor);

      if (!meta.columns) {
        meta.columns = [];
      }
      // Prevent duplicate registration
      if (
        meta.columns.some(
          (column: ColumnMeta) => column.property === propertyKey,
        )
      ) {
        return;
      }

      // Prevent duplicate registration if instantiated multiple times
      meta.columns.push({
        property: propertyKey,
        name: options.name ?? propertyKey,
        type: options.type,
        primaryKey: options.primaryKey ?? false,
        nullable: options.nullable ?? true,
        unique: options.unique ?? false,
        default: options.default,
        autoIncrement: options.autoIncrement ?? false,
      });
    });

    return function (this: any, initialValue: any) {
      return initialValue;
    };
  };
}
export function Virtual() {
  return function (
    _value: () => unknown,
    context: ClassGetterDecoratorContext,
  ): void {
    const propertyKey = String(context.name);

    context.addInitializer(function (this: any) {
      const ctor = this.constructor as Function;
      const meta = getOrCreateMeta(ctor);

      if (meta.virtuals.some((virtual) => virtual.property === propertyKey)) {
        return;
      }

      meta.virtuals.push({
        property: propertyKey,
      });
    });
  };
}
