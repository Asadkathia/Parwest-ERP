// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Starting database seed...')

    // Create Super User role
    const superUserRole = await prisma.role.upsert({
        where: { name: 'Super User' },
        update: {},
        create: {
            name: 'Super User',
            description: 'Full system access',
        },
    })

    console.log('✓ Created Super User role')

    // Create Admin role
    const adminRole = await prisma.role.upsert({
        where: { name: 'Admin' },
        update: {},
        create: {
            name: 'Admin',
            description: 'Administrative access',
        },
    })

    console.log('✓ Created Admin role')

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
    const adminUser = await prisma.user.upsert({
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
