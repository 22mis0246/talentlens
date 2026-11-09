# TalentLens – Deployment Guide

## 1. Project Overview

TalentLens is an evidence-based recruitment screening platform built for Company A.

**Technology Stack**
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express.js
- Database: PostgreSQL
- Document Parsing: PDF-Parse, Mammoth
- Deployment: Render

**Live Application:** https://talentlens-frontend-izmx.onrender.com

**Backend API:** https://talentlens-nuok.onrender.com

**GitHub Repository:** [Insert your public GitHub repository URL]

---

## 2. Prerequisites

Install the following before running the project locally:

- Node.js 20.19+ or 22.12+
- npm
- PostgreSQL 14 or newer
- Git

## 3. Local Setup

### Step 1: Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd talentlens
```

### Step 2: Configure the Database

Create a PostgreSQL database named `talentlens`.

```bash
createdb talentlens
```

Alternatively, create the database using pgAdmin or another PostgreSQL client.

### Step 3: Configure Backend Environment

Navigate to the server directory:

```bash
cd server
```

Copy `.env.example` to `.env` and configure the required environment variables.

```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_random_secret
PORT=8000
FRONTEND_ORIGIN=http://localhost:5173
PGSSL=false
NODE_ENV=development
```

Do not commit `.env` or expose database credentials.

### Step 4: Install Backend Dependencies

```bash
npm install
```

### Step 5: Start the Backend

```bash
npm run dev
```

The Express API runs at:

`http://localhost:8000`

On initial startup, the application initializes the database schema and seeds demonstration requisitions and candidates.

### Step 6: Install Frontend Dependencies

Open a second terminal at the project root.

```bash
npm install
```

### Step 7: Start the Frontend

```bash
npm run dev
```

Open the application:

`http://localhost:5173`

The Vite development server proxies `/api` requests to the backend running on port 8000.

---

## 4. Demo Access

The prototype provides two demo workspaces:

**Recruiter Workspace**
- Access the Senior Java Developer and KYC Analyst requisitions.
- Edit job scorecards.
- Upload and parse candidate CVs.
- Review ranked candidates and supporting evidence.
- Submit candidates and track recruitment progress.

**Client Portal**
- Review submitted candidates.
- View masked candidate information.
- Shortlist or reject candidates with a reason.
- Propose interview slots.

**Demo Authentication:** Select either Recruiter Workspace or Client Portal from the entry screen. The prototype uses demo role selection and does not require a password.

**Sample Client:** Northstar Bank.

---

## 5. Production Deployment

The application is deployed using Render.

### Frontend
- Deployed as a Render Static Site.
- Production build command: `npm install && npm run build`
- Publish directory: `dist`
- Frontend communicates with the separately deployed Express API.

### Backend
- Deployed as a Render Web Service.
- Runtime: Node.js
- Start command: `npm start`
- Listens on the configured port.

### Database
- PostgreSQL hosted on Render.
- Backend connects using the configured `DATABASE_URL`.
- Database schema and sample data are initialized by the backend.

### Deployment URLs

- Frontend: https://talentlens-frontend-izmx.onrender.com
- Backend: https://talentlens-nuok.onrender.com

---

## 6. Environment Variables

Configure the following variables in the Render backend environment settings.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret |
| `FRONTEND_ORIGIN` | Allowed frontend origin |
| `PGSSL` | PostgreSQL SSL configuration |
| `PORT` | Backend listening port |
| `NODE_ENV` | Runtime environment |

Actual environment variable values and credentials are intentionally excluded from this document.

---

## 7. Testing

Run API tests from the project root:

```bash
npm run test:api
```

Build the frontend for production:

```bash
npm run build
```

The API tests cover:
- Candidate scoring and weighted criteria.
- Skill matching behavior.
- Low-score handling.
- Prevention of automatic rejection based on scores.

---

## 8. Security and Production Limitations

The prototype includes role-based API checks, input validation, restricted CV upload types, session cookies, and candidate activity logging.

The following improvements are required before production use:

- Persistent session storage.
- Production-grade authentication and user management.
- Complete DPDP consent and retention workflows.
- Encryption at rest and verified deletion.
- OCR support for scanned CVs.
- Rate limiting and additional security monitoring.

The current application is a demonstration prototype and should not be used to process real candidate data without these additional safeguards.