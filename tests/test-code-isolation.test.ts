import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const norm = (f: string) => f.split(path.sep).join('/');
const appFiles = () => walk('src').filter((f) => !norm(f).startsWith('src/testing/'));

describe('test-only code isolation (LOCAL static checks)', () => {
  it('application code has no STATIC import of src/testing; the bridge is loaded lazily only', () => {
    const staticImport = /^\s*import\s[^;]*from\s+['"][^'"]*testing\/[^'"]*['"]/m;
    const offenders = appFiles().filter((f) => staticImport.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('seeded test credentials exist only under src/testing, e2e, tests and docs', () => {
    const creds = /CustomerA#2026|CustomerB#2026|Finance#2026|Admin#2026|Engineer#2026/;
    const offenders = appFiles().filter((f) => creds.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the bridge refuses to run when a deployment marker is present', async () => {
    const { persistentDB } = await import('../src/domain/persistent-db');
    process.env.VERCEL = '1';
    try {
      (persistentDB as any).adminClient = undefined;
      expect(() => (persistentDB as any).resolveSupabaseConfig()).toThrow(/cannot be enabled in staging or production/);
    } finally {
      delete process.env.VERCEL;
      (persistentDB as any).adminClient = undefined;
    }
  });
});
