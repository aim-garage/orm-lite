import { Database } from "@orm-lite/core";
import { User } from "./User";
import { Sqlite3Driver } from "@orm-lite/sqlite3-driver";

const dbDriver = new Sqlite3Driver("./app.db");
// const ormLiteDb = new Database(dbDriver, { User });

async function main() {
  // get tables
  const tablesResult = await dbDriver.findAll(
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%';",
  );
  console.table(tablesResult);
  // direct
  // const directResult = await dbDriver.findAll("SELECT * from Users");
  // console.log(directResult);
  // through repo
  // const repoResult = await ormLiteDb.User.findAll();
  // console.log(repoResult);
}

main();
