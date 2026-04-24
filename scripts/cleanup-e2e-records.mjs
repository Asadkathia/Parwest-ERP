import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

/**
 * Removes test-run records across the ERP DB and returns counts per table.
 *
 * What is deleted:
 *   - Guards whose name starts with "QA Guard" OR parwestId starts with "LC-G-"
 *   - Clients whose name starts with "QA Client ", "QA-BL-", or "Lifecycle "
 *   - Branches whose name starts with "Lifecycle " (QA branches cascade via client)
 *   - Store-inventory Products whose sku starts with "QA-SKU-" or "LC-"
 *   - Deployments, Attendance, GuardSupervisorAssignment, GuardPrerequisite,
 *     GuardServiceHistory, GuardStatusHistory, ClientContract, ClientContractRate,
 *     StoreInventoryAssignment, StoreInventoryMovement linked to the above
 *   - Lifecycle users (supervisor.lifecycle@parwest.test, manager.lifecycle@parwest.test,
 *     operations.lifecycle@parwest.test)
 *
 * What is preserved:
 *   - The seeded admin user (admin@parwestgroup.com)
 *   - Roles, Regions, RegionalOffices
 *   - Master tables (ClientType, StoreInventoryCategory, Brand, Unit, Status, etc.)
 *   - Everything else not matching a test pattern
 *
 * Run in dry-run mode by default. Pass EXECUTE=true to actually delete.
 */

const url =
  process.env.DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL
if (!url) {
  console.error("[cleanup] Missing DATABASE_URL")
  process.exit(1)
}

const execute = process.env.EXECUTE === "true"
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) })

function log(label, count) {
  console.log(`  ${label.padEnd(44)} ${execute ? "deleted" : "would delete"}: ${count}`)
}

async function main() {
  console.log(`[cleanup] Mode: ${execute ? "EXECUTE" : "DRY-RUN (set EXECUTE=true to actually delete)"}`)
  console.log()

  // 1) Identify target guards + clients + products up front.
  const testGuards = await prisma.guard.findMany({
    where: {
      OR: [
        { name: { startsWith: "QA Guard" } },
        { parwestId: { startsWith: "LC-G-" } },
      ],
    },
    select: { id: true, parwestId: true, name: true },
  })
  const testGuardIds = testGuards.map((g) => g.id)

  const testClients = await prisma.client.findMany({
    where: {
      OR: [
        { name: { startsWith: "QA Client " } },
        { name: { startsWith: "QA-BL-" } },
        { name: { startsWith: "Lifecycle " } },
      ],
    },
    select: { id: true, name: true },
  })
  const testClientIds = testClients.map((c) => c.id)

  const testProducts = await prisma.storeInventoryProduct.findMany({
    where: {
      OR: [
        { sku: { startsWith: "QA-SKU-" } },
        { sku: { startsWith: "LC-" } },
        { name: { startsWith: "QA Product " } },
      ],
    },
    select: { id: true, sku: true, name: true },
  })
  const testProductIds = testProducts.map((p) => p.id)

  console.log(`Candidates:`)
  console.log(`  Guards   : ${testGuards.length}  (QA Guard* + LC-G-*)`)
  console.log(`  Clients  : ${testClients.length}  (QA Client*, QA-BL-*, Lifecycle *)`)
  console.log(`  Products : ${testProducts.length}  (QA-SKU-*, LC-*, QA Product *)`)
  console.log()

  const guardInclude = testGuardIds.length ? { guardId: { in: testGuardIds } } : { id: "__none__" }
  const clientInclude = testClientIds.length ? { clientId: { in: testClientIds } } : { id: "__none__" }
  const productInclude = testProductIds.length ? { productId: { in: testProductIds } } : { id: "__none__" }

  if (!execute) {
    // Count-only pass.
    const counts = await Promise.all([
      prisma.attendance.count({ where: { OR: [guardInclude, clientInclude] } }),
      prisma.deployment.count({ where: { OR: [guardInclude, clientInclude] } }),
      prisma.guardSupervisorAssignment.count({ where: guardInclude }),
      prisma.guardPrerequisite.count({ where: guardInclude }),
      prisma.guardServiceHistory.count({ where: { OR: [{ guardId: { in: testGuardIds } }, { cnic: { in: testGuards.map((g) => g.id) } }] } }).catch(() => 0),
      prisma.guardStatusHistory.count({ where: guardInclude }),
      prisma.clientContract.count({ where: clientInclude }),
      prisma.clientContractRate.count({ where: { contract: clientInclude } }).catch(() => 0),
      prisma.branch.count({ where: clientInclude }),
      prisma.storeInventoryAssignment.count({
        where: {
          OR: [
            { assignedToGuardId: { in: testGuardIds.length ? testGuardIds : ["__none__"] } },
            productInclude,
          ],
        },
      }),
      prisma.storeInventoryMovement.count({ where: productInclude }).catch(() => 0),
      prisma.storeInventoryBalance.count({ where: productInclude }).catch(() => 0),
    ])
    log("Attendance (linked)", counts[0])
    log("Deployment (linked)", counts[1])
    log("GuardSupervisorAssignment", counts[2])
    log("GuardPrerequisite", counts[3])
    log("GuardServiceHistory", counts[4])
    log("GuardStatusHistory", counts[5])
    log("ClientContract", counts[6])
    log("ClientContractRate", counts[7])
    log("Branch (test clients)", counts[8])
    log("StoreInventoryAssignment", counts[9])
    log("StoreInventoryMovement", counts[10])
    log("StoreInventoryBalance", counts[11])
    log("StoreInventoryProduct", testProducts.length)
    log("Guard", testGuards.length)
    log("Client", testClients.length)

    const lifecycleUsers = await prisma.user.count({
      where: { email: { endsWith: ".lifecycle@parwest.test" } },
    })
    log("User (lifecycle.*)", lifecycleUsers)

    console.log()
    console.log("[cleanup] Dry run only. Re-run with EXECUTE=true to apply.")
    await prisma.$disconnect()
    return
  }

  // Execute path — order matters (leaf rows first).
  const results = {}

  results.attendance = (await prisma.attendance.deleteMany({
    where: { OR: [guardInclude, clientInclude] },
  })).count

  results.deployment = (await prisma.deployment.deleteMany({
    where: { OR: [guardInclude, clientInclude] },
  })).count

  results.guardSupervisorAssignment = (await prisma.guardSupervisorAssignment.deleteMany({
    where: guardInclude,
  })).count

  results.guardPrerequisite = (await prisma.guardPrerequisite.deleteMany({
    where: guardInclude,
  })).count

  results.guardPrerequisiteHistory = await prisma.guardPrerequisiteHistory
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)

  results.guardAgeApproval = await prisma.guardAgeApproval
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)

  results.guardServiceHistory = await prisma.guardServiceHistory
    .deleteMany({ where: { guardId: { in: testGuardIds.length ? testGuardIds : ["__none__"] } } })
    .then((r) => r.count)
    .catch(() => 0)

  results.guardStatusHistory = (await prisma.guardStatusHistory.deleteMany({
    where: guardInclude,
  })).count

  results.storeInventoryAssignment = (await prisma.storeInventoryAssignment.deleteMany({
    where: {
      OR: [
        { assignedToGuardId: { in: testGuardIds.length ? testGuardIds : ["__none__"] } },
        productInclude,
      ],
    },
  })).count

  results.storeInventoryMovement = await prisma.storeInventoryMovement
    .deleteMany({ where: productInclude })
    .then((r) => r.count)
    .catch(() => 0)

  results.storeInventoryBalance = await prisma.storeInventoryBalance
    .deleteMany({ where: productInclude })
    .then((r) => r.count)
    .catch(() => 0)

  results.storeInventoryPurchaseLine = await prisma.storeInventoryPurchaseLine
    .deleteMany({ where: productInclude })
    .then((r) => r.count)
    .catch(() => 0)

  // Invoices + line items block client deletion if present.
  results.invoiceLineItem = await prisma.invoiceLineItem
    .deleteMany({ where: { invoice: clientInclude } })
    .then((r) => r.count)
    .catch(() => 0)
  results.invoiceAdvanceApplication = await prisma.invoiceAdvanceApplication
    .deleteMany({ where: { invoice: clientInclude } })
    .then((r) => r.count)
    .catch(() => 0)
  results.invoice = await prisma.invoice
    .deleteMany({ where: clientInclude })
    .then((r) => r.count)
    .catch(() => 0)

  // DeploymentRate (rate rows linked to client).
  results.deploymentRate = await prisma.deploymentRate
    .deleteMany({ where: clientInclude })
    .then((r) => r.count)
    .catch(() => 0)

  // PricingConfig already cascades via Client — explicit belt-and-braces.
  results.pricingConfig = await prisma.pricingConfig
    .deleteMany({ where: clientInclude })
    .then((r) => r.count)
    .catch(() => 0)

  // Payroll + dependents (linked via guardId or clientId).
  results.payrollSalarySlip = await prisma.payrollSalarySlip
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)
  results.payrollSpecialDuty = await prisma.payrollSpecialDuty
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)
  results.loan = await prisma.loan
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)
  results.payrollReserveLedger = await prisma.payrollReserveLedger
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)
  results.payroll = await prisma.payroll
    .deleteMany({ where: guardInclude })
    .then((r) => r.count)
    .catch(() => 0)

  results.clientContractRate = await prisma.clientContractRate
    .deleteMany({ where: { contract: clientInclude } })
    .then((r) => r.count)
    .catch(() => 0)

  results.clientContract = (await prisma.clientContract.deleteMany({
    where: clientInclude,
  })).count

  results.clientAdvancePayment = await prisma.clientAdvancePayment
    .deleteMany({ where: clientInclude })
    .then((r) => r.count)
    .catch(() => 0)

  results.branch = (await prisma.branch.deleteMany({ where: clientInclude })).count

  results.storeInventoryProduct = (await prisma.storeInventoryProduct.deleteMany({
    where: { id: { in: testProductIds.length ? testProductIds : ["__none__"] } },
  })).count

  results.guard = (await prisma.guard.deleteMany({
    where: { id: { in: testGuardIds.length ? testGuardIds : ["__none__"] } },
  })).count

  results.client = (await prisma.client.deleteMany({
    where: { id: { in: testClientIds.length ? testClientIds : ["__none__"] } },
  })).count

  results.user = (await prisma.user.deleteMany({
    where: { email: { endsWith: ".lifecycle@parwest.test" } },
  })).count

  console.log("Deleted:")
  for (const [k, v] of Object.entries(results)) log(k, v)

  console.log()
  console.log("[cleanup] Done.")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
