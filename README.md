# Parwest ERP System

A comprehensive Enterprise Resource Planning (ERP) system built for Parwest Security Services, managing guards, clients, payroll, inventory, and more.

## 🚀 Features

### Guards Module 
- **Guard Management**: Complete CRUD operations for guard profiles
- **18 Profile Tabs**: General Info, Attachments, Attendance, Salaries, Deployments, Verifications, Bank Details, and more
- **Deployment Management**: Track guard deployments across client locations
- **Attendance Tracking**: Monitor guard attendance with detailed reports
- **Blacklist & Inactive Management**: Manage guard status and restrictions
- **Residence Assignment**: Assign guards to company residences
- **Training Management**: Track on-job trainings and certifications
- **Prerequisites**: Manage guard verification requirements

### Clients Module
- Client and Branch Management
- Pricing Configuration
- Invoice Prerequisites
- Invoiced Billings
- Client Search (V1 & V2)
- Types & Locations Management

### Payroll Module
- Salary Processing
- Loan Management
- Extra Hours Tracking
- Special Duty Payments
- Unpaid Salaries Reports
- Comprehensive Payroll Reports

### Inventory Module
- Item Management
- Category & Vendor Management
- Stock In/Out Operations
- Item Assignment to Guards
- Condemned Items Tracking
- Demand Management

### Users Module
- User Management with Roles & Permissions
- Manager/Supervisor Relationships
- Client/Supervisor Relationships
- Supervisor Switching

### Additional Modules
- **Ticketing System**: Issue tracking and resolution
- **Reports**: Comprehensive reporting across all modules
- **Settings**: System configuration and regional office management
- **Audit**: Activity logging and audit trails
- **Imports**: Bulk data import functionality

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **UI Components**: Lucide Icons
- **Deployment**: Vercel-ready

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Asadkathia/Parwest-ERP.git
   cd Parwest-ERP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<neon-pooler-host>/neondb?sslmode=require&channel_binding=require"
   DATABASE_URL_UNPOOLED="postgresql://<user>:<password>@<neon-direct-host>/neondb?sslmode=require&channel_binding=require"
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="https://your-domain.vercel.app"
   ```

4. **Run database migrations**
   ```bash
   npx prisma generate
   npm run db:migrate:deploy
   npm run db:verify:schema
   ```

5. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Main application pages
│   │   ├── guards/          # Guards module
│   │   ├── clients/         # Clients module
│   │   ├── payroll/         # Payroll module
│   │   ├── inventory/       # Inventory module
│   │   ├── users/           # Users module
│   │   └── ...
│   └── api/                 # API routes
├── components/
│   ├── guards/              # Guard-specific components
│   │   └── tabs/            # Guard profile tab components
│   ├── shared/              # Reusable components
│   └── ui/                  # UI components
├── lib/
│   ├── auth.ts              # Authentication configuration
│   ├── db.ts                # Database client
│   └── mockData/            # Mock data for development
└── prisma/
    └── schema.prisma        # Database schema
```

## 🎯 Development Approach

This project follows a **Frontend-First Development** strategy:

1. **Phase 1**: Guards Module (Completed ✅)
   - Guard profile with 18 tabs
   - All guard operations pages
   - Mock data integration

2. **Phase 2**: Payroll Module (In Progress)
3. **Phase 3**: Clients Module
4. **Phase 4**: Inventory Module
5. **Phase 5**: Users & Permissions
6. **Phase 6**: Ticketing System
7. **Phase 7**: Settings & Configuration
8. **Phase 8**: Reports & Analytics

## 🔐 Authentication

Default credentials for development:
- **Email**: admin@parwest.com
- **Password**: admin123

## 📊 Database Schema

The system uses Prisma ORM with the following main models:
- User
- Guard
- Client
- Branch
- Deployment
- Attendance
- Training
- Inventory
- Invoice
- And more...

## 🚢 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

Required for production database deployments:

- `DATABASE_URL` (pooled/runtime URL)
- `DATABASE_URL_UNPOOLED` (recommended for migrations)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Important:

- Do not set `SKIP_DB_MIGRATIONS=true` unless you are intentionally running without database migrations.
- Build pipeline runs `prisma migrate deploy` and DB schema verification before `next build`.

### Manual Deployment

```bash
npm run build
npm start
```

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma Studio (Database GUI)
- `npx prisma generate` - Generate Prisma Client
- `npx prisma db push` - Push schema changes to database

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software developed for Parwest Security Services.

## 👥 Authors

- **Asad Kathia** - Initial work - [Asadkathia](https://github.com/Asadkathia)

## 🙏 Acknowledgments

- Built with Next.js and modern web technologies
- UI inspired by modern ERP systems
- Designed for scalability and maintainability

## 📞 Support

For support, email support@parwest.com or open an issue in the repository.

---

**Note**: This is an active development project. Features are being added continuously following the implementation plan.
