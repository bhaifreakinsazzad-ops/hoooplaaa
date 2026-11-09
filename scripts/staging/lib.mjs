// Shared helpers for the staging verification scripts. No secrets are stored here or printed.
//
// Environment:
//   SUPABASE_BIN          path to the Supabase CLI (default: "supabase")
//   SUPABASE_PROJECT_REF  project ref (default: supabase/.temp/project-ref written by `supabase link`)
//   VERCEL_BIN            how to run Vercel (default: "npx --yes vercel@65.12.1")
//   VERCEL_SCOPE          Vercel team slug (default: notrealengine)
//   PREVIEW_URL           protected Preview URL for the HTTP scripts (https://...vercel.app)
//   CREDS_FILE            JSON file for the synthetic users (default: ./staging-test-users.json, gitignored)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SUPABASE_BIN = process.env.SUPABASE_BIN || 'supabase';
export const VERCEL_BIN = process.env.VERCEL_BIN || 'npx --yes vercel@65.12.1';
export const VERCEL_SCOPE = process.env.VERCEL_SCOPE || 'notrealengine';
export const PREVIEW_URL = (process.env.PREVIEW_URL || '').replace(/\/$/, '');
export const CREDS_FILE = process.env.CREDS_FILE || path.resolve('staging-test-users.json');

export function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const f = path.resolve('supabase/.temp/project-ref');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error('Set SUPABASE_PROJECT_REF or run `supabase link` first.');
}
export const REF = projectRef();
export const SUPABASE_URL = `https://${REF}.supabase.co`;

let _keys;
/** API keys via the CLI (--reveal). Held in memory only; never printed. */
export function keys() {
  if (_keys) return _keys;
  const raw = execFileSync(SUPABASE_BIN, ['projects', 'api-keys', '--reveal', '-o', 'json', '--remote=' + REF], { encoding: 'utf8' });
  const j = JSON.parse(raw.slice(raw.search(/[\[{]/)));
  const list = Array.isArray(j) ? j : j.keys || j.api_keys || j.apiKeys || [];
  const get = (n) => {
    const k = list.find((x) => (x.name || x.id) === n);
    return k && (k.api_key || k.key);
  };
  _keys = { anon: get('anon'), service: get('service_role') };
  if (!_keys.anon || !_keys.service) throw new Error('Could not read anon/service_role keys from the Supabase CLI.');
  return _keys;
}

/** Run SQL through the CLI. Defaults to a read-only transaction. */
export function sql(query, { write = false } = {}) {
  const args = ['db', 'query', '--remote=' + REF, '-o', 'json'];
  if (!write) args.push('--read-only');
  else args.push('--yes');
  args.push(query);
  const raw = execFileSync(SUPABASE_BIN, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const j = JSON.parse(raw.slice(raw.indexOf('{')));
  return j.rows || [];
}

/** Plain fetch against Supabase REST/Auth/Storage with a given bearer. */
export async function sb(method, pathname, { key, token, body, headers = {}, raw = false } = {}) {
  const k = key || keys().anon;
  const r = await fetch(SUPABASE_URL + pathname, {
    method,
    headers: { apikey: k, Authorization: `Bearer ${token || k}`, ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, json, text, headers: r.headers };
}

let counter = 0;
/**
 * HTTP call to the protected Preview through `vercel curl` (handles Deployment Protection bypass).
 * Uses STDOUT only: the CLI prints notices on stderr, which must never be mixed into the response body.
 */
export function app(method, p, { token, body, headers = {}, jar, file } = {}) {
  if (!PREVIEW_URL) throw new Error('Set PREVIEW_URL to the protected Preview deployment URL.');
  const tmp = path.join(os.tmpdir(), `hq-${process.pid}-${counter++}.json`);
  const parts = [`${VERCEL_BIN} curl --scope ${VERCEL_SCOPE} "${PREVIEW_URL}${p}" -- -s -i -X ${method}`];
  if (!('Origin' in headers)) parts.push(`-H "Origin: ${PREVIEW_URL}"`);
  if (token) parts.push(`-H "Authorization: Bearer ${token}"`);
  for (const [k, v] of Object.entries(headers)) if (v !== null) parts.push(`-H "${k}: ${v}"`);
  if (jar) parts.push(`-b "${jar}" -c "${jar}"`);
  if (file) parts.push(`-F "file=@${file.path};type=${file.type}"`);
  else if (body !== undefined) {
    fs.writeFileSync(tmp, JSON.stringify(body));
    if (!('Content-Type' in headers)) parts.push('-H "Content-Type: application/json"');
    parts.push(`--data-binary "@${tmp}"`);
  }
  const r = spawnSync(parts.join(' '), { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240000 });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  const out = r.stdout || '';
  const sepAt = out.search(/\r?\n\r?\n/);
  const hdr = sepAt >= 0 ? out.slice(0, sepAt) : out;
  const bodyText = sepAt >= 0 ? out.slice(sepAt).replace(/^\r?\n\r?\n/, '') : '';
  const status = Number((hdr.match(/^HTTP\/[\d.]+ (\d+)/m) || [])[1]);
  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {}
  return { status, json, headers: hdr, text: bodyText, raw: out };
}

export function loadCreds() {
  return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
}

/** Tiny test reporter. */
export function reporter() {
  const rows = [];
  return {
    check(name, ok, detail = '') {
      rows.push(!!ok);
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${String(detail).slice(0, 160)}]` : ''}`);
      return !!ok;
    },
    info(msg) {
      console.log(`INFO  ${msg}`);
    },
    done() {
      const p = rows.filter(Boolean).length;
      console.log(`\n${p}/${rows.length} passed`);
      process.exitCode = p === rows.length ? 0 : 1;
      return p === rows.length;
    },
  };
}

export function strongPassword() {
  return execFileSync(process.execPath, ['-e', "process.stdout.write(require('crypto').randomBytes(15).toString('base64url')+'aA1!')"], { encoding: 'utf8' });
}
