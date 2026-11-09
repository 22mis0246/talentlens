# TalentLens technical design

**GitHub project URL:** Not published from this workspace; no GitHub remote or publishing credentials were available at build time.

**Live app:** Not deployed.

## Product and scope

TalentLens is a compact recruiting workspace for Company A. Recruiters edit a requisition scorecard, upload a batch of CVs, review ranked profiles with evidence, submit candidates, and follow progress. A client hiring manager sees masked profiles, opens evidence, and can shortlist, reject with a reason, or propose an interview time. The delivery head can inspect a candidate activity log. The prototype focuses on the core slice; it does not connect to job boards, email, telephony, payments, or production identity providers.

## Architecture

The UI is a React single-page app built with Vite. It uses a custom responsive component system, Lucide icons, and a small same-origin `/api` client. The API is Node.js with Express. PostgreSQL stores users' work data: the demo schema includes candidates, jobs, submissions, and audit events. Multer bounds uploads by file count and size; `pdf-parse` reads selectable PDF text and Mammoth extracts DOCX text. An uploaded file is parsed into a profile and is not retained as a file blob.

The Vite dev server proxies API calls to Express. In deployment, serve the built frontend from a static host and run the API separately with PostgreSQL. The sample code uses Express's in-memory session store for local use; a production deployment must configure a durable session store and migrations.

### Assumptions

- **Assumption:** The included sample candidates have consented to hiring use. New uploads require the recruiter to confirm consent before parsing.
- **Assumption:** The first client identity is Northstar Bank. The prototype's client role is scoped to that client; a real system must derive tenant scope from authenticated client membership rather than a demo role selector.
- **Assumption:** The provided sample candidate skills, experience, and notice are accurate enough to seed a demonstration. They are not real candidate records.
- **Assumption:** CVs are selectable-text PDFs or DOCX files. Scanned-image OCR, encrypted PDFs, malformed documents, and language detection are not implemented.
- **Assumption:** Interview proposals are suggestions for the recruiter to coordinate; no calendar invite or external message is sent.
- **Assumption:** The weighted score is a transparent first-pass baseline, not a trained or generative model. Weights are visible and fixed at 65% skills, 25% experience, and 10% notice.

## Data model

| Entity | Purpose | Important fields |
|---|---|---|
| `jobs` | Requisition and editable scorecard | client, title, location, experience range, required skills, maximum notice, CTC range |
| `candidates` | Parsed profile and consent state | ID, role, experience, skills, notice, summary, parsed CV text, consent, stage, content hash |
| `submissions` | Candidate shared against a requisition | job, candidate, client status, rejection reason, proposed interview slot |
| `audit` | Candidate activity history | actor, action, candidate ID, timestamp |

The candidate content hash is unique to detect repeated file uploads. Submissions cascade-delete with a candidate. A deletion request removes the profile and submissions, then records a deletion event without retaining the profile contents.

## Main flows

1. **Role entry:** The demo entry screen establishes either recruiter or client role in a session. API middleware checks role on recruiter-only and client-only endpoints.
2. **Scorecard:** The recruiter reviews the seeded JD fields and can edit role, skills, experience range, maximum notice, and CTC range. CTC is blank because the example JD has no CTC value. API validation rejects empty or out-of-range fields.
3. **Bulk upload:** The recruiter confirms consent and selects or drops up to 500 PDF/DOCX files. Files are parsed in memory, duplicate hashes are skipped, and labelled fields are extracted. Unsupported or unreadable files are counted as skipped. Parsed profiles appear in ranking.
4. **Ranking and review:** Candidate rows sort by score and show a clear evidence panel. Opening a profile records a view event. The submit action only appears after the recruiter opens the parsed CV text. Low-ranked candidates remain searchable.
5. **Client review:** The client sees only submitted profiles for Northstar Bank, with candidate contact/name masked. It can shortlist, reject with a required reason, or propose a date and time. The API rejects feedback for a candidate outside the client's scoped submissions.
6. **Pipeline and audit:** The recruiter sees candidates grouped into a six-stage pipeline and can review the access/decision log or delete a candidate profile on request.

## AI and decision safeguards

The matching logic is a deterministic scoring baseline. It compares required skill tokens against profile skill tokens (65 points), gives up to 25 points for experience within the JD range, and up to 10 points for notice within the JD limit. Every score returns evidence entries for skills, experience, and notice. The UI shows the quoted source text and criterion detail alongside the score. This is auditable and predictable, but it can miss synonyms and context; reviewers should treat it as a prioritization aid.

The score function never uses name, gender, age, photo, or marital status. Candidate names are also omitted from client-facing cards. No candidate is rejected based on score, and every profile remains searchable. A recruiter must open the evidence panel before submission. A weekly rank-versus-recruiter-choice report is not automated in this prototype; the activity log and stored scores provide the basis for a future review report.

## UI and design decisions

The product uses a restrained white, charcoal, and muted green palette, compact type, generous spacing, and a fixed recruiter sidebar on desktop. The overview prioritizes workload and requisitions; the ranked list makes the score, notice, evidence, and next action scannable. Evidence expands inline to avoid losing list context. The client portal uses masked candidate labels, clear action buttons, and a single-column card layout on phones. Loading feedback, empty states, error toasts, and mobile navigation are included. The design avoids decorative data visualizations that do not support a hiring decision.

## Security, privacy, and limits

API routes validate role and key inputs; uploads are bounded to 8 MB per file and 500 files per request and restricted to PDF/DOCX. Session cookies are HTTP-only and use same-site protection; secure cookies activate in production. Candidate view, submit, client decision, and deletion events are logged. The demo does not claim DPDP Act compliance: it lacks a complete consent ledger, retention schedule, encryption-at-rest controls, production SSO, durable session storage, rate limiting, and formal deletion verification. These are prerequisites before production use.

## Testing

Node's built-in test runner covers the exact-match score, missing-skill/low-score behavior, and the skill weighting ceiling. The deployment guide includes commands for API tests and the frontend production build. Manual review should also exercise role boundaries, scorecard validation, upload count/file type/duplicate handling, client feedback validation, and phone-width layouts.

## Cut and next steps

This submission cuts live JD email intake, job-board sourcing, OCR for scanned CVs, trained semantic ranking, interview calendar integration, recruiter/client messaging, production user administration, and automated weekly fairness comparisons. Next, I would add OCR with confidence markers, a consent ledger and retention/deletion workflow, persistent sessions and migrations, tenant memberships, a human-reviewed synonym layer, decision-quality measurement, and accessibility review with real recruiter and client feedback.
