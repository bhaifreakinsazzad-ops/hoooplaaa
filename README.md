# HOOOPLAAA INCORPORATED — DIGITAL SERVICE COMMERCE PLATFORM

> **Marketing Agency Self-Service Platform** | `bhaifreakinsazzad-ops/hoooplaaa`

**Platform Version:** 3.1.0-PROD  
**Effective Date:** 2026-11-08 (Asia/Dhaka)  
**Operating Slogan:** *Attract. Connect. Convert. Grow.*  
**Architecture:** Next.js 15 (App Router) • React 19 • TypeScript Strict • Tailwind CSS • Supabase / PostgreSQL • Vitest  
**Supabase Instance:** `https://aqmyqezuoscpgqwtvblu.supabase.co`  
**GitHub Repository:** `bhaifreakinsazzad-ops/hoooplaaa`  

---

## 1. Executive Summary

This repository contains the real, production-ready, self-service digital agency commerce platform for **HOOOPLAAA INCORPORATED**. It eliminates the friction of mandatory human sales calls and informal WhatsApp negotiation by providing:

1. **Intelligent Configurator:** Conditional, business-specific questionnaires with real-time eligibility checks (e.g. Google storefront requirements vs online-only companies).
2. **Server-Authoritative Pricing Engine:** All pricing is derived by backend code using minor units (Poisha: 1 BDT = 100 Poisha) with cryptographic terms hashing (SHA-256) and a 7-day quote expiry. Client-side price tampering is completely rejected.
3. **Multi-Platform Foundations & Hero Bundle:** Meta Business Setup (৳1,500), Google Business Setup (৳1,500), LinkedIn Company Page (৳1,500), and the Complete 3-Platform Bundle (৳3,000, saving ৳1,500 relative to individual setups).
4. **Growth Add-on Upgrades:** WhatsApp Automation (৳1,690), Meta Pixel Tracking (৳1,500, with active website prerequisite check), and Basic Static Ad Creative (৳990).
5. **Secure Payment Adapter Architecture:** SSLCOMMERZ Sandbox Gateway integration (with server-to-server IPN validation and replay attack guards) and a manual MFS (bKash/Nagad) reference submission workflow with explicit *Pending Verification* status.
6. **Zero-Password Client Workspace:** Customer intake form strictly prohibits raw passwords and guides users to delegate partner access. Private file upload dropzone validates MIME types and rejects executable scripts.
7. **Admin Control Center:** Real-time catalog governance, order fulfillment assignment, SLA clock tracking, finance verification ledger, pre-sale audit triage, and append-only activity logging.
8. **Dual Persistence Engine:** 
   - **Local Disk-backed ACID Store:** `data/persistent_database.json` maintains state across cold server restarts with atomic file write-and-rename semantics.
   - **Cloud Supabase PostgreSQL:** Full SQL migrations (`supabase/migrations/20261108000000_init_schema.sql` and `supabase/migrations/20261108000001_production_schema_v3_1.sql`) and seed data (`supabase/seed.sql`) with comprehensive Row Level Security (RLS) policies for multi-tenant isolation.

---

## 2. Quick Start Guide

### Prerequisites
- Node.js `v20+` (tested on Node `v22.14.0`)
- npm `v10+`

### Installation & Environment Setup
```bash
# Clone or navigate to the project directory
cd "e:\Agentic Work Station\Web Applications\Hoooplaaa"

# Install pinned dependencies
npm install

# Copy environment variables (sandbox defaults pre-configured)
cp .env.example .env.local
```

### Configuring Supabase (Cloud PostgreSQL)
To connect your remote Supabase instance (`https://aqmyqezuoscpgqwtvblu.supabase.co`):
1. In your Supabase Dashboard -> **SQL Editor**, run the migration file:
   - `supabase/migrations/20261108000001_production_schema_v3_1.sql`
2. Then run the seed script:
   - `supabase/seed.sql`
3. Add your Supabase keys to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://aqmyqezuoscpgqwtvblu.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

### Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Automated Test Suite
```bash
npm run test
```
Executes all 24 deterministic test scenarios verifying server pricing, Google ineligibility, Pixel prerequisites, replay attack prevention, cross-tenant RLS isolation, role tampering protection, persistence across cold restarts, and mobile performance budgets.

### Building for Production
```bash
npm run build
```
Generates optimized static pages and server routes. Total initial JS bundle is ~103 kB, well beneath the 250 kB performance budget for fast Bangladesh mobile loading.

---

## 3. Visual Design System

The platform adopts a unified, high-conversion direct commerce aesthetic rooted in the approved brand identity:
- **Primary Navy (`#071525`):** Expresses institutional credibility, authority, and security.
- **Card Navy Surface (`#10283E`):** Provides depth and separation for elevated interactive surfaces.
- **Warm Ivory Canvas (`#FFFCF5`):** Welcoming, high-contrast readable reading surfaces.
- **Champagne Gold (`#D9B45E`):** Highlights premium offerings, value savings, and trust seals.
- **Dual Language Support:** Full support for English and Bengali (বাংলা) across all primary navigation and trust badges.

---

## 4. Architectural Boundaries & Security Posture

- **Zero-Password Policy:** Intake forms check submitted payloads with regular expressions and actively throw an exception if password/credential keys are present. Partner delegation instructions are provided instead.
- **Deterministic SLA Timer:** The delivery SLA clock begins strictly when both payment is verified AND client intake is submitted.
- **Replay Protection:** Payment callbacks track external validation IDs (`val_id`). Duplicate callbacks are identified and rejected without double-crediting orders.
- **Tenant Isolation:** Direct API calls enforce business ownership; customer sessions can only read orders belonging to their authorized tenant.
- **File Upload Safeguards:** Executable scripts (`.exe`, `.bat`, `.sh`, `.js`, `.html`, `.php`) are strictly blocked; storage paths use private signed URLs.
- **Catalog Governance:** Historical and proposed catalog SKUs (such as `HI-SAAS-01` or virtual prepaid cards) are marked `checkout_enabled = false` and cannot be checked out via public APIs.
