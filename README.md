# TalentLens

An evidence-led recruiting workspace prototype for Company A. The app combines a React/Vite frontend, an Express API, and PostgreSQL. It includes seeded demo data for a Senior Java Developer and a KYC Analyst requisition.

## Features

- Recruiter and client demo workspaces with role-checked API routes
- Editable requisition scorecard, including skills, experience, notice, and CTC
- Bulk PDF/DOCX text parsing (up to 500 files), consent confirmation, and content-hash duplicate detection
- Explainable candidate ranking with criterion evidence; recruiter opens parsed CV text before submission
- Client review with masked candidate names, shortlist/reject feedback, and interview slot proposals
- Recruiting pipeline, candidate access/decision log, and deletion request action

The score is a transparent weighted baseline: 65% skills, 25% experience, 10% notice. It is not a trained model and must not be used as an automatic rejection rule. Scanned CV OCR, live JD intake, production authentication, and a production DPDP consent/retention system are not included.

## Run locally

See [deployment.md](deployment.md) for database setup, environment variables, demo access, and run commands. See the [Technical Design Document](output/pdf/TalentLens_TDD.pdf) for architecture, data model, flows, safeguards, assumptions, and limits.
