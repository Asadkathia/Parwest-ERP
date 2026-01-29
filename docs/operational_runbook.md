# Operational Deployment & Runbook

This runbook defines how to deploy, operate, monitor, and recover the ERP in production.

---

## 1) Environments

### 1.1 Local Development
- **Runtime**: Node.js LTS, Supabase local (optional), or hosted Supabase project for shared dev.
- **Env files**: `.env.local` for Next.js.
- **Database**: Use Supabase project for shared dev or local Supabase for isolated testing.

### 1.2 Staging
- **Purpose**: QA, UAT, and pre-prod validation.
- **Deployment**: Vercel preview or dedicated staging environment.
- **Data**: Anonymized sample or masked production snapshot.

### 1.3 Production
- **Purpose**: Live customer data and operations.
- **Deployment**: Vercel production project + Supabase production project.
- **Access**: Restricted to admins only.

---

## 2) Environment Variables

### 2.1 Next.js (Frontend + Server Actions)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `APP_BASE_URL`
- `SENTRY_DSN` (optional)
- `RESEND_API_KEY` (if email enabled)
- `CRON_SECRET` (if cron endpoints are used)

### 2.2 Supabase
- Auth settings (site URL, redirect URLs)
- Storage buckets (documents, assets, exports)
- RLS enabled for all tables

---

## 3) Deployment Steps

### 3.1 Database
1. Apply schema migrations in Supabase.
2. Enable RLS policies for all tables.
3. Seed lookup tables (roles, permissions, status lists).
4. Validate RPC functions and triggers.

### 3.2 Frontend
1. Build and deploy Next.js to Vercel.
2. Verify environment variables.
3. Run smoke tests and dashboards sanity checks.

### 3.3 Post-Deploy Validation
- Login + role-based dashboard access.
- CRUD flows for guards, deployments, attendance, payroll, billing, inventory.
- Verify notifications and audit logs.

---

## 4) Monitoring & Alerting

### 4.1 Application Monitoring
- **Performance**: Vercel Analytics / Web Vitals
- **Errors**: Sentry or equivalent
- **Logs**: Vercel logs, Supabase logs

### 4.2 Database Monitoring
- Supabase dashboard metrics (CPU, storage, connections)
- Query performance and slow query logs

### 4.3 Alerting
- Uptime alerts for web app and API routes
- Error rate thresholds (5xx spikes)
- Database storage and connection usage thresholds

---

## 5) Backup & Recovery

### 5.1 Backups
- Supabase automated backups enabled
- Snapshot frequency: daily
- Retention: 30 days (or per compliance)

### 5.2 Recovery
1. Identify incident window and affected entities.
2. Restore from snapshot to staging for validation.
3. Apply controlled restore to production during maintenance window.

---

## 6) Access Control & Secrets
- Rotate service role keys quarterly.
- Store secrets in Vercel/Supabase encrypted env.
- Use least privilege for admin access.

---

## 7) Release Checklist
- [ ] All migrations applied and verified.
- [ ] RLS policies enabled and tested.
- [ ] RPC contracts verified against `docs/api_contracts.md`.
- [ ] QA smoke tests passed (see `qa_acceptance_criteria.md`).
- [ ] Monitoring/alerts verified.
- [ ] Rollback plan reviewed.

---

## 8) Incident Response

### 8.1 Severity Levels
- **SEV-1**: System outage or data loss risk.
- **SEV-2**: Major module failure (payroll/billing/attendance).
- **SEV-3**: Partial degradation or UI errors.

### 8.2 Response Steps
1. Triage incident and assign owner.
2. Mitigate (feature flag or rollback).
3. Communicate status to stakeholders.
4. Root cause analysis and follow-up fixes.

---

## 9) Data Privacy & Compliance
- Audit logs enabled for all critical mutations.
- Role-based access and RLS enforced.
- Sensitive documents in private storage buckets.

