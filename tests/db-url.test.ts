import { describe, expect, it } from "vitest";
import { isNeonDatabaseUrl } from "@/server/db-url";

describe("Neon database URL validation", () => {
  it("accepts pooled and direct Neon PostgreSQL URLs", () => {
    expect(isNeonDatabaseUrl("postgresql://user:password@ep-example-pooler.us-east-2.aws.neon.tech/paysafr")).toBe(true);
    expect(isNeonDatabaseUrl("postgres://user:password@ep-example.us-east-2.aws.neon.tech/paysafr")).toBe(true);
  });

  it("rejects local, non-PostgreSQL, and malformed URLs", () => {
    expect(isNeonDatabaseUrl("postgres://localhost:5432/paysafr")).toBe(false);
    expect(isNeonDatabaseUrl("mysql://ep-example.neon.tech/paysafr")).toBe(false);
    expect(isNeonDatabaseUrl("not-a-url")).toBe(false);
  });
});
