/**
 * Central barrel — importing this module ensures every insight file executes
 * its `registerInsight()` side-effect call.
 *
 * Add new insight files here as they are introduced. Order does not matter.
 */

// Revenue leak (G1)
import "./revenue/a1-below-contract-rate"
import "./revenue/a2-branches-missing-rate"
import "./revenue/a3-silent-clients"
import "./revenue/a4-invoice-generation-lag"
import "./revenue/a5-dso-trend"

// Workforce (G2)
import "./workforce/a6-vacant-guards"
import "./workforce/a7-pending-enrollment-stall"
import "./workforce/a8-overtime-concentration"
import "./workforce/a9-guard-churn"
import "./workforce/a10-office-utilization"

// Process drag (G3)
import "./process/a11-payroll-cycle-slippage"
import "./process/a12-approvals-aging"
import "./process/a13-tickets-aging"
import "./process/a14-clearance-backlog"
import "./process/a15-short-deployments"

// Ghost workforce (G4)
import "./ghost/b1-duplicate-cnic"
import "./ghost/b2-duplicate-bank"
import "./ghost/b3-payrolled-without-deployment"
import "./ghost/b4-duplicate-contact"
import "./ghost/b5-concurrent-deployment"

// Operator behavior (G5)
import "./operator/b6-after-hours-writes"
import "./operator/b7-bulk-write-spikes"
import "./operator/b8-absconded-skew"
import "./operator/b9-scope-violations"
import "./operator/b10-permission-escalations"

// Financial (G6)
import "./financial/b11-invoice-modified-after-paid"
import "./financial/b12-salary-override"
import "./financial/b13-loan-spikes"
import "./financial/b14-lost-inventory"
import "./financial/b15-advance-ghost"
