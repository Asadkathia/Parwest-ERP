# Parwest ERP - Quick Reference Guide

## 🚀 Getting Started

### Start Development Server
```bash
npm run dev
```
Access at: http://localhost:3000

### Default Login Credentials
- **Username:** admin
- **Password:** admin123

---

## 📋 Module Overview

### Guards Module
**Routes:**
- `/guards` - List all guards
- `/guards/new` - Create new guard
- `/guards/[id]` - View guard details

**Features:**
- Auto-generated Parwest IDs (PW-00001, PW-00002, etc.)
- CNIC uniqueness validation
- Search by name, CNIC, or Parwest ID
- Filter by status and region
- Comprehensive profile with deployment history

**API:**
- `POST /api/guards` - Create guard

---

### Clients Module
**Routes:**
- `/clients` - List all clients
- `/clients/new` - Create new client
- `/clients/[id]` - View client details
- `/clients/[id]/branches/new` - Add branch

**Features:**
- Multiple client types (Bank, Manufacturer, Retail, etc.)
- Branch management
- Tax and legal information (NTN, STRN)
- Branchless client option

**API:**
- `POST /api/clients` - Create client
- `POST /api/branches` - Create branch

---

### Deployments Module
**Routes:**
- `/deployments` - List all deployments
- `/deployments/new` - Create new deployment

**Features:**
- Assign guards to client branches
- Dynamic branch selection based on client
- Duplicate deployment prevention
- Deployment date tracking
- Status management

**API:**
- `POST /api/deployments` - Create deployment

---

### Users Module
**Routes:**
- `/users` - List all users

**Features:**
- User management
- Role assignment
- Status tracking

---

## 🎨 UI Components

### Status Badges
- **Active:** Green background
- **Inactive:** Gray background
- **Pending:** Orange background

### Form Patterns
All forms follow consistent patterns:
1. Section headers with borders
2. Required fields marked with red asterisk (*)
3. Loading states during submission
4. Error messages in red boxes
5. Cancel and Submit buttons

### Navigation
- **Sidebar:** Collapsible sections for each module
- **Active Route:** Highlighted in blue
- **Mobile:** Responsive hamburger menu

---

## 🔑 Key Features

### Auto-Generated IDs
Guards automatically receive sequential Parwest IDs:
- Format: `PW-XXXXX`
- Example: PW-00001, PW-00002, etc.

### Validation
- **Client-side:** HTML5 validation
- **Server-side:** API route validation
- **Unique constraints:** CNIC for guards

### Dynamic Forms
- Branch selection updates based on client
- Region-based filtering
- Conditional field display

---

## 📊 Database Models

### Primary Models
```
User
├── id (UUID)
├── username
├── email
├── password (hashed)
├── role (ADMIN, MANAGER, USER)
└── status

Guard
├── id (UUID)
├── parwestId (auto-generated)
├── name
├── cnic (unique)
├── phone, email
├── status (ACTIVE, INACTIVE, PENDING)
└── deployments[]

Client
├── id (UUID)
├── name
├── type (BANK, MANUFACTURER, etc.)
├── status
└── branches[]

Branch
├── id (UUID)
├── clientId
├── name
├── address, city, province
├── contactPerson, contactPhone
└── deployments[]

Deployment
├── id (UUID)
├── guardId
├── clientId
├── branchId
├── deploymentDate
├── designation
└── status
```

---

## 🛠️ Common Tasks

### Create a New Guard
1. Navigate to `/guards/new`
2. Fill in required fields (Name, CNIC, Phone, Email)
3. Add optional information (Address, Banking, Ex-Service)
4. Click "Save Guard"
5. Parwest ID is auto-generated

### Create a New Client
1. Navigate to `/clients/new`
2. Enter client name and type
3. Add contact and tax information
4. Click "Save Client"

### Add a Branch
1. Go to client detail page
2. Click "Add Branch"
3. Enter branch details
4. Click "Create Branch"

### Create a Deployment
1. Navigate to `/deployments/new`
2. Select guard (active only)
3. Select client
4. Select branch (filtered by client)
5. Set deployment date
6. Click "Create Deployment"

---

## 🐛 Troubleshooting

### Dev Server Won't Start
```bash
# Kill existing processes
pkill -f "node.*next"

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install

# Start server
npm run dev
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
brew services list

# Verify .env file
cat .env | grep DATABASE_URL

# Test connection
npx prisma db pull
```

### Authentication Issues
```bash
# Reset admin password
npx prisma studio
# Navigate to User table
# Update admin password hash
```

---

## 📁 Important Files

### Configuration
- `.env` - Environment variables
- `prisma.config.ts` - Prisma configuration
- `tailwind.config.ts` - Tailwind CSS config
- `next.config.ts` - Next.js configuration

### Core Files
- `src/lib/auth.ts` - Authentication logic
- `src/lib/db.ts` - Database client
- `src/components/sidebar.tsx` - Navigation
- `src/middleware.ts` - Route protection

### Database
- `prisma/schema.prisma` - Database schema
- `prisma/seed.ts` - Seed data

---

## 🔐 Security Notes

### Password Requirements
- Minimum 6 characters
- Hashed with bcrypt (10 rounds)

### Protected Routes
All dashboard routes require authentication:
- Middleware checks session
- Redirects to `/login` if not authenticated

### API Security
- All API routes check authentication
- Returns 401 if unauthorized
- Server-side validation on all inputs

---

## 📈 Performance Tips

### Database Queries
- Use `select` to limit fields
- Include related data with `include`
- Add indexes for frequently queried fields

### Form Optimization
- Client components only for interactive parts
- Server components for data fetching
- Use `router.refresh()` for optimistic updates

### Caching
- Next.js automatically caches server components
- Use `revalidatePath` for manual cache invalidation

---

## 🎯 Development Workflow

### Adding a New Module

1. **Create Pages**
   ```
   src/app/(dashboard)/[module]/
   ├── page.tsx (listing)
   ├── new/
   │   ├── page.tsx (server component)
   │   └── form.tsx (client component)
   └── [id]/
       └── page.tsx (detail view)
   ```

2. **Create API Route**
   ```
   src/app/api/[module]/
   └── route.ts
   ```

3. **Add to Sidebar**
   Edit `src/components/sidebar.tsx`

4. **Update Schema** (if needed)
   Edit `prisma/schema.prisma`
   Run `npx prisma migrate dev`

---

## 🚦 Status Codes

### HTTP Responses
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `404` - Not Found
- `500` - Server Error

---

## 📞 Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma migrate dev  # Create migration
npx prisma db push      # Push schema changes
npx prisma studio       # Open database GUI
npx prisma db seed      # Seed database

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript check
```

---

## 🎨 Styling Reference

### Common Classes
```css
/* Buttons */
.btn-primary: bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700

/* Cards */
.card: bg-white rounded-lg border p-6

/* Form Inputs */
.input: w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500

/* Status Badges */
.badge-active: bg-green-100 text-green-800 px-3 py-1 rounded-full
.badge-inactive: bg-gray-100 text-gray-800 px-3 py-1 rounded-full
```

---

**Last Updated:** February 10, 2026  
**Version:** 1.0.0-beta
