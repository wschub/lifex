import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appDir = join(process.cwd(), "src/app") + "/";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("public/admin isolation", () => {
  it("never imports the admin app, shadcn components or Tailwind from the public site", () => {
    const offenders = sourceFiles(join(appDir, "public")).filter((file) => {
      const text = readFileSync(file, "utf8");
      return /app\/admin|\.\.\/admin|components\/ui\/|admin\.css|@import\s+["']tailwindcss|tw-animate/.test(
        text,
      );
    });
    expect(offenders).toEqual([]);
  });

  it("loads admin.css only from the admin entry", () => {
    const importers = sourceFiles(appDir)
      .filter((file) => !file.endsWith("public-isolation.test.ts"))
      .filter((file) => /admin\.css/.test(readFileSync(file, "utf8")));
    expect(importers.map((file) => file.slice(appDir.length))).toEqual(["admin/AdminApp.tsx"]);
  });
});
