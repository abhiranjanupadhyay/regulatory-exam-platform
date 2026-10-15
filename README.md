# Regulatory Exam Platform

Invite-only study and mock-test platform for regulatory examinations (e.g. SAS Part I / II).
Spring Boot 3.3 / Java 17 application on Postgres.

| Module | Responsibility |
|---|---|
| `app` | The single Spring Boot application (default port 8080, or `PORT`). Packages: `user` (Google sign-in, invite codes, registration profile, session ownership), `subscription` (plans, UPI payment info, UTR submission, approve / reject / freeze / extend), `content` (exams, papers, topics (tiers), books, MCQs, dictionary, ingestion, backup), `assessment` (practice answers, mock tests and scoring, tier unlock rules, dashboard, discrepancy tickets) |
| `common` | JWT helper, trusted-header user context, error handling |

`AuthFilter` is the single entry point for authentication: it checks the JWT, the single-device session, and the
admin guard, and `/api/internal/**` is blocked.

## Run

```bash
docker compose up -d postgres     # localhost:5432, db regexam, postgres/password
mvn clean package
GOOGLE_DEV_MODE=true ADMIN_EMAILS=you@example.com java -jar app/target/app-1.0.0-SNAPSHOT.jar
```

Configuration (env vars): `DB_URL` (JDBC, e.g. `jdbc:postgresql://host/db?sslmode=require` for Neon), `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (32+ chars), `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` (comma separated),
`GOOGLE_DEV_MODE`, `PUBLIC_URL`, `PORT`.

`GOOGLE_DEV_MODE=true` accepts the id token `dev:someone@example.com|Some Name` so the flows can be tried
without Google. Never enable it outside local development.

## Frontend (`frontend/`)

React + Vite single-page app with two shells, each with a left navigation sidebar.

- **Student portal**: Dashboard, Syllabus, Study Table, Mock Arena, Profile, Plans & Renewal. The top bar has the
  exam-stage switcher, the validity badge (turns amber at 5 days or fewer, click to renew) and the profile menu.
  Study and test screens carry the forensic watermark and screen shielding.
- **Admin console**: Overview (pending payments, open tickets, content readiness, expiring plans), Candidates &
  Support, Invite Codes, Content Matrix (with ingestion), MCQ Editor, Snapshot Vault, Exams & Plans, Tier Control.
  The sidebar shows a live count of payments and tickets awaiting action.

```bash
cd frontend
cp .env.example .env      # set VITE_GOOGLE_CLIENT_ID, or keep VITE_DEV_LOGIN=true for local development
npm install
npm run dev               # http://localhost:3000, proxies /api to the app (set `VITE_GATEWAY_URL`, default :8080)
```

First run: start the services with `GOOGLE_DEV_MODE=true ADMIN_EMAILS=you@example.com`, sign in as that email
(it becomes the admin), then create an exam, papers, topics, a payment config and a plan under the admin console.
Generate an invite code to register a student.

### Demo data

With the services running (`GOOGLE_DEV_MODE=true`, `ADMIN_EMAILS=you@example.com`):

```bash
ADMIN_EMAIL=you@example.com node scripts/seed.mjs
```

Creates a sample exam with two papers, four topics across all three tiers (sample books and 5 questions each),
a small dictionary, two plans, payment settings, the tier policy and three invite codes. The content is
placeholder text, not real regulations. Re-running is safe: it stops if the sample exam already exists.

## How the PRD maps to the services

- **Invite gate, Google auth, safeguards**: `POST /api/auth/invite/validate`, `/register`, `/login`. Login of an
  unknown user returns `Account does not exist. Kindly register first.`; register of a known user returns
  `User already registered. Kindly login.`
- **Single device**: every login mints a new session id stored on the user; `AuthFilter` rejects tokens whose
  session id is stale with `401 SESSION_DISPLACED`. Clients poll `GET /api/users/me` as the heartbeat.
- **Paywall and payments**: `GET /api/subscriptions/me` (`hasActivePlan`, `daysRemaining`, `expiringSoon` at
  5 days or fewer), `GET /api/payment-config?planId=` (UPI deep link for the QR), `POST /api/subscriptions`
  (12-digit UTR, returns the WhatsApp link).
- **Study table**: `GET /api/exams/{id}/syllabus`, `/api/topics/{id}/book`, `/api/topics/{id}/mcqs` (no answers),
  `POST /api/practice/answer` (feedback + citation), `GET /api/dictionary/{word}`, `POST /api/tickets`.
- **Mock arena**: `POST /api/tests` (`FULL`, `TOPIC`, `QUALIFYING`), `PUT /api/tests/{id}/responses`,
  `POST /api/tests/{id}/submit`, `GET /api/tests/{id}/result`. Answers never leave the server until submission.
  Marking is +1 / -0.25.
- **Tiers**: `GET /api/tiers/me`. Tier 2/3 open via qualifying exam (coverage % + score % + cooldown from the
  policy), a scheduled date, the universal override, or a manual admin unlock.
- **Admin**: everything under `/api/admin/**`.

## Not built yet

- The seed script has only been syntax-checked, not run against live services.
- Visual and end-to-end checks of the UI against running services (the frontend builds, but has not been browsed).
- Excel (`.xlsx`) MCQ upload: CSV files and pasted spreadsheet rows work; `.xlsx` is rejected with a clear message.
- Automated tests, and a runtime check against a live Postgres.
- All services share one Postgres database and keep to their own tables.
