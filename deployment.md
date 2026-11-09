# TalentLens deployment guide

## Local setup

Prerequisites: Node.js 20.19+ or 22.12+, npm, and PostgreSQL 14 or newer.

1. Create a database: `createdb talentlens` (or create a database named `talentlens` in your PostgreSQL client).
2. In `server/`, copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `SESSION_SECRET`. Keep `.env` out of Git.
3. Install API packages: `cd server` then `npm install`.
4. Start the API: `npm run dev`. On first start it creates the schema and adds anonymized demo candidates and requisitions. API runs on port 8000.
5. In a second terminal at the project root, install web packages with `npm install`.
6. Start the web app with `npm run dev` and open `http://localhost:5173`.

PostgreSQL must be available before the API starts. The Vite development server forwards `/api` requests to `http://localhost:8000`.

## Demo access

There are no passwords in this prototype. At the entry screen choose **Recruiter workspace** or **Client portal**. The role selector creates a demo session so a reviewer can try both access paths. The recruiter sample requisitions are Senior Java Developer and KYC Analyst. The client portal is seeded with a Northstar Bank submission.

## Production deployment

Deploy the React build as static assets and run the Express API as a Node service. Provision PostgreSQL separately, run the API once to apply the idempotent schema/seed setup, and set the web origin to the deployed frontend origin. Use HTTPS, a persistent PostgreSQL-backed session store, a managed secret, and a migration runner before real candidate data is used. Those production hardening steps are not configured in this demo.

Build the frontend with `npm run build`; serve `dist/` through a static host. Start the API with `npm start` from `server/`.

## Environment variable names

Set these in `server/.env`; values are environment-specific and are intentionally omitted here:

- `DATABASE_URL`
- `PGSSL`
- `SESSION_SECRET`
- `FRONTEND_ORIGIN`
- `PORT`
- `NODE_ENV`

## Tests

From the project root, run `npm run test:api` after installing API dependencies. The API tests cover score weighting and low-score behavior. `npm run build` checks the frontend production bundle.
