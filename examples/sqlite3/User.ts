// import { Column, Entity } from "../lib/db";

import { Column, Entity } from "@orm-lite/core";

@Entity("Users")
export class User {
  //
  @Column({ type: "INTEGER" })
  id!: number;
  //
  @Column({ type: "TEXT" })
  name!: string;
  //
  @Column({ type: "TEXT" })
  email!: string;
}
