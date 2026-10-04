import { OrmLiteDatabase } from "@orm-lite/core";
import { User } from "./User";
import { Sqlite3Driver } from "@orm-lite/sqlite3-driver";

const dbDriver = new Sqlite3Driver("data/examples/sqlite3/app.db");
const ormLiteDb = new OrmLiteDatabase(dbDriver, { User });

async function main() {
  // direct
  const directResult = await dbDriver.all("SELECT * from Users", []);
  console.table(directResult);

  // through LINQ Queryable
  console.log("--- LINQ Queryable ---");
  const query = ormLiteDb.User
    .where({ age: { gt: 12, lt: 38 } })
    .orderBy({ age: 'ASC', name: 'DESC' })
    .select();

  const linqQuery = query.toSql();
  console.log(linqQuery);
  const result = await query.toList();
  console.log(result);

  // const linqQuery = ormLiteDb.User
  // .where({ age: { gte: 21 } })
  // .select(["id", "name", "age"])
  // .orderBy("name", "asc")
  // .take(5); 
}

main();
