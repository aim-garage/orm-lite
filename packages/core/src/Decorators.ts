import { ColumnMeta, ColumnOptions, EntityMeta, EntityOptions } from "@orm-lite/types";

// 1. A unique internal symbol
export const METADATA_KEY = Symbol("ENTITY_METADATA");

function getOrCreateMeta(target: any): EntityMeta {
  if (!target[METADATA_KEY]) {
    target[METADATA_KEY] = {
      name: "",
      columns: [],
      virtuals: [],
    };
  }
  return target[METADATA_KEY];
}

// 4. Inspection function
export function getEntityMetadata(entityClass: any): EntityMeta {
  let metadata: EntityMeta | undefined = entityClass[METADATA_KEY];

  // If columns are not yet registered (e.g. environments without context.metadata), try instantiation as fallback
  if (!metadata || !metadata.columns?.length) {
    try {
      new entityClass();
    } catch {
      // Ignore constructor errors if entity constructor requires parameters
    }
    metadata = entityClass[METADATA_KEY];
  }

  if (!metadata || !metadata.name) {
    throw new Error(`Class ${entityClass.name} has no @Entity metadata.`);
  }

  return metadata;
}

// 2. Class Decorator
export function Entity(options: EntityOptions = {}) {
  return function <T extends abstract new (...args: any[]) => any>(
    target: T,
    context: ClassDecoratorContext<T>,
  ) {
    const meta = getOrCreateMeta(target);
    meta.name = options.name ?? target.name;
    meta.createTable = options.createTable ?? false;

    // Merge metadata collected on context.metadata during field decoration
    if (context.metadata && (context.metadata as any)[METADATA_KEY]) {
      const fieldMeta = (context.metadata as any)[METADATA_KEY] as EntityMeta;
      if (fieldMeta.columns?.length) {
        meta.columns = [...fieldMeta.columns];
      }
      if (fieldMeta.virtuals?.length) {
        meta.virtuals = [...fieldMeta.virtuals];
      }
    }

    return target;
  };
}

// 3. Field Decorator
export function Column(options: ColumnOptions) {
  return function (value: undefined, context: ClassFieldDecoratorContext) {
    const propertyKey = String(context.name);

    const columnDefinition: ColumnMeta = {
      property: propertyKey,
      name: options.name ?? propertyKey,
      type: options.type,
      primaryKey: options.primaryKey ?? false,
      nullable: options.nullable ?? true,
      unique: options.unique ?? false,
      default: options.default,
      autoIncrement: options.autoIncrement ?? false,
    };

    // 1. Direct registration via TC39 decorator metadata (runs at definition time, no instantiation needed)
    if (context.metadata) {
      const meta = getOrCreateMeta(context.metadata);
      if (!meta.columns) meta.columns = [];
      if (!meta.columns.some((c) => c.property === propertyKey)) {
        meta.columns.push(columnDefinition);
      }
    }

    // 2. Fallback via initializer (runs at instance construction time)
    context.addInitializer(function (this: any) {
      const ctor = this.constructor;
      const meta = getOrCreateMeta(ctor);

      if (!meta.columns) {
        meta.columns = [];
      }
      if (
        meta.columns.some(
          (column: ColumnMeta) => column.property === propertyKey,
        )
      ) {
        return;
      }

      meta.columns.push(columnDefinition);
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

    // 1. Direct registration via TC39 decorator metadata
    if (context.metadata) {
      const meta = getOrCreateMeta(context.metadata);
      if (!meta.virtuals) meta.virtuals = [];
      if (!meta.virtuals.some((v) => v.property === propertyKey)) {
        meta.virtuals.push({
          property: propertyKey,
        });
      }
    }

    // 2. Fallback via initializer
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
