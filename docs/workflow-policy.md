# Workflow Policy Controls

To keep ERP workflows customizable, strict validation and transition rules are controlled centrally in:

- `src/lib/workflows/policy.ts`
- persisted override store: `data/workflow-rules.json`

## How to customize

1. Select an optional default preset using `WORKFLOW_RULE_PRESET`:
   - `balanced` (recommended)
   - `strict`
   - `relaxed`
2. Edit preset/default rules directly in `src/lib/workflows/policy.ts` for permanent project behavior.
3. Override specific rules via environment variables (no code changes required).
4. Use the in-app manager screen:
   - UI: `/settings/workflow-rules`
   - API: `GET/PATCH /api/workflow-rules`

Preset application is lightweight and editable: applying a preset writes per-rule overrides, and any rule can still be changed individually afterward.

## Supported overrides

- `WORKFLOW_RULE_PRESET` (`balanced | strict | relaxed`)
- `WORKFLOW_RULE_DEPLOYMENTS_SINGLE_ACTIVE_PER_GUARD`
- `WORKFLOW_RULE_DEPLOYMENTS_BLOCK_INACTIVE_UPDATE`
- `WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_ACTIVE_GUARD_STATUS`
- `WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_GUARD_OFFICE_CONSISTENCY`
- `WORKFLOW_RULE_DEPLOYMENTS_REQUIRE_END_DATE`
- `WORKFLOW_RULE_DEPLOYMENTS_DISALLOW_ENDDATE_BEFORE_DEPLOYMENTDATE`
- `WORKFLOW_RULE_DEPLOYMENTS_DISALLOW_FUTURE_ENDDATE`
- `WORKFLOW_RULE_INVENTORY_DEMAND_REQUIRE_PENDING_INITIAL_STATUS`
- `WORKFLOW_RULE_INVENTORY_DEMAND_ENFORCE_TRANSITION_MAP`
- `WORKFLOW_RULE_INVENTORY_DEMAND_BLOCK_CORE_EDITS_AFTER_TERMINAL`
- `WORKFLOW_RULE_INVENTORY_DEMAND_REQUIRE_SUFFICIENT_STOCK_FOR_FULFILLMENT`

Accepted values: `true/false`, `1/0`, `yes/no`, `on/off`.

## Current rule usage

- Deployments:
  - create/update single-active guard check
  - optional active-guard-only deployment assignment check
  - optional guard-regional-office consistency check
  - block updates on inactive deployments
  - end-date required and date-bound checks
- Inventory demand:
  - initial-status constraint
  - transition-map enforcement
  - terminal-state core-field lock
  - stock sufficiency check for fulfill transition

## Notes

- Resolution order:
  1. preset defaults (from `WORKFLOW_RULE_PRESET`, fallback `balanced`)
  2. per-rule env overrides
  3. file/API overrides in `data/workflow-rules.json`
- API-authenticated users can update rule overrides from the manager UI.
- Changes are applied immediately to subsequent requests.
