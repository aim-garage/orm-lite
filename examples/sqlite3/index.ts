import { OrmLiteDatabase } from "@orm-lite/core";
import { User } from "./User";
import { Sqlite3Driver } from "@orm-lite/sqlite3-driver";

const dbDriver = new Sqlite3Driver("data/examples/sqlite3/app.db");
const ormLiteDb = new OrmLiteDatabase(dbDriver, { User });

async function main() {
  // direct
  const directResult = await dbDriver.findAll("SELECT * from Users");
  console.table(directResult);
  // through repo
  const repoResult = await ormLiteDb.User.findAll();
  console.table(repoResult);
}

main();
