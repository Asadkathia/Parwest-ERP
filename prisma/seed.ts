import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING

if (!databaseUrl) {
    throw new Error("Database URL is required to run seed.")
}

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Starting database seed...')

    // Create Super User role (only GLOBAL-scoped role).
    await prisma.role.upsert({
        where: { name: 'Super User' },
        update: { scopeType: 'GLOBAL' },
        create: {
            name: 'Super User',
            description: 'Full system access',
            scopeType: 'GLOBAL',
        },
    })

    console.log('✓ Created Super User role')

    // Create Admin role. REGIONAL by default; users with this role AND zero
    // assigned permissions still hit the SuperAdmin bypass in isSuperAdmin().
    const adminRole = await prisma.role.upsert({
        where: { name: 'Admin' },
        update: {},
        create: {
            name: 'Admin',
            description: 'Administrative access',
        },
    })

    console.log('✓ Created Admin role')

    // Regional Admin — administrative access scoped to a single region/office.
    await prisma.role.upsert({
        where: { name: 'Regional Admin' },
        update: {},
        create: {
            name: 'Regional Admin',
            description: 'Administrative access scoped to an assigned region and office.',
        },
    })

    console.log('✓ Created Regional Admin role')

    // Create Manager role
    await prisma.role.upsert({
        where: { name: 'Manager' },
        update: {},
        create: {
            name: 'Manager',
            description: 'Manager access',
        },
    })

    console.log('✓ Created Manager role')

    // Create Supervisor role
    await prisma.role.upsert({
        where: { name: 'Supervisor' },
        update: {},
        create: {
            name: 'Supervisor',
            description: 'Supervisor access',
        },
    })

    console.log('✓ Created Supervisor role')

    // Create default region
    const defaultRegion = await prisma.region.upsert({
        where: { name: 'Lahore' },
        update: {},
        create: {
            name: 'Lahore',
        },
    })

    console.log('✓ Created default region')

    // Create default regional office
    const defaultOffice = await prisma.regionalOffice.upsert({
        where: { seriesCode: 'L' },
        update: {},
        create: {
            name: 'Lahore Head Office',
            seriesCode: 'L',
            officeHead: 'Admin',
            regionId: defaultRegion.id,
        },
    })

    console.log('✓ Created default regional office')

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123@', 10)

    // Create admin user
    await prisma.user.upsert({
        where: { email: 'admin@parwestgroup.com' },
        update: {},
        create: {
            name: 'Admin',
            email: 'admin@parwestgroup.com',
            password: hashedPassword,
            roleId: adminRole.id,
            regionId: defaultRegion.id,
            regionalOfficeId: defaultOffice.id,
            status: 'ACTIVE',
        },
    })

    console.log('✓ Created admin user')

    // Create ticket categories
    await prisma.ticketCategory.upsert({
        where: { name: 'General' },
        update: {},
        create: {
            name: 'General',
            description: 'General inquiries',
            color: '#3B82F6',
        },
    })

    await prisma.ticketCategory.upsert({
        where: { name: 'Technical' },
        update: {},
        create: {
            name: 'Technical',
            description: 'Technical issues',
            color: '#EF4444',
        },
    })

    console.log('✓ Created ticket categories')

    // Create ticket priorities
    await prisma.ticketPriority.upsert({
        where: { name: 'Low' },
        update: {},
        create: {
            name: 'Low',
            color: '#10B981',
        },
    })

    await prisma.ticketPriority.upsert({
        where: { name: 'Normal' },
        update: {},
        create: {
            name: 'Normal',
            color: '#3B82F6',
        },
    })

    await prisma.ticketPriority.upsert({
        where: { name: 'High' },
        update: {},
        create: {
            name: 'High',
            color: '#EF4444',
        },
    })

    console.log('✓ Created ticket priorities')

    // Create ticket statuses
    await prisma.ticketStatus.upsert({
        where: { name: 'New' },
        update: {},
        create: {
            name: 'New',
            color: '#3B82F6',
        },
    })

    await prisma.ticketStatus.upsert({
        where: { name: 'Open' },
        update: {},
        create: {
            name: 'Open',
            color: '#F59E0B',
        },
    })

    await prisma.ticketStatus.upsert({
        where: { name: 'Closed' },
        update: {},
        create: {
            name: 'Closed',
            color: '#10B981',
        },
    })

    console.log('✓ Created ticket statuses')

    // Create inventory categories
    await prisma.inventoryCategory.upsert({
        where: { name: 'WEAPON' },
        update: {},
        create: {
            name: 'WEAPON',
        },
    })

    await prisma.inventoryCategory.upsert({
        where: { name: 'UNIFORM' },
        update: {},
        create: {
            name: 'UNIFORM',
        },
    })

    await prisma.inventoryCategory.upsert({
        where: { name: 'EQUIPMENT' },
        update: {},
        create: {
            name: 'EQUIPMENT',
        },
    })

    console.log('✓ Created inventory categories')

    // Store Inventory v2 categories (separate table from InventoryCategory).
    // Weapon/Ammo are required so weapon-specific product fields can render
    // in ProductsManager and purchases/assignments can be scoped by type.
    for (const [name, canAssignGuard] of [
        ['Weapon', true],
        ['Ammo', true],
        ['Uniform', true],
        ['Equipment', true],
    ] as const) {
        await prisma.storeInventoryCategory.upsert({
            where: { name },
            update: {},
            create: { name, canAssignGuard },
        })
    }
    console.log('✓ Created store-inventory v2 categories')

    // OJT Training categories — admin-managed lookup; safe defaults seeded once.
    const trainingCategoryDefaults: Array<{ name: string; sortOrder: number; description?: string }> = [
        { name: 'Basic Drill', sortOrder: 10 },
        { name: 'Firearms Handling', sortOrder: 20 },
        { name: 'Crowd Control', sortOrder: 30 },
        { name: 'Fire Safety', sortOrder: 40 },
        { name: 'First Aid', sortOrder: 50 },
        { name: 'Customer Service', sortOrder: 60 },
    ]
    for (const cat of trainingCategoryDefaults) {
        await prisma.trainingCategory.upsert({
            where: { name: cat.name },
            update: { sortOrder: cat.sortOrder },
            create: { name: cat.name, sortOrder: cat.sortOrder, description: cat.description },
        })
    }
    console.log('✓ Created OJT training categories')

    console.log('\n✅ Database seeded successfully!')
    console.log('\n📝 Login credentials:')
    console.log('   Email: admin@parwestgroup.com')
    console.log('   Password: admin123@')
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
