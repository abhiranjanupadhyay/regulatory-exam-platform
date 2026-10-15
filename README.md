# Regulatory Exam Platform

Invite-only study and mock-test platform for regulatory examinations (e.g. SAS Part I / II).
Spring Boot 3.3 / Java 17 microservices on Neo4j.

| Module | Port | Responsibility |
|---|---|---|
| `api-gateway` | 8080 | Single entry point: JWT check, single-device session check, admin guard, routing |
| `user-service` | 8081 | Google sign-in, invite codes, registration profile, session ownership |
| `subscription-service` | 8082 | Plans, UPI payment info, UTR submission, approve / reject / freeze / extend |
| `content-service` | 8083 | Exams, papers, topics (tiers), books, MCQs, dictionary, ingestion, backup |
| `assessment-service` | 8084 | Practice answers, mock tests and scoring, tier unlock rules, dashboard, discrepancy tickets |
| `common` | - | JWT helper, trusted-header user context, error handling |

## Run

```bash
docker compose up -d neo4j        # bolt://localhost:7687, neo4j/password
mvn clean package
# one terminal per service, e.g.
GOOGLE_DEV_MODE=true ADMIN_EMAILS=you@example.com java -jar user-service/target/user-service-1.0.0-SNAPSHOT.jar
java -jar subscription-service/target/subscription-service-1.0.0-SNAPSHOT.jar
java -jar content-service/target/content-service-1.0.0-SNAPSHOT.jar
java -jar assessment-service/target/assessment-service-1.0.0-SNAPSHOT.jar
java -jar api-gateway/target/api-gateway-1.0.0-SNAPSHOT.jar
```

Clients talk only to the gateway (`:8080`). `/api/internal/**` is blocked there.

Configuration (env vars): `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `JWT_SECRET` (same value for
gateway and user-service, 32+ chars), `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` (comma separated),
`GOOGLE_DEV_MODE`, `PUBLIC_URL`, and the `*_SERVICE_URL` variables for service-to-service calls.

`GOOGLE_DEV_MODE=true` accepts the id token `dev:someone@example.com|Some Name` so the flows can be tried
without Google. Never enable it outside local development.

## How the PRD maps to the services

- **Invite gate, Google auth, safeguards**: `POST /api/auth/invite/validate`, `/register`, `/login`. Login of an
  unknown user returns `Account does not exist. Kindly register first.`; register of a known user returns
  `User already registered. Kindly login.`
- **Single device**: every login mints a new session id stored on the user; the gateway rejects tokens whose
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

- Frontend. The watermark, copy protection and screen shielding are client behaviour and need the UI.
- Excel (`.xlsx`) MCQ upload: CSV files and pasted spreadsheet rows work; `.xlsx` is rejected with a clear message.
- Automated tests, and a runtime check against a live Neo4j (the code compiles; it has not been booted).
- All services share one Neo4j database (Community edition allows one) and keep to their own node labels.
