import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient, StoreInventoryAssignmentStatus, StoreInventoryAssignmentTargetType } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING

if (!databaseUrl) {
  console.error("[lifecycle-seed] Missing DATABASE_URL (or compatible Postgres env).")
  process.exit(1)
}

const execute = process.env.LIFECYCLE_E2E_SEED_EXECUTE === "true"
const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function dateOnly(d) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function makeCnic(seed) {
  const digits = String(seed).replace(/\D/g, "").padStart(13, "0").slice(-13)
  return digits
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log(`[lifecycle-seed] Started at ${new Date().toISOString()}`)
  console.log(`[lifecycle-seed] Mode: ${execute ? "execute" : "dry-run"}`)

  const planSummary = {
    roles: 4,
    users: 4,
    regions: 3,
    offices: 3,
    clients: 3,
    branches: 5,
    guards: 8,
    inventoryStores: 4,
    products: 10,
    guardAssignments: 7,
    deployments: 5,
    attendanceRows: 20,
  }

  console.log("[lifecycle-seed] Plan summary:")
  Object.entries(planSummary).forEach(([k, v]) => console.log(`  - ${k}: ${v}`))

  if (!execute) {
    console.log("[lifecycle-seed] Dry-run complete. Set LIFECYCLE_E2E_SEED_EXECUTE=true to write data.")
    return
  }

  const adminPasswordHash = await bcrypt.hash("admin123@", 10)
  const defaultPasswordHash = await bcrypt.hash("Test@1234", 10)

  const maxAttempts = 4
  const retryDelaysMs = [0, 1500, 3000, 5000]

  let lastError = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`[lifecycle-seed] Retrying transaction (${attempt}/${maxAttempts})...`)
      }
      const delay = retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)]
      if (delay > 0) await wait(delay)

      await (async (tx) => {
    // Roles
    await tx.role.upsert({
      where: { name: "Admin" },
      update: { description: "Administrative access" },
      create: { name: "Admin", description: "Administrative access" },
    })
    await tx.role.upsert({
      where: { name: "Manager" },
      update: { description: "Manager access" },
      create: { name: "Manager", description: "Manager access" },
    })
    await tx.role.upsert({
      where: { name: "Supervisor" },
      update: { description: "Supervisor access" },
      create: { name: "Supervisor", description: "Supervisor access" },
    })
    await tx.role.upsert({
      where: { name: "Operations" },
      update: { description: "Operations user" },
      create: { name: "Operations", description: "Operations user" },
    })

    const [adminRole, managerRole, supervisorRole, operationsRole] = await Promise.all([
      tx.role.findUniqueOrThrow({ where: { name: "Admin" } }),
      tx.role.findUniqueOrThrow({ where: { name: "Manager" } }),
      tx.role.findUniqueOrThrow({ where: { name: "Supervisor" } }),
      tx.role.findUniqueOrThrow({ where: { name: "Operations" } }),
    ])

    // Regions + offices
    await tx.region.upsert({ where: { name: "Lahore" }, update: {}, create: { name: "Lahore" } })
    await tx.region.upsert({ where: { name: "Karachi" }, update: {}, create: { name: "Karachi" } })
    await tx.region.upsert({ where: { name: "Islamabad" }, update: {}, create: { name: "Islamabad" } })

    const [lhrRegion, khiRegion, isbRegion] = await Promise.all([
      tx.region.findUniqueOrThrow({ where: { name: "Lahore" } }),
      tx.region.findUniqueOrThrow({ where: { name: "Karachi" } }),
      tx.region.findUniqueOrThrow({ where: { name: "Islamabad" } }),
    ])

    await tx.regionalOffice.upsert({
      where: { seriesCode: "LHR" },
      update: { name: "Lahore Head Office", address: "Lahore HQ", regionId: lhrRegion.id },
      create: {
        name: "Lahore Head Office",
        seriesCode: "LHR",
        officeHead: "Lifecycle Admin",
        phone: "042-111000001",
        mobile: "03000000001",
        address: "Lahore HQ",
        latitude: 31.5204,
        longitude: 74.3587,
        regionId: lhrRegion.id,
      },
    })
    await tx.regionalOffice.upsert({
      where: { seriesCode: "KHI" },
      update: { name: "Karachi Head Office", address: "Karachi HQ", regionId: khiRegion.id },
      create: {
        name: "Karachi Head Office",
        seriesCode: "KHI",
        officeHead: "Lifecycle Admin",
        phone: "021-111000002",
        mobile: "03000000002",
        address: "Karachi HQ",
        latitude: 24.8607,
        longitude: 67.0011,
        regionId: khiRegion.id,
      },
    })
    await tx.regionalOffice.upsert({
      where: { seriesCode: "ISB" },
      update: { name: "Islamabad Head Office", address: "Islamabad HQ", regionId: isbRegion.id },
      create: {
        name: "Islamabad Head Office",
        seriesCode: "ISB",
        officeHead: "Lifecycle Admin",
        phone: "051-111000003",
        mobile: "03000000003",
        address: "Islamabad HQ",
        latitude: 33.6844,
        longitude: 73.0479,
        regionId: isbRegion.id,
      },
    })

    const [lhrOffice, khiOffice] = await Promise.all([
      tx.regionalOffice.findUniqueOrThrow({ where: { seriesCode: "LHR" } }),
      tx.regionalOffice.findUniqueOrThrow({ where: { seriesCode: "KHI" } }),
    ])

    // Users
    await tx.user.upsert({
      where: { email: "admin@parwestgroup.com" },
      update: {
        name: "Admin",
        password: adminPasswordHash,
        roleId: adminRole.id,
        regionId: lhrRegion.id,
        regionalOfficeId: lhrOffice.id,
        status: "ACTIVE",
      },
      create: {
        name: "Admin",
        email: "admin@parwestgroup.com",
        password: adminPasswordHash,
        roleId: adminRole.id,
        regionId: lhrRegion.id,
        regionalOfficeId: lhrOffice.id,
        status: "ACTIVE",
      },
    })

    await tx.user.upsert({
      where: { email: "manager.lifecycle@parwest.test" },
      update: {
        name: "Manager Lifecycle",
        password: defaultPasswordHash,
        roleId: managerRole.id,
        regionId: lhrRegion.id,
        regionalOfficeId: lhrOffice.id,
        status: "ACTIVE",
      },
      create: {
        name: "Manager Lifecycle",
        email: "manager.lifecycle@parwest.test",
        password: defaultPasswordHash,
        roleId: managerRole.id,
        regionId: lhrRegion.id,
        regionalOfficeId: lhrOffice.id,
        status: "ACTIVE",
      },
    })

    await tx.user.upsert({
      where: { email: "supervisor.lifecycle@parwest.test" },
      update: {
        name: "Supervisor Lifecycle",
        password: defaultPasswordHash,
        roleId: supervisorRole.id,
        regionId: lhrRegion.id,
        regionalOfficeId: lhrOffice.id,
        status: "ACTIVE",
      },
      create: {
        name: "Supervisor Lifecycle",
        email: "supervisor.lifecycle@parwest.test",
        password: defaultPasswordHash,
        roleId: supervisorRole.id,
        regionId: lhrRegion.id,
        regionalOfficeId: lhrOffice.id,
        status: "ACTIVE",
      },
    })

    await tx.user.upsert({
      where: { email: "ops.lifecycle@parwest.test" },
      update: {
        name: "Ops Lifecycle",
        password: defaultPasswordHash,
        roleId: operationsRole.id,
        regionId: khiRegion.id,
        regionalOfficeId: khiOffice.id,
        status: "ACTIVE",
      },
      create: {
        name: "Ops Lifecycle",
        email: "ops.lifecycle@parwest.test",
        password: defaultPasswordHash,
        roleId: operationsRole.id,
        regionId: khiRegion.id,
        regionalOfficeId: khiOffice.id,
        status: "ACTIVE",
      },
    })

    const adminUser = await tx.user.findUniqueOrThrow({ where: { email: "admin@parwestgroup.com" } })

    // Optional permissions for clean admin testing
    const modules = ["GUARDS", "CLIENTS", "INVENTORY", "DEPLOYMENTS", "ATTENDANCE", "REPORTS", "SETTINGS"]
    for (const module of modules) {
      await tx.userPermission.upsert({
        where: { userId_module: { userId: adminUser.id, module } },
        update: {
          canCreate: true,
          canView: true,
          canUpdate: true,
          canDelete: true,
          canRequisition: true,
        },
        create: {
          userId: adminUser.id,
          module,
          canCreate: true,
          canView: true,
          canUpdate: true,
          canDelete: true,
          canRequisition: true,
        },
      })
    }

    // Client types
    await tx.clientType.upsert({ where: { name: "BANK" }, update: { label: "Bank" }, create: { name: "BANK", label: "Bank" } })
    await tx.clientType.upsert({ where: { name: "CORPORATE" }, update: { label: "Corporate" }, create: { name: "CORPORATE", label: "Corporate" } })

    // Clients
    const clientsData = [
      { name: "Lifecycle National Bank", type: "BANK", city: "Lahore", regionId: lhrRegion.id, regionalOfficeId: lhrOffice.id },
      { name: "Lifecycle Cash Center", type: "CORPORATE", city: "Karachi", regionId: khiRegion.id, regionalOfficeId: khiOffice.id },
      { name: "Lifecycle Logistics Hub", type: "CORPORATE", city: "Lahore", regionId: lhrRegion.id, regionalOfficeId: lhrOffice.id },
    ]
    const clients = []
    for (const clientData of clientsData) {
      const created = await tx.client.create({
        data: {
          ...clientData,
          status: "ACTIVE",
          enrollmentDate: daysAgo(120),
          contactPerson: "Client Ops",
          phone: "03001234567",
          assignedManagerId: adminUser.id,
        },
      })
      clients.push(created)
    }

    const branches = []
    branches.push(
      await tx.branch.create({
        data: {
          clientId: clients[0].id,
          name: "Lifecycle Branch Lahore Main",
          code: "LC-NB-LHR-001",
          city: "Lahore",
          type: "CONVENTIONAL",
          dayGuardCapacity: 8,
          nightGuardCapacity: 6,
          assignedManagerId: adminUser.id,
          enrollmentDate: daysAgo(90),
        },
      })
    )
    branches.push(
      await tx.branch.create({
        data: {
          clientId: clients[0].id,
          name: "Lifecycle Branch Lahore East",
          code: "LC-NB-LHR-002",
          city: "Lahore",
          type: "CONVENTIONAL",
          dayGuardCapacity: 4,
          nightGuardCapacity: 4,
          assignedManagerId: adminUser.id,
          enrollmentDate: daysAgo(80),
        },
      })
    )
    branches.push(
      await tx.branch.create({
        data: {
          clientId: clients[1].id,
          name: "Lifecycle Cash Karachi Center",
          code: "LC-CC-KHI-001",
          city: "Karachi",
          type: "CENTER",
          dayGuardCapacity: 10,
          nightGuardCapacity: 8,
          assignedManagerId: adminUser.id,
          enrollmentDate: daysAgo(75),
        },
      })
    )
    branches.push(
      await tx.branch.create({
        data: {
          clientId: clients[2].id,
          name: "Lifecycle Logistics Lahore North",
          code: "LC-LH-LHR-001",
          city: "Lahore",
          type: "YARD",
          dayGuardCapacity: 6,
          nightGuardCapacity: 6,
          assignedManagerId: adminUser.id,
          enrollmentDate: daysAgo(70),
        },
      })
    )
    branches.push(
      await tx.branch.create({
        data: {
          clientId: clients[2].id,
          name: "Lifecycle Logistics Lahore South",
          code: "LC-LH-LHR-002",
          city: "Lahore",
          type: "YARD",
          dayGuardCapacity: 5,
          nightGuardCapacity: 5,
          assignedManagerId: adminUser.id,
          enrollmentDate: daysAgo(65),
        },
      })
    )

    // Verification doc types
    const verificationDocTypes = [
      "Police Verification",
      "Character Certificate",
      "Training Certificate",
      "Medical Fitness",
    ]
    for (const [idx, name] of verificationDocTypes.entries()) {
      await tx.guardDocumentType.upsert({
        where: { name },
        update: { isActive: true, sortOrder: idx + 1, docCategory: "VERIFICATION" },
        create: { name, isActive: true, sortOrder: idx + 1, docCategory: "VERIFICATION" },
      })
    }

    // Inventory masters
    await tx.storeInventoryBrand.createMany({
      data: [{ name: "Lifecycle Tactical" }, { name: "Lifecycle Uniforms" }, { name: "Lifecycle Essentials" }],
      skipDuplicates: true,
    })
    await tx.storeInventoryUnit.createMany({
      data: [{ name: "Piece", shortCode: "PCS" }, { name: "Set", shortCode: "SET" }],
      skipDuplicates: true,
    })
    const categoriesSeed = [
      { name: "Uniform", canAssignGuard: true, canAssignEmployee: true, canAssignClient: true },
      { name: "Equipment", canAssignGuard: true, canAssignEmployee: true, canAssignClient: true },
      { name: "Accessories", canAssignGuard: true, canAssignEmployee: true, canAssignClient: true },
      { name: "Weapon", canAssignGuard: false, canAssignEmployee: false, canAssignClient: true },
      { name: "Ammunition", canAssignGuard: false, canAssignEmployee: false, canAssignClient: true },
    ]
    for (const category of categoriesSeed) {
      await tx.storeInventoryCategory.upsert({
        where: { name: category.name },
        update: category,
        create: category,
      })
    }
    await tx.storeInventoryConditionV2.createMany({
      data: [{ name: "New", description: "Brand new" }, { name: "Good", description: "Operational" }],
      skipDuplicates: true,
    })
    await tx.storeInventoryStatus.createMany({
      data: [{ name: "Active" }, { name: "Serviceable" }],
      skipDuplicates: true,
    })
    await tx.storeInventoryVariation.createMany({
      data: [{ name: "Large / Blue" }, { name: "Medium / Black" }, { name: "Standard / Grey" }],
      skipDuplicates: true,
    })
    await tx.storeInventoryWeaponType.createMany({
      data: [{ name: "9MM Pistol" }, { name: "SMG" }],
      skipDuplicates: true,
    })
    await tx.storeInventoryCalibre.createMany({
      data: [{ name: "9MM" }, { name: "7.62MM" }],
      skipDuplicates: true,
    })
    await tx.storeInventoryLicenseType.createMany({
      data: [{ name: "Duty License" }],
      skipDuplicates: true,
    })

    const [defaultBrand, pieceUnit, newCondition, activeStatus] = await Promise.all([
      tx.storeInventoryBrand.findFirstOrThrow({ where: { name: "Lifecycle Tactical" } }),
      tx.storeInventoryUnit.findFirstOrThrow({ where: { name: "Piece" } }),
      tx.storeInventoryConditionV2.findFirstOrThrow({ where: { name: "New" } }),
      tx.storeInventoryStatus.findFirstOrThrow({ where: { name: "Active" } }),
    ])

    const categories = await tx.storeInventoryCategory.findMany()
    const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]))

    // Stores
    const storesData = [
      {
        code: "WH-LHR-MAIN",
        name: "Lifecycle Warehouse Lahore",
        type: "WAREHOUSE",
        prefix: "LHR",
        regionalOfficeId: lhrOffice.id,
        address: "Warehouse Lahore",
        contactNumber: "03005550001",
      },
      {
        code: "ST-LHR-ALPHA",
        name: "Lifecycle Store Lahore Alpha",
        type: "STORE",
        prefix: "LHA",
        regionalOfficeId: lhrOffice.id,
        address: "Store Lahore Alpha",
        contactNumber: "03005550002",
      },
      {
        code: "ST-LHR-BRAVO",
        name: "Lifecycle Store Lahore Bravo",
        type: "STORE",
        prefix: "LHB",
        regionalOfficeId: lhrOffice.id,
        address: "Store Lahore Bravo",
        contactNumber: "03005550003",
      },
      {
        code: "ST-KHI-ALPHA",
        name: "Lifecycle Store Karachi Alpha",
        type: "STORE",
        prefix: "KHA",
        regionalOfficeId: khiOffice.id,
        address: "Store Karachi Alpha",
        contactNumber: "03005550004",
      },
    ]
    for (const store of storesData) {
      await tx.store.upsert({
        where: { code: store.code },
        update: store,
        create: store,
      })
    }
    const stores = await tx.store.findMany({ where: { code: { in: storesData.map((s) => s.code) } } })
    const storeByCode = Object.fromEntries(stores.map((s) => [s.code, s]))

    // Products
    const productsData = [
      { sku: "LC-UNF-SHIRT-001", name: "Lifecycle Uniform Shirt", category: "Uniform", serialRequired: false, variation: "Large / Blue" },
      { sku: "LC-UNF-PANT-001", name: "Lifecycle Uniform Pant", category: "Uniform", serialRequired: false, variation: "Medium / Black" },
      { sku: "LC-ACC-BELT-001", name: "Lifecycle Duty Belt", category: "Accessories", serialRequired: false, variation: "Standard / Grey" },
      { sku: "LC-EQP-RADIO-001", name: "Lifecycle Radio Set", category: "Equipment", serialRequired: true, variation: "Standard / Grey" },
      { sku: "LC-EQP-TORCH-001", name: "Lifecycle Tactical Torch", category: "Equipment", serialRequired: false, variation: "Standard / Grey" },
      { sku: "LC-EQP-HELMET-001", name: "Lifecycle Helmet", category: "Equipment", serialRequired: false, variation: "Standard / Grey" },
      { sku: "LC-WPN-9MM-001", name: "Lifecycle Pistol 9MM", category: "Weapon", serialRequired: true },
      { sku: "LC-WPN-SMG-001", name: "Lifecycle SMG", category: "Weapon", serialRequired: true },
      { sku: "LC-AMMO-9MM-001", name: "Lifecycle Ammo 9MM Box", category: "Ammunition", serialRequired: false },
      { sku: "LC-AMMO-762-001", name: "Lifecycle Ammo 7.62 Box", category: "Ammunition", serialRequired: false },
    ]

    const defaultVariation = await tx.storeInventoryVariation.findFirst({ where: { name: "Standard / Grey" } })
    const weaponType9mm = await tx.storeInventoryWeaponType.findFirst({ where: { name: "9MM Pistol" } })
    const weaponTypeSmg = await tx.storeInventoryWeaponType.findFirst({ where: { name: "SMG" } })
    const calibre9mm = await tx.storeInventoryCalibre.findFirst({ where: { name: "9MM" } })
    const calibre762 = await tx.storeInventoryCalibre.findFirst({ where: { name: "7.62MM" } })
    const dutyLicenseType = await tx.storeInventoryLicenseType.findFirst({ where: { name: "Duty License" } })

    for (const product of productsData) {
      const isWeapon = product.category === "Weapon"
      const isAmmo = product.category === "Ammunition"
      await tx.storeInventoryProduct.upsert({
        where: { sku: product.sku },
        update: {
          name: product.name,
          serialRequired: product.serialRequired,
          brandId: defaultBrand.id,
          unitId: pieceUnit.id,
          statusId: activeStatus.id,
          conditionId: newCondition.id,
          categoryId: categoryByName[product.category]?.id ?? null,
          variationId: defaultVariation?.id ?? null,
          weaponTypeId: isWeapon ? (product.sku.includes("SMG") ? weaponTypeSmg?.id : weaponType9mm?.id) ?? null : null,
          calibreId: isWeapon || isAmmo ? (product.sku.includes("762") ? calibre762?.id : calibre9mm?.id) ?? null : null,
          licenseTypeId: isWeapon ? dutyLicenseType?.id ?? null : null,
          description: "Lifecycle E2E seeded product",
        },
        create: {
          sku: product.sku,
          name: product.name,
          serialRequired: product.serialRequired,
          brandId: defaultBrand.id,
          unitId: pieceUnit.id,
          statusId: activeStatus.id,
          conditionId: newCondition.id,
          categoryId: categoryByName[product.category]?.id ?? null,
          variationId: defaultVariation?.id ?? null,
          weaponTypeId: isWeapon ? (product.sku.includes("SMG") ? weaponTypeSmg?.id : weaponType9mm?.id) ?? null : null,
          calibreId: isWeapon || isAmmo ? (product.sku.includes("762") ? calibre762?.id : calibre9mm?.id) ?? null : null,
          licenseTypeId: isWeapon ? dutyLicenseType?.id ?? null : null,
          description: "Lifecycle E2E seeded product",
        },
      })
    }

    const seededProducts = await tx.storeInventoryProduct.findMany({ where: { sku: { in: productsData.map((p) => p.sku) } } })

    // Balances across stores
    for (const product of seededProducts) {
      for (const store of stores) {
        const isWarehouse = store.type === "WAREHOUSE"
        const baseQty = isWarehouse ? 300 : 40
        const extra = (product.name.length + store.name.length) % 30
        const quantityOnHand = baseQty + extra
        const quantityHeld = isWarehouse ? 0 : extra % 3
        const quantityIssued = isWarehouse ? 0 : extra % 8

        await tx.storeInventoryBalance.upsert({
          where: { storeId_productId: { storeId: store.id, productId: product.id } },
          update: {
            quantityOnHand,
            quantityHeld,
            quantityIssued,
            avgUnitCost: Number((1000 + extra * 10).toFixed(2)),
          },
          create: {
            storeId: store.id,
            productId: product.id,
            quantityOnHand,
            quantityHeld,
            quantityIssued,
            avgUnitCost: Number((1000 + extra * 10).toFixed(2)),
          },
        })
      }
    }

    // Guards
    const guardsSeed = [
      { parwestId: "LC-G-0001", name: "Lifecycle Guard Enrolled", cnic: makeCnic("4200100000001"), status: "PENDING", officeId: lhrOffice.id, regionId: lhrRegion.id },
      { parwestId: "LC-G-0002", name: "Lifecycle Guard Verified", cnic: makeCnic("4200100000002"), status: "ACTIVE", officeId: lhrOffice.id, regionId: lhrRegion.id },
      { parwestId: "LC-G-0003", name: "Lifecycle Guard Assigned", cnic: makeCnic("4200100000003"), status: "ACTIVE", officeId: lhrOffice.id, regionId: lhrRegion.id },
      { parwestId: "LC-G-0004", name: "Lifecycle Guard Deployed Active", cnic: makeCnic("4200100000004"), status: "ACTIVE", officeId: lhrOffice.id, regionId: lhrRegion.id },
      { parwestId: "LC-G-0005", name: "Lifecycle Guard History+Active", cnic: makeCnic("4200100000005"), status: "ACTIVE", officeId: lhrOffice.id, regionId: lhrRegion.id },
      { parwestId: "LC-G-0006", name: "Lifecycle Guard Deployment Ended", cnic: makeCnic("4200100000006"), status: "ACTIVE", officeId: lhrOffice.id, regionId: lhrRegion.id },
      { parwestId: "LC-G-0007", name: "Lifecycle Guard Karachi Active", cnic: makeCnic("4200100000007"), status: "ACTIVE", officeId: khiOffice.id, regionId: khiRegion.id },
      { parwestId: "LC-G-0008", name: "Lifecycle Guard Inactive", cnic: makeCnic("4200100000008"), status: "INACTIVE", officeId: khiOffice.id, regionId: khiRegion.id },
    ]

    const guards = []
    for (const guard of guardsSeed) {
      guards.push(
        await tx.guard.create({
          data: {
            parwestId: guard.parwestId,
            name: guard.name,
            cnic: guard.cnic,
            phone: "03001112233",
            joiningDate: daysAgo(150),
            dateOfBirth: daysAgo(10000),
            status: guard.status,
            regionalOfficeId: guard.officeId,
            regionId: guard.regionId,
            designation: "Security Guard",
          },
        })
      )
    }
    const guardByParwestId = Object.fromEntries(guards.map((g) => [g.parwestId, g]))

    // Guard prerequisites (verification lifecycle)
    const verifiedGuards = ["LC-G-0002", "LC-G-0003", "LC-G-0004", "LC-G-0005", "LC-G-0006", "LC-G-0007"]
    for (const docTypeName of verificationDocTypes) {
      // enrolled-only pending record
      await tx.guardPrerequisite.create({
        data: {
          guardId: guardByParwestId["LC-G-0001"].id,
          docTypeName,
          status: "PENDING",
          verificationStatus: "REQUEST_PENDING",
        },
      })

      for (const parwestId of verifiedGuards) {
        await tx.guardPrerequisite.create({
          data: {
            guardId: guardByParwestId[parwestId].id,
            docTypeName,
            status: "VERIFIED",
            verificationStatus: "VERIFIED",
            verifiedAt: daysAgo(40),
            verifiedBy: adminUser.id,
          },
        })
      }
    }

    // Deployment rule: active and requires at least one assigned item
    const uniformCategoryId = categoryByName["Uniform"]?.id ?? null
    await tx.guardDeploymentInventoryRule.upsert({
      where: { ruleKey: "default" },
      update: {
        isActive: true,
        minimumAssignedItems: 1,
        allowedCategoryIds: uniformCategoryId ? [uniformCategoryId] : [],
      },
      create: {
        ruleKey: "default",
        isActive: true,
        minimumAssignedItems: 1,
        allowedCategoryIds: uniformCategoryId ? [uniformCategoryId] : [],
      },
    })

    // Assign inventory to lifecycle guards
    const lhrStore = storeByCode["ST-LHR-ALPHA"]
    const assignedProducts = seededProducts.filter((p) =>
      ["LC-UNF-SHIRT-001", "LC-UNF-PANT-001", "LC-ACC-BELT-001", "LC-EQP-RADIO-001"].includes(p.sku)
    )
    const productBySku = Object.fromEntries(assignedProducts.map((p) => [p.sku, p]))

    const assignmentPlan = [
      { guard: "LC-G-0003", sku: "LC-UNF-SHIRT-001", qty: 1, assignedAt: daysAgo(12), status: StoreInventoryAssignmentStatus.ASSIGNED },
      { guard: "LC-G-0003", sku: "LC-ACC-BELT-001", qty: 1, assignedAt: daysAgo(12), status: StoreInventoryAssignmentStatus.ASSIGNED },
      { guard: "LC-G-0004", sku: "LC-UNF-SHIRT-001", qty: 1, assignedAt: daysAgo(15), status: StoreInventoryAssignmentStatus.ASSIGNED },
      { guard: "LC-G-0004", sku: "LC-UNF-PANT-001", qty: 1, assignedAt: daysAgo(15), status: StoreInventoryAssignmentStatus.ASSIGNED },
      { guard: "LC-G-0005", sku: "LC-UNF-SHIRT-001", qty: 1, assignedAt: daysAgo(20), status: StoreInventoryAssignmentStatus.ASSIGNED },
      { guard: "LC-G-0006", sku: "LC-EQP-RADIO-001", qty: 1, assignedAt: daysAgo(35), status: StoreInventoryAssignmentStatus.RETURNED, returnedAt: daysAgo(5) },
      { guard: "LC-G-0007", sku: "LC-UNF-SHIRT-001", qty: 1, assignedAt: daysAgo(8), status: StoreInventoryAssignmentStatus.ASSIGNED },
    ]

    for (const row of assignmentPlan) {
      await tx.storeInventoryAssignment.create({
        data: {
          storeId: lhrStore.id,
          productId: productBySku[row.sku].id,
          quantity: row.qty,
          status: row.status,
          assignedToType: StoreInventoryAssignmentTargetType.GUARD,
          assignedToGuardId: guardByParwestId[row.guard].id,
          assignedByUserId: adminUser.id,
          assignedAt: row.assignedAt,
          returnedAt: row.returnedAt ?? null,
          notes: "Lifecycle seed assignment",
        },
      })
    }

    // Deployments + history
    const deploymentRows = []

    deploymentRows.push(
      await tx.deployment.create({
        data: {
          guardId: guardByParwestId["LC-G-0004"].id,
          clientId: clients[0].id,
          branchId: branches[0].id,
          regionalOfficeId: lhrOffice.id,
          designation: "Security Guard",
          deploymentDate: daysAgo(20),
          shiftType: "DAY",
          deploymentType: "REGULAR",
          deploymentNature: "PERMANENT",
          status: "ACTIVE",
          deployedByName: "Admin",
          notes: "Active lifecycle deployment",
        },
      })
    )

    deploymentRows.push(
      await tx.deployment.create({
        data: {
          guardId: guardByParwestId["LC-G-0005"].id,
          clientId: clients[1].id,
          branchId: branches[2].id,
          regionalOfficeId: khiOffice.id,
          designation: "Security Guard",
          deploymentDate: daysAgo(90),
          shiftType: "NIGHT",
          deploymentType: "REGULAR",
          deploymentNature: "PERMANENT",
          status: "INACTIVE",
          endDate: daysAgo(35),
          endReason: "Rotation completed",
          deployedByName: "Admin",
          revokedByName: "Admin",
          notes: "Historical deployment",
        },
      })
    )

    deploymentRows.push(
      await tx.deployment.create({
        data: {
          guardId: guardByParwestId["LC-G-0005"].id,
          clientId: clients[0].id,
          branchId: branches[1].id,
          regionalOfficeId: lhrOffice.id,
          designation: "Security Guard",
          deploymentDate: daysAgo(10),
          shiftType: "DAY",
          deploymentType: "REGULAR",
          deploymentNature: "PERMANENT",
          status: "ACTIVE",
          deployedByName: "Admin",
          notes: "Current deployment after rotation",
        },
      })
    )

    deploymentRows.push(
      await tx.deployment.create({
        data: {
          guardId: guardByParwestId["LC-G-0006"].id,
          clientId: clients[2].id,
          branchId: branches[3].id,
          regionalOfficeId: lhrOffice.id,
          designation: "Security Guard",
          deploymentDate: daysAgo(45),
          shiftType: "NIGHT",
          deploymentType: "TEMP",
          deploymentNature: "TEMPORARY",
          status: "INACTIVE",
          endDate: daysAgo(7),
          endReason: "Client contract hold",
          deployedByName: "Admin",
          revokedByName: "Admin",
          notes: "Ended deployment for status testing",
        },
      })
    )

    deploymentRows.push(
      await tx.deployment.create({
        data: {
          guardId: guardByParwestId["LC-G-0007"].id,
          clientId: clients[1].id,
          branchId: branches[2].id,
          regionalOfficeId: khiOffice.id,
          designation: "Security Guard",
          deploymentDate: daysAgo(14),
          shiftType: "BOTH",
          deploymentType: "REGULAR",
          deploymentNature: "PERMANENT",
          status: "ACTIVE",
          deployedByName: "Admin",
          notes: "Karachi active deployment",
        },
      })
    )

    const deploymentByGuard = new Map()
    for (const d of deploymentRows) {
      const list = deploymentByGuard.get(d.guardId) ?? []
      list.push(d)
      deploymentByGuard.set(d.guardId, list)
    }

    // Attendance rows for outputs
    const attendanceData = []

    // Guard 4 active last 7 days
    for (let i = 0; i < 7; i += 1) {
      attendanceData.push({
        guardId: guardByParwestId["LC-G-0004"].id,
        date: dateOnly(daysAgo(i)),
        status: i === 3 ? "ABSENT" : "PRESENT",
        shiftType: "DAY",
        attendanceType: "PRESENT",
        deploymentId: deploymentByGuard.get(guardByParwestId["LC-G-0004"].id)[0].id,
        clientId: clients[0].id,
        clientName: clients[0].name,
        isAutoGenerated: true,
      })
    }

    // Guard 5 historical + current
    for (let i = 40; i < 33; i += 1) {
      attendanceData.push({
        guardId: guardByParwestId["LC-G-0005"].id,
        date: dateOnly(daysAgo(i)),
        status: "PRESENT",
        shiftType: "NIGHT",
        attendanceType: "PRESENT",
        deploymentId: deploymentByGuard.get(guardByParwestId["LC-G-0005"].id)[0].id,
        clientId: clients[1].id,
        clientName: clients[1].name,
        isAutoGenerated: true,
      })
    }
    for (let i = 6; i >= 0; i -= 1) {
      attendanceData.push({
        guardId: guardByParwestId["LC-G-0005"].id,
        date: dateOnly(daysAgo(i)),
        status: "PRESENT",
        shiftType: "DAY",
        attendanceType: "PRESENT",
        deploymentId: deploymentByGuard.get(guardByParwestId["LC-G-0005"].id)[1].id,
        clientId: clients[0].id,
        clientName: clients[0].name,
        isAutoGenerated: true,
      })
    }

    // Guard 7 active Karachi
    for (let i = 4; i >= 0; i -= 1) {
      attendanceData.push({
        guardId: guardByParwestId["LC-G-0007"].id,
        date: dateOnly(daysAgo(i)),
        status: "PRESENT",
        shiftType: "BOTH",
        attendanceType: "PRESENT",
        deploymentId: deploymentByGuard.get(guardByParwestId["LC-G-0007"].id)[0].id,
        clientId: clients[1].id,
        clientName: clients[1].name,
        isAutoGenerated: true,
      })
    }

    await tx.attendance.createMany({
      data: attendanceData,
      skipDuplicates: true,
    })

    // Reconcile issued quantity on balances using active assignments only
    const activeAssignments = await tx.storeInventoryAssignment.findMany({
      where: { status: StoreInventoryAssignmentStatus.ASSIGNED },
      select: { storeId: true, productId: true, quantity: true },
    })
    const byStoreProduct = new Map()
    for (const row of activeAssignments) {
      const key = `${row.storeId}:${row.productId}`
      byStoreProduct.set(key, (byStoreProduct.get(key) ?? 0) + row.quantity)
    }

    for (const [key, qtyIssued] of byStoreProduct.entries()) {
      const [storeId, productId] = key.split(":")
      const existing = await tx.storeInventoryBalance.findUnique({
        where: { storeId_productId: { storeId, productId } },
        select: { quantityOnHand: true, quantityHeld: true },
      })
      if (!existing) continue

      await tx.storeInventoryBalance.update({
        where: { storeId_productId: { storeId, productId } },
        data: {
          quantityIssued: qtyIssued,
          quantityOnHand: Math.max(existing.quantityOnHand, qtyIssued + (existing.quantityHeld ?? 0)),
        },
      })
    }
      })(prisma)

      lastError = null
      break
    } catch (error) {
      lastError = error
      const message = String(error?.message ?? "")
      const isRetryable =
        message.includes("Unable to start a transaction in the given time") ||
        message.includes("Timed out trying to acquire a postgres advisory lock")

      if (!isRetryable || attempt === maxAttempts) {
        throw error
      }
      console.warn(`[lifecycle-seed] Transaction start timeout on attempt ${attempt}; will retry.`)
    }
  }

  if (lastError) {
    throw lastError
  }

  console.log("[lifecycle-seed] Seed applied successfully.")
  console.log("[lifecycle-seed] Login users:")
  console.log("  - admin@parwestgroup.com / admin123@")
  console.log("  - manager.lifecycle@parwest.test / Test@1234")
  console.log("  - supervisor.lifecycle@parwest.test / Test@1234")
  console.log("[lifecycle-seed] Guard lifecycle test data includes enrolled, verified, assigned, active deployment, ended deployment, and attendance history.")
}

main()
  .catch((error) => {
    console.error("[lifecycle-seed] Failed:", error.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
