import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const viewName = 'public.changelog_release_items';
const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
const dropViewPattern = /drop\s+view\s+if\s+exists\s+"?public"?\."?changelog_release_items"?\s*;/i;
const createViewPattern =
  /create\s+or\s+replace\s+view\s+"?public"?\."?changelog_release_items"?(?:\s+with\s*\([^)]*security_invoker\s*=\s*true[^)]*\))?\s+as\b/i;
const createSecurityInvokerViewPattern =
  /create\s+or\s+replace\s+view\s+"?public"?\."?changelog_release_items"?\s+with\s*\([^)]*security_invoker\s*=\s*true[^)]*\)\s+as\b/i;
const alterSecurityInvokerPattern =
  /alter\s+view\s+"?public"?\."?changelog_release_items"?\s+set\s*\(\s*security_invoker\s*=\s*true\s*\)\s*;/i;

function getFinalSecurityInvokerState() {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  let viewExists = false;
  let securityInvoker = false;

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    if (dropViewPattern.test(sql)) {
      viewExists = false;
      securityInvoker = false;
    }

    if (createViewPattern.test(sql)) {
      viewExists = true;
      securityInvoker = createSecurityInvokerViewPattern.test(sql);
    }

    if (alterSecurityInvokerPattern.test(sql)) {
      viewExists = true;
      securityInvoker = true;
    }
  }

  return { viewExists, securityInvoker };
}

describe('changelog_release_items view security', () => {
  it('ends the migration chain as a security invoker view', () => {
    const state = getFinalSecurityInvokerState();

    expect(state.viewExists).toBe(true);
    expect(state.securityInvoker).toBe(true);
  });
});
