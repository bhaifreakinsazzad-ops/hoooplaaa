// Creates (or refreshes) the five SYNTHETIC staging fixtures through the Supabase Admin API:
// two customers in separate orgs plus finance, engineer and admin staff. Random passwords are written to CREDS_FILE
// (gitignored) and never printed. Idempotent: an existing fixture gets a new password.
//
//   node scripts/staging/seed-users.mjs
import fs from 'node:fs';
import { CREDS_FILE, keys, reporter, sb, strongPassword } from './lib.mjs';

const R = reporter();
const { service } = keys();
const svc = { key: service, token: service };

const FIXTURES = [
  { key: 'customerA', email: 'staging-customer-a@example.com', name: 'Staging Customer A', role: 'customer', org: 'Staging Org A' },
  { key: 'customerB', email: 'staging-customer-b@example.com', name: 'Staging Customer B', role: 'customer', org: 'Staging Org B' },
  { key: 'finance', email: 'staging-finance@example.com', name: 'Staging Finance', role: 'finance', org: 'HOOOPLAAA Staging Staff' },
  { key: 'engineer', email: 'staging-engineer@example.com', name: 'Staging Engineer', role: 'engineer', org: 'HOOOPLAAA Staging Staff' },
  { key: 'admin', email: 'staging-admin@example.com', name: 'Staging Admin', role: 'admin', org: 'HOOOPLAAA Staging Staff' },
];

const out = { created_at: new Date().toISOString(), users: {} };
const orgIds = {};

for (const f of FIXTURES) {
  const password = strongPassword();
  const existing = await sb('GET', `/rest/v1/user_profiles?email=eq.${encodeURIComponent(f.email)}&select=id,organization_id`, svc);
  let id, orgId;
  if (existing.json && existing.json[0]) {
    id = existing.json[0].id;
    orgId = existing.json[0].organization_id;
    const up = await sb('PUT', `/auth/v1/admin/users/${id}`, { ...svc, body: { password, email_confirm: true } });
    R.check(`refreshed ${f.key}`, up.status === 200, up.status);
  } else {
    orgId = orgIds[f.org];
    if (!orgId) {
      const o = await sb('POST', '/rest/v1/organizations', { ...svc, body: { name: f.org, industry: 'Staging' }, headers: { Prefer: 'return=representation' } });
      orgId = o.json && o.json[0] && o.json[0].id;
      if (!orgId) throw new Error('organization insert failed: ' + o.text.slice(0, 120));
      orgIds[f.org] = orgId;
    }
    const u = await sb('POST', '/auth/v1/admin/users', { ...svc, body: { email: f.email, password, email_confirm: true, user_metadata: { full_name: f.name } } });
    id = u.json && u.json.id;
    if (!id) throw new Error(`auth user create failed for ${f.key}: ${u.status}`);
    const p = await sb('POST', '/rest/v1/user_profiles', { ...svc, body: { id, organization_id: orgId, email: f.email, full_name: f.name, role: f.role }, headers: { Prefer: 'return=minimal' } });
    R.check(`created ${f.key} (${f.role})`, p.status === 201, p.status);
  }
  out.users[f.key] = { email: f.email, password, id, role: f.role, org: orgId };
}

fs.writeFileSync(CREDS_FILE, JSON.stringify(out, null, 2));
console.log(`credentials written to ${CREDS_FILE} (do not commit)`);
R.done();
