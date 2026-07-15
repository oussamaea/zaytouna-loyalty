import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth middleware/proxy", () => {
  it("does not define middleware or proxy that can replace auth cookies", () => {
    const root = process.cwd();
    const possibleFiles = [
      "middleware.ts",
      "middleware.js",
      "proxy.ts",
      "proxy.js",
      "src/middleware.ts",
      "src/middleware.js",
      "src/proxy.ts",
      "src/proxy.js",
    ];

    expect(
      possibleFiles.filter((file) => existsSync(join(root, file))),
    ).toEqual([]);
  });
});
