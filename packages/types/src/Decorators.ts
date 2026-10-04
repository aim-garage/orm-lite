
export interface EntityOptions {
    name?: string;
    createTable?: boolean;
}

export interface ColumnOptions {
    name?: string;
    type: string;
    primaryKey?: boolean;
    nullable?: boolean;
    unique?: boolean;
    default?: unknown;
    autoIncrement?: boolean;
}

export interface EntityMeta {
    name?: string;
    createTable?: boolean;
    columns?: ColumnMeta[];
    virtuals: VirtualMeta[];
}

export interface ColumnMeta {
    name: string;
    property: string;
    type: string;
    primaryKey?: boolean;
    nullable: boolean;
    unique: boolean;
    default?: unknown;
    autoIncrement: boolean;
}

export interface VirtualMeta {
    property: string;
}