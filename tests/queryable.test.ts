import test from "node:test";
import assert from "node:assert/strict";
import {
  Column,
  Database,
  Entity,
  OrmLiteDatabase,
  Queryable,
  SqlCompiler,
} from "../packages/core/src/index";
import { Sqlite3Driver } from "../packages/sqlite3-driver/src/index";

@Entity({ name: "users", createTable: true })
class User {
  @Column({ type: "INTEGER", primaryKey: true, autoIncrement: true })
  id!: number;

  @Column({ type: "TEXT" })
  name!: string;

  @Column({ type: "INTEGER" })
  age!: number;

  @Column({ type: "BOOLEAN" })
  active!: boolean;

  @Column({ type: "TEXT", nullable: true })
  email?: string;
}

test("SQL Compilation - Success Criteria from Design Doc", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const query = db.Users.where({
    and: [{ age: { gte: 18 } }, { active: { eq: true } }],
  })
    .select(["id", "name"])
    .orderBy("name")
    .take(20);

  const compiled = query.toSql();

  assert.equal(
    compiled.sql,
    `SELECT "id", "name"
FROM "users"
WHERE ("age" >= ?) AND ("active" = ?)
ORDER BY "name" ASC
LIMIT ?`,
  );
  assert.deepEqual(compiled.params, [18, true, 20]);
});

test("SQL Compilation - Immutability of Queryable", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q1 = db.Users;
  const q2 = q1.where({ age: { gte: 18 } });
  const q3 = q2.take(20);

  assert.equal(q1.toSql().sql, `SELECT *\nFROM "users"`);
  assert.deepEqual(q1.toSql().params, []);

  assert.equal(
    q2.toSql().sql,
    `SELECT *\nFROM "users"\nWHERE "age" >= ?`,
  );
  assert.deepEqual(q2.toSql().params, [18]);

  assert.equal(
    q3.toSql().sql,
    `SELECT *\nFROM "users"\nWHERE "age" >= ?\nLIMIT ?`,
  );
  assert.deepEqual(q3.toSql().params, [18, 20]);
});

test("SQL Compilation - Comparison Operators (eq, ne, gt, gte, lt, lte)", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users.where({
    and: [
      { age: { eq: 25 } },
      { age: { ne: 30 } },
      { age: { gt: 18 } },
      { age: { gte: 21 } },
      { age: { lt: 65 } },
      { age: { lte: 60 } },
    ],
  });

  const { sql, params } = q.toSql();
  assert.equal(
    sql,
    `SELECT *
FROM "users"
WHERE ("age" = ?) AND ("age" <> ?) AND ("age" > ?) AND ("age" >= ?) AND ("age" < ?) AND ("age" <= ?)`,
  );
  assert.deepEqual(params, [25, 30, 18, 21, 65, 60]);
});

test("SQL Compilation - String Operators (contains, startsWith, endsWith)", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users.where({
    and: [
      { name: { contains: "john" } },
      { name: { startsWith: "John" } },
      { email: { endsWith: "@example.com" } },
    ],
  });

  const { sql, params } = q.toSql();
  assert.equal(
    sql,
    `SELECT *
FROM "users"
WHERE ("name" LIKE ?) AND ("name" LIKE ?) AND ("email" LIKE ?)`,
  );
  assert.deepEqual(params, ["%john%", "John%", "%@example.com"]);
});

test("SQL Compilation - Null Operators (isNull, isNotNull, direct null)", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q1 = db.Users.where({ email: { isNull: true } });
  assert.equal(
    q1.toSql().sql,
    `SELECT *\nFROM "users"\nWHERE "email" IS NULL`,
  );

  const q2 = db.Users.where({ email: { isNotNull: true } });
  assert.equal(
    q2.toSql().sql,
    `SELECT *\nFROM "users"\nWHERE "email" IS NOT NULL`,
  );

  const q3 = db.Users.where({ email: null });
  assert.equal(
    q3.toSql().sql,
    `SELECT *\nFROM "users"\nWHERE "email" IS NULL`,
  );
});

test("SQL Compilation - Collection Operators (in, notIn)", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users.where({
    and: [
      { id: { in: [1, 2, 3] } },
      { name: { notIn: ["Bob", "Alice"] } },
    ],
  });

  const { sql, params } = q.toSql();
  assert.equal(
    sql,
    `SELECT *
FROM "users"
WHERE ("id" IN (?, ?, ?)) AND ("name" NOT IN (?, ?))`,
  );
  assert.deepEqual(params, [1, 2, 3, "Bob", "Alice"]);
});

test("SQL Compilation - Range Operators (between)", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users.where({ age: { between: [18, 30] } });
  const { sql, params } = q.toSql();

  assert.equal(
    sql,
    `SELECT *\nFROM "users"\nWHERE "age" BETWEEN ? AND ?`,
  );
  assert.deepEqual(params, [18, 30]);
});

test("SQL Compilation - Nested AND / OR / NOT", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users.where({
    and: [
      { age: { gte: 18 } },
      {
        or: [{ name: { eq: "admin" } }, { name: { eq: "manager" } }],
      },
      {
        not: { active: { eq: false } },
      },
    ],
  });

  const { sql, params } = q.toSql();
  assert.equal(
    sql,
    `SELECT *
FROM "users"
WHERE ("age" >= ?) AND (("name" = ?) OR ("name" = ?)) AND NOT ("active" = ?)`,
  );
  assert.deepEqual(params, [18, "admin", "manager", false]);
});

test("SQL Compilation - Ordering and Pagination", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users.orderBy([
    ["name", "asc"],
    ["age", "desc"],
  ])
    .skip(20)
    .take(10);

  const { sql, params } = q.toSql();
  assert.equal(
    sql,
    `SELECT *
FROM "users"
ORDER BY "name" ASC, "age" DESC
LIMIT ? OFFSET ?`,
  );
  assert.deepEqual(params, [10, 20]);
});

test("SQLite End-to-End Database Execution", async () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  // 1. Create table
  await db.Users.syncTable();

  // 2. Insert records using Entity Queryable
  const u1 = await db.Users.insert({
    name: "John",
    age: 25,
    active: true,
    email: "john@example.com",
  });
  assert.equal(u1.id, 1);
  assert.equal(u1.name, "John");

  const u2 = await db.Users.insert({
    name: "Alice",
    age: 17,
    active: true,
    email: "alice@example.com",
  });
  assert.equal(u2.id, 2);

  const u3 = await db.Users.insert({
    name: "Bob",
    age: 35,
    active: false,
    email: "bob@example.com",
  });
  assert.equal(u3.id, 3);

  // 3. toList() with where, select, orderBy, take
  const adultActiveUsers = await db.Users.where({
    and: [{ age: { gte: 18 } }, { active: { eq: true } }],
  })
    .select(["id", "name", "age"])
    .orderBy("age", "desc")
    .take(10)
    .toList();

  assert.equal(adultActiveUsers.length, 1);
  assert.equal(adultActiveUsers[0].name, "John");
  assert.equal(adultActiveUsers[0].age, 25);

  // 4. count()
  const totalCount = await db.Users.count();
  assert.equal(totalCount, 3);

  const activeCount = await db.Users.where({ active: true }).count();
  assert.equal(activeCount, 2);

  // 5. any()
  const hasJohn = await db.Users.where({ name: "John" }).any();
  assert.equal(hasJohn, true);

  const hasDavid = await db.Users.where({ name: "David" }).any();
  assert.equal(hasDavid, false);

  // 6. first() & firstOrDefault()
  const firstUser = await db.Users.where({ id: 1 }).first();
  assert.equal(firstUser.name, "John");

  const missing = await db.Users.where({ id: 999 }).firstOrDefault();
  assert.equal(missing, undefined);

  await assert.rejects(async () => {
    await db.Users.where({ id: 999 }).first();
  }, /Sequence contains no elements/);

  // 7. Bulk update()
  const updateRes = await db.Users.where({ active: false }).update({
    active: true,
  });
  assert.equal(updateRes.changes, 1);

  const newActiveCount = await db.Users.where({ active: true }).count();
  assert.equal(newActiveCount, 3);

  // 8. Entity save() instance persistence
  firstUser.name = "Johnathan";
  await firstUser.save();

  const refreshed = await db.Users.where({ id: 1 }).first();
  assert.equal(refreshed.name, "Johnathan");

  // 9. Bulk delete()
  const delRes = await db.Users.where({ id: 2 }).delete();
  assert.equal(delRes.changes, 1);

  const countAfterDelete = await db.Users.count();
  assert.equal(countAfterDelete, 2);

  // 10. Raw SQL query & execute
  const rawUsers = await db.query<User>(
    `SELECT * FROM "users" WHERE "age" > ?`,
    [20],
  );
  assert.equal(rawUsers.length, 2);

  await db.execute(`UPDATE "users" SET "age" = ? WHERE "id" = ?`, [28, 1]);
  const user1 = await db.Users.where({ id: 1 }).first();
  assert.equal(user1.age, 28);

  // 11. Transaction (commit)
  await db.transaction(async (tx) => {
    await tx.Users.insert({
      name: "TxUser",
      age: 40,
      active: true,
    });
  });

  const txUser = await db.Users.where({ name: "TxUser" }).firstOrDefault();
  assert.ok(txUser);

  // 12. Transaction (rollback on error)
  await assert.rejects(async () => {
    await db.transaction(async (tx) => {
      await tx.Users.insert({
        name: "RollbackUser",
        age: 50,
        active: true,
      });
      throw new Error("Force Rollback");
    });
  }, /Force Rollback/);

  const rollbackUser = await db.Users.where({
    name: "RollbackUser",
  }).firstOrDefault();
  assert.equal(rollbackUser, undefined);

  await db.close();
});

test("SQL Compilation - Chained .where() calls", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q = db.Users
    .where({ age: { gte: 18 } })
    .where({ active: { eq: true } });

  const { sql, params } = q.toSql();
  assert.equal(
    sql,
    `SELECT *
FROM "users"
WHERE ("age" >= ?) AND ("active" = ?)`,
  );
  assert.deepEqual(params, [18, true]);
});

test("Database initialization with entities array and config object", async () => {
  const driver = new Sqlite3Driver(":memory:");
  const db1 = new Database(driver, { entities: [User] });
  assert.ok(db1.Users);
  assert.ok(db1.User);

  const db2 = new Database(driver, [User]);
  assert.ok(db2.Users);
  assert.ok(db2.User);
});

test("SQL Normalizer - Unknown property validation", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  assert.throws(() => {
    db.Users.where({ nonExistent: { eq: "value" } } as any).toSql();
  }, /Unknown property "nonExistent"/);
});

test("SQL Compilation - Empty collection operators in/notIn", () => {
  const driver = new Sqlite3Driver(":memory:");
  const db = new Database(driver, { User });

  const q1 = db.Users.where({ id: { in: [] } });
  assert.equal(q1.toSql().sql, `SELECT *\nFROM "users"\nWHERE 1 = 0`);

  const q2 = db.Users.where({ id: { notIn: [] } });
  assert.equal(q2.toSql().sql, `SELECT *\nFROM "users"\nWHERE 1 = 1`);
});

