# 💰 ASL Finance Hub

A modern, full-stack financial management application built with TypeScript. ASL Finance Hub helps you track expenses, manage budgets, and gain insights into your financial health with an intuitive user interface and powerful analytics.

**Live Demo:** [https://asl-finance-hub.vercel.app](https://asl-finance-hub.vercel.app)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Deployment](#deployment)
- [License](#license)

---

## 🎯 Overview

ASL Finance Hub is a comprehensive financial management platform designed to help individuals and small businesses:

- **Track Expenses** - Monitor your spending across different categories
- **Manage Budgets** - Set and manage budget goals for better financial control
- **Generate Reports** - View detailed financial reports and analytics
- **Financial Insights** - Get actionable insights about your spending patterns
- **Secure Data** - Keep your financial information safe and secure

**Language Composition:**
- TypeScript: 93.4%
- PL/pgSQL: 3.6%
- CSS: 2.1%
- Other: 0.9%

---

## ✨ Features

### 💳 Expense Management
- ✅ Add, edit, and delete expense records
- ✅ Categorize expenses (Food, Transportation, Entertainment, etc.)
- ✅ Attach notes and tags to expenses
- ✅ Filter and search expenses by date, category, and amount
- ✅ Recurring expense support

### 📊 Budget Planning
- ✅ Create monthly/yearly budgets
- ✅ Set spending limits by category
- ✅ Real-time budget tracking
- ✅ Visual budget progress indicators
- ✅ Budget alerts and notifications

### 📈 Analytics & Reports
- ✅ Interactive charts and graphs
- ✅ Spending trends analysis
- ✅ Monthly and yearly comparison reports
- ✅ Category-wise spending breakdown
- ✅ Exportable financial reports (PDF/CSV)

### 💼 Account Management
- ✅ Multi-account support
- ✅ Account balances and summaries
- ✅ Transaction history
- ✅ Account reconciliation

### 🔐 Security & Privacy
- ✅ Secure user authentication
- ✅ Password encryption
- ✅ Data encryption at rest
- ✅ HTTPS support
- ✅ User privacy controls

### 🎨 User Experience
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Dark/Light mode support
- ✅ Intuitive navigation
- ✅ Real-time data updates
- ✅ Fast and smooth performance

---

## 🛠️ Tech Stack

### **Frontend** (TypeScript - 93.4%)
| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type-safe JavaScript development |
| **React** | UI framework |
| **Next.js** | React framework with SSR/SSG |
| **TailwindCSS** | Utility-first CSS styling |
| **Recharts** | Interactive charts and graphs |
| **Axios/Fetch** | HTTP client for API calls |
| **React Query** | Data fetching and caching |
| **Zustand/Redux** | State management |

### **Backend** 
| Technology | Purpose |
|------------|---------|
| **Node.js/Express** | Backend server |
| **TypeScript** | Type-safe backend code |
| **PostgreSQL** | Relational database |
| **Prisma ORM** | Database abstraction layer |
| **JWT** | Authentication tokens |
| **bcryptjs** | Password hashing |

### **Database** (PL/pgSQL - 3.6%)
| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Relational database |
| **PL/pgSQL** | Database stored procedures |
| **Migrations** | Schema version control |

### **Styling** (CSS - 2.1%)
| Technology | Purpose |
|------------|---------|
| **TailwindCSS** | Utility-first CSS |
| **CSS Modules** | Component-scoped styles |
| **Responsive Design** | Mobile-first approach |

### **Deployment & DevOps**
- **Vercel** - Frontend hosting & deployment
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline
- **PostgreSQL Cloud** - Database hosting

---

## 📁 Project Structure

```
asl-finance-hub/
├── frontend/                         # Next.js frontend application
│   ├── app/
│   │   ├── (auth)/                   # Authentication pages
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── forgot-password/
│   │   ├── dashboard/                # Main dashboard
│   │   ├── expenses/                 # Expense management
│   │   ├── budgets/                  # Budget management
│   │   ├── reports/                  # Financial reports
│   │   └── settings/                 # User settings
│   ├── components/
│   │   ├── common/                   # Reusable components
│   │   ├── dashboard/                # Dashboard components
│   │   ├── expense/                  # Expense components
│   │   ├── charts/                   # Chart components
│   │   └── layout/                   # Layout components
│   ├── lib/
│   │   ├── api/                      # API client functions
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── utils/                    # Utility functions
│   │   └── types/                    # TypeScript types
│   ├── public/                       # Static assets
│   ├── styles/                       # Global styles
│   └── package.json
│
├── backend/                          # Express.js backend
│   ├── src/
│   │   ├── controllers/              # Route controllers
│   │   ├── routes/                   # API routes
│   │   ├── middleware/               # Express middleware
│   │   ├── services/                 # Business logic
│   │   ├── models/                   # Prisma models
│   │   ├── utils/                    # Utility functions
│   │   ├── types/                    # TypeScript types
│   │   └── index.ts                  # Entry point
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema
│   │   └── migrations/               # Database migrations
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── docker-compose.yml                # Docker configuration
├── .env.example                      # Environment template
└── README.md                         # This file
```

---

## 📋 Prerequisites

Before getting started, ensure you have:

### Required
- **Node.js** (v16.0.0 or higher)
- **npm** (v8.0.0 or higher) or **yarn**
- **PostgreSQL** (v13.0 or higher)

### Optional
- **Docker** & **Docker Compose** (for containerized development)
- **Git** (for version control)
- **Visual Studio Code** (recommended IDE)

---

## 🚀 Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/SashenM001/asl-finance-hub.git
cd asl-finance-hub
```

### Step 2: Install Dependencies

#### Frontend Setup
```bash
cd frontend
npm install
```

#### Backend Setup
```bash
cd ../backend
npm install
```

### Step 3: Environment Configuration

#### Backend (.env)
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/asl_finance_hub"
DATABASE_POOL_SIZE=20

# Server
PORT=5000
NODE_ENV=development

# Authentication
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRATION=7d

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# Email Service (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=pdf,csv,xlsx
```

#### Frontend (.env.local)
```bash
cd ../frontend
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME=ASL Finance Hub
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 4: Database Setup

#### Option A: Using Docker Compose
```bash
# From project root
docker-compose up -d postgres

# Run migrations
cd backend
npm run db:migrate
npm run db:seed  # Optional: seed sample data
```

#### Option B: Local PostgreSQL
```bash
# Create database
createdb asl_finance_hub

# Run migrations
cd backend
npm run db:migrate

# Seed data (optional)
npm run db:seed
```

---

## ▶️ Running the Application

### Development Mode

**Terminal 1 - Backend Server:**
```bash
cd backend
npm run dev

# Server runs on http://localhost:5000
# API available at http://localhost:5000/api
```

**Terminal 2 - Frontend Development Server:**
```bash
cd frontend
npm run dev

# Application opens at http://localhost:3000
```

### Production Build

**Frontend:**
```bash
cd frontend
npm run build
npm run start
```

**Backend:**
```bash
cd backend
npm run build
npm start
```

---

## 🗄️ Database Schema

### Core Tables

**users**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**accounts**
```sql
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(50), -- checking, savings, credit_card, etc.
  balance DECIMAL(12,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**expenses**
```sql
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  tags TEXT[],
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**budgets**
```sql
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  period VARCHAR(20), -- monthly, yearly
  month INTEGER,
  year INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All API endpoints (except login/signup) require a JWT token in the Authorization header:
```
Authorization: Bearer {JWT_TOKEN}
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecurePassword123",
  "first_name": "John",
  "last_name": "Doe"
}

Response: 201 Created
{
  "id": 1,
  "email": "user@example.com",
  "username": "john_doe",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "john_doe"
  }
}
```

### Expense Endpoints

#### Get All Expenses
```http
GET /expenses?category=food&startDate=2026-01-01&endDate=2026-12-31
Authorization: Bearer {token}

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "amount": 25.50,
      "category": "food",
      "description": "Grocery shopping",
      "expense_date": "2026-05-20",
      "tags": ["groceries", "weekly"]
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

#### Create Expense
```http
POST /expenses
Authorization: Bearer {token}
Content-Type: application/json

{
  "account_id": 1,
  "amount": 25.50,
  "category": "food",
  "description": "Grocery shopping",
  "expense_date": "2026-05-20",
  "tags": ["groceries", "weekly"]
}

Response: 201 Created
```

---

## 🧪 Testing

### Run Tests
```bash
# Frontend tests
cd frontend
npm run test

# Backend tests
cd backend
npm run test

# Test coverage
npm run test:coverage
```

---

## 📦 Build & Deployment

### Frontend Deployment (Vercel)

```bash
# The project is configured for Vercel deployment
# Push to main branch to auto-deploy

# Or manually deploy:
cd frontend
vercel
```

### Backend Deployment

#### Using Docker
```bash
# Build Docker image
docker build -t asl-finance-hub-backend .

# Run container
docker run -p 5000:5000 asl-finance-hub-backend
```

#### Using Traditional Server
```bash
# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name "asl-finance-hub"
```

---

## 🤝 Contributing

We welcome contributions! Follow these steps:

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/asl-finance-hub.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request**

### Code Standards
- Use TypeScript for type safety
- Follow ESLint configuration
- Write descriptive commit messages
- Add tests for new features
- Update documentation as needed

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists
- Run migrations: `npm run db:migrate`

### CORS Errors
- Verify FRONTEND_URL in backend .env
- Check NEXT_PUBLIC_API_URL in frontend .env
- Ensure both match your environment

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/SashenM001/asl-finance-hub/issues)
- **Pull Requests**: [GitHub Pull Requests](https://github.com/SashenM001/asl-finance-hub/pulls)
- **Live Demo**: [https://asl-finance-hub.vercel.app](https://asl-finance-hub.vercel.app)

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🙏 Acknowledgments

- Built with ❤️ for financial freedom
- Thanks to the TypeScript, React, and Node.js communities
- Special thanks to all contributors

---

**Start managing your finances today! 💪**
