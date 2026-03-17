# Inventory V2 Flag Rollout Runbook

Last updated: 2026-03-17

## Scope
Operational runbook for staged activation of inventory v2 flags in staging/production.

## Flags
- `INVENTORY_V2_ENABLED`
- `INVENTORY_V2_WRITE_ENABLED`
- `INVENTORY_V2_READ_FROM_V2`
- `INVENTORY_V2_LEGACY_READONLY`
- `INVENTORY_V2_CUTOVER_COMPLETE`
- `NEXT_PUBLIC_*` mirrors for each flag above

## Ordered Rollout
1. Stage A (pilot visibility)
- `INVENTORY_V2_ENABLED=true`
- `NEXT_PUBLIC_INVENTORY_V2_ENABLED=true`

2. Stage B (v2 writes)
- `INVENTORY_V2_WRITE_ENABLED=true`
- `NEXT_PUBLIC_INVENTORY_V2_WRITE_ENABLED=true`

3. Stage C (read cutover)
- `INVENTORY_V2_READ_FROM_V2=true`
- `NEXT_PUBLIC_INVENTORY_V2_READ_FROM_V2=true`

4. Stage D (legacy write freeze)
- `INVENTORY_V2_LEGACY_READONLY=true`
- `NEXT_PUBLIC_INVENTORY_V2_LEGACY_READONLY=true`

5. Stage E (legacy removal gate)
- `INVENTORY_V2_CUTOVER_COMPLETE=true`
- `NEXT_PUBLIC_INVENTORY_V2_CUTOVER_COMPLETE=true`

## Validation Command Set (per stage)
1. `npm run ci:quality`
2. `npm run build:next`
3. `npm run test:integration:strict-real`
4. `node scripts/check-inventory-v2-parity.mjs`
5. `npm run inventory:v2:flags`

## Stage Env Automation
- Generate all stage env snippets:
  - `npm run inventory:v2:stage-env`
- File output:
  - `docs/inventory-v2-stage-env-snippets.md`
- Verify current deployment env against expected stage:
  - `INVENTORY_V2_EXPECTED_STAGE=A|B|C|D|E npm run inventory:v2:flags`

Readonly-phase strict profile simulation:

```bash
INVENTORY_V2_READ_FROM_V2=true \
NEXT_PUBLIC_INVENTORY_V2_READ_FROM_V2=true \
INVENTORY_V2_LEGACY_READONLY=true \
NEXT_PUBLIC_INVENTORY_V2_LEGACY_READONLY=true \
SKIP_LEGACY_INVENTORY_MUTATIONS=true \
npm run test:integration:strict-real
```

## Rollback
- Keep `INVENTORY_V2_ENABLED=true` if UI access is needed, but rollback reads/writes in this order:
1. `INVENTORY_V2_LEGACY_READONLY=false`
2. `INVENTORY_V2_READ_FROM_V2=false`
3. `INVENTORY_V2_WRITE_ENABLED=false`
4. If needed, `INVENTORY_V2_ENABLED=false`
- Apply same values to `NEXT_PUBLIC_*` mirrors.

## Exit Criteria for `INVENTORY_V2_CUTOVER_COMPLETE=true`
- Strict integration pass with no failures.
- Parity report reviewed and accepted.
- Cross-module regression pass (`clients`, `guards`, `imports`, `reports`, `settings`).
- Stakeholder signoff recorded in progress tracker.
