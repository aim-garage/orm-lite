// import { Column, Entity } from "../lib/db";

import { Column, Entity } from "@orm-lite/core";

@Entity({ name: "Users", createTable: true })
export class User {
  //
  @Column({ type: "INTEGER", primaryKey: true })
  id!: number;
  //
  @Column({ type: "TEXT" })
  name!: string;
  //
  @Column({ type: "INTEGER" })
  age!: number;

  // @Virtual()
  get isAdult(): boolean {
    return this.age > 24;
  }

  toJSON() {
    return {
      name: this.name,
      isAdult: this.isAdult,
    };
  }
}
