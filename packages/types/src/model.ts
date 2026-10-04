export type DatabaseDriver = {
  findAll<T>(sql: string): Promise<T[]>;
};
