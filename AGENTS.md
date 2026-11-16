# AGENTS.md

**Project:** Call Booking (Agent-Driven Development)

This document details the involvement of the AI agent (OpenCode) in the development of the Call Booking project. It serves as proof that the codebase adheres to the core criterion: "ideally, all project code is written with the help of an agent."

**Stack:** Node.js 24 / Express (backend) · TypeScript + React + Vite + shadcn/ui + Tailwind (frontend) · better-sqlite3 (persistence) · Prism (contract mock for frontend dev)

---

## 1. Agent's Role and Methodology

The development followed a **Design First** approach: the AI agent fixed the API contract before any implementation, then built the frontend and backend independently against that contract.

**Methodology:**

*   **Contract-First Design:** The agent generated the API contract in TypeSpec (`spec/main.tsp`) — endpoints, payloads, status codes, error envelopes — before writing any controller or component. The OpenAPI file (`api-contract.yaml`) is emitted with `tsp compile`, so it can never drift from the source of truth.
*   **Iterative Refinement:** Code was produced in small, testable chunks and immediately validated. Example: the agent's first slot generator produced 9 slots instead of 18 (it emitted one 30-min slot per hour), which the tests caught; the generator now emits two slots per hour.
*   **Infrastructure-as-Code:** The agent created a multi-stage Dockerfile and runtime configuration (dynamic `PORT`) so the app runs identically on a host and in a container.
*   **GitHub Agent Integration:** This project uses the OpenCode GitHub App to integrate the agent into the team workflow — issue triage, PR creation, code review, and scheduled automated checks.

---

## 2. GitHub Agent Integration

### How to Interact with the Agent

The OpenCode agent is installed as a GitHub App on this repository. You can interact with it by commenting on issues or pull requests:

**Issue Commands:**
*   `/opencode explain this issue` — Agent reads the issue and provides analysis.
*   `/opencode fix this` — Agent creates a branch, implements the fix, and opens a PR.
*   `/oc fix this` — Same as above (short alias).

**PR Review Commands:**
*   `/opencode add error handling here` — Agent implements the requested change on the PR.
*   `/oc add tests for this` — Agent adds tests and commits to the PR.

### Agent Workflows

| Workflow | Trigger | What It Does |
| :--- | :--- | :--- |
| `opencode.yml` | `/oc` or `/opencode` in comment | Executes agent tasks on issues/PRs |
| `opencode-review.yml` | PR opened/synced | Auto-reviews PRs for quality |
| `opencode-triage.yml` | New issue opened | Auto-triages new issues |
| `opencode-nightly.yml` | Cron (3 AM UTC daily) | Runs tests + Lighthouse audit |

### Demonstrating the Agent Lifecycle

1.  **Issue Created** → Auto-triage workflow labels and responds.
2.  **Agent Triggered** → `/opencode fix this` creates branch + PR.
3.  **Auto-Review** → PR review workflow provides feedback.
4.  **Refinement** → `/oc add tests` iterates on the PR.
5.  **Merge** → `release-please` creates release PR.
6.  **Nightly Check** → Scheduled workflow verifies everything still works.

---

## 3. Implementation Breakdown by Requirement

### What Must Work: User Scenarios

| Scenario | Agent's Contribution | Verification Evidence |
| :--- | :--- | :--- |
| **Slot Booking Flow** | Generated the full flow: choosing an event type (`TypesPage`) → fetching its 14-day slot window (`GET /api/slots?eventTypeId=`) → UI selection (Cal.com-style `BookingPage` with a week grid and day/time rows) → API request (`POST /api/bookings`) → handling success → updating UI state. Includes persistence to SQLite. | Automated integration tests (`server/test/api.test.js`) confirm a booking is saved and appears in `GET /api/bookings`. |
| **Slot Availability (Conflict)** | Implemented the concurrency-safe check to prevent double-booking: a `UNIQUE(start_time)` constraint plus a database transaction. A double-booking attempt maps to HTTP 409 with the exact JSON error `{"error": "This time slot is already reserved."}`. | Tests book the same slot twice and assert the second response is 409 with the contract error message. |

### Design Requirements

| Requirement | Agent's Contribution | Verification Evidence |
| :--- | :--- | :--- |
| **Design First (API Contract)** | Authored the contract in TypeSpec (`spec/main.tsp`) defining `GET /api/owner`, `GET /api/event-types`, `POST /api/event-types`, `GET /api/slots`, `POST /api/bookings`, `GET /api/bookings`, all request/response schemas and error structures. | `spec/main.tsp` compiles to `api-contract.yaml` in the repo root. |
| **Dockerfile** | Generated a three-stage Dockerfile: client build → server deps → minimal runtime with only the compiled client and server code. | `Dockerfile` exists in the root directory; GitHub Actions (`hexlet-check`) builds the image and starts the container. |
| **Container Execution** | The runtime stage contains no host dependencies: Node + node_modules + server source + built client. | `hexlet-check` workflow builds and launches the container in CI. |
| **Port Configuration** | The server reads `PORT` from `process.env` and binds to `0.0.0.0` (`server/src/index.js`). No hardcoded ports. | `index.js` uses `Number(process.env.PORT)`. |

---

## 4. API Contract Summary

All endpoints are mounted under `/api` and return JSON. The contract is authored in TypeSpec (`spec/main.tsp`, the single source of truth) and compiled to `api-contract.yaml`.

| Method & Path | Purpose | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/owner` | Default calendar owner profile (admin part) | `200` `Owner` | — |
| `GET /api/event-types` | Published event types (id, name, description, duration) | `200` `EventType[]` | — |
| `POST /api/event-types` | Owner creates an event type | `201` `EventType` | `400` invalid, `401` missing owner token |
| `DELETE /api/event-types/:id` | Owner deletes a type; requires `?force=true` to cancel its bookings | `204` | `401` missing token, `404` unknown, `409` bookings exist |
| `GET /api/slots?eventTypeId=&date=` | 30-minute-grid slots for a type, 14-day booking window, booked ones flagged | `200` `SlotsResponse` | `400` bad/out-of-window params, `404` unknown type |
| `POST /api/bookings` | Book `{eventTypeId, slotId, name, email?}` | `201` `Booking` | `400` invalid, `404` unknown type/slot, `409` overlap (across event types) |
| `GET /api/bookings` | Current and upcoming meetings across all types, oldest first | `200` `Booking[]` | `401` missing owner token |
| `DELETE /api/bookings/:id` | Owner cancels a booking | `204` | `401` missing token, `404` unknown |

Occupancy is global: two bookings may never overlap in time, even when they are for different event types. See `api-contract.yaml` for the full specification.

---

## 5. Commit Strategy & Traceability

*   **Commit Messages:** Every commit follows the Conventional Commits format (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `ci:`). Agent commits keep the provenance marker in the subject, e.g., `feat: [AI-Generated] add slot booking`. This drives `release-please`, which derives the changelog and the next semver version from the commit types.
*   **Code Comments:** Complex algorithms carry comments attributing their generation to the agent (e.g., `// Logic generated by AI Agent: ...` in `slots.js`, `bookings.js`, `db.js`).
*   **Artifacts:** This `AGENTS.md`, the `api-contract.yaml`, and the integration tests prove the Design First approach.

---

## 6. Automated Checks (GitHub Actions)

| Check Item | Status | Notes |
| :--- | :--- | :--- |
| Build & Launch | Configured | `hexlet-check` builds the image and starts the container in CI. |
| Port Variable | Verified | Server reads `process.env.PORT` and binds to `0.0.0.0`. |
| Functional Tests | Pass (local) | `server/test/api.test.js` — 17 tests covering owner/event-type listing, event-type creation, the 14-day slot window, slot-date filtering/out-of-window rejection, booking creation, 409 duplicate + cross-type overlap, 400 validation, 404 unknown type/slot, booking cancellation, forced event-type deletion, opt-in owner auth, and current/upcoming-meeting listing. |
| E2E Scenarios (Playwright) | Pass (local) | `e2e/tests/booking.spec.ts` — 8 scenarios in a real browser: the full booking path, a taken slot shown as unavailable, a double-booking 409, an empty availability state, owner booking cancellation, deleting an event type with its bookings, guest-local timezone grouping, and owner event-type creation. Runs in CI via `ci.yml`. |
| Contract Sync | Configured | `ci.yml` regenerates `api-contract.yaml` from TypeSpec and fails if the committed file differs. |
| Release Automation | Configured | `release-please.yml` opens/updates a release PR with `CHANGELOG.md` and a semver bump on every merge to main. |
| Nightly Checks | Configured | `opencode-nightly.yml` runs API tests, typecheck, build, and Lighthouse audit daily at 3 AM UTC. |

---

## 7. Verification Protocol (QA Checklist)

**Important:** Verification proceeds strictly top-down. If critical issues are found at a higher level, stop the check until they are resolved. Fixing lower-level issues while the upper architecture is unstable is inefficient.

### Level 1: Runtime Contract
*   **[ ] Dockerfile in repository:** Confirmed.
*   **[ ] Application builds and launches in Docker:** Verified via `hexlet-check`.
*   **[ ] Port configuration:** App reads `PORT` env var and binds to `0.0.0.0`; no hardcoded ports.

### Level 2: Workflow & Access Control
*   **[ ] OpenCode GitHub App installed:** Verified in repository settings.
*   **[ ] Workflows present:** `opencode.yml` (comments), `opencode-nightly.yml` (schedule) exist in `.github/workflows/`.
*   **[ ] Permissions configured:** Each workflow has minimal necessary rights (no excessive write permissions).
*   **[ ] Secrets configured:** API provider secrets are correctly set in repository secrets.

### Level 3: GitHub Integration Scenarios
*   **[ ] Issue Command Trigger:** Invoking `/opencode fix this` in an issue comment successfully creates a branch and PR.
*   **[ ] Auto-Triage:** New issues automatically trigger `opencode-triage.yml`, receiving labels and a brief analysis response.
*   **[ ] PR Creation/Update:** Agent can create or update a PR with code changes based on the command.
*   **[ ] Inline & General Review:** Adding a comment to a specific line or a general PR comment triggers the agent to make refinements/commits to the existing PR.
*   **[ ] Nightly Scheduled Run:** `opencode-nightly.yml` executes daily at 3 AM UTC and publishes results (tests, Lighthouse score).

### Level 4: Security & Cost Practices
*   **[ ] Event Filtering:** Workflows include filters to ignore events from bots (including the agent itself) to prevent loops.
*   **[ ] Loop Protection:** Logic exists to ensure the agent does not react to its own comments or previous iterations unnecessarily.
*   **[ ] Cost Control:** Scheduled frequency is reasonable; model selection is optimized for task complexity (cheaper models used where possible).

---

## 8. Development Plan (Agent-Assisted)

### Features

| Issue | Description | Status |
| :--- | :--- | :--- |
| F1 | Booking cancellation — Add `DELETE /api/bookings/:id` endpoint + cancel button in UI | Done |
| F2 | Timezone display — Show slots in user's local timezone (currently UTC only) | Partial — times and day grouping are local; business hours are still generated in UTC |
| F3 | Booking confirmation details — After booking, show confirmation card with meeting details | Planned |
| F4 | Custom availability hours — Allow owner to set custom business hours per event type | Planned |

### Bugs

| Issue | Description | Status |
| :--- | :--- | :--- |
| B1 | Slots not filtered by date correctly — Frontend doesn't use `?date=` param | Fixed — client fetches the full window and groups by local day |
| B2 | Owner view doesn't show bookings — `/owner` page missing upcoming bookings list | Fixed — `OwnerView` lists current/upcoming bookings |
| B3 | Form allows empty name — Booking form doesn't validate non-empty name | Fixed — required input + server-side trim/validation |

---

## 9. Future Development Roadmap

After successful verification of the current automation layer, the next steps are:

*   **Ad-hoc Execution:** Add `workflow_dispatch` trigger to allow manual triggering of specific agent tasks on demand.
*   **Modular Workflows:** Split monolithic workflows into distinct scenarios (e.g., separate files for `triage`, `review`, `schedule`) to improve maintainability.
*   **External Data Integration:** Connect external data sources (e.g., error collector like Bugsink, Search Console) for regular analysis and reporting via scheduled workflows.
*   **Standardized Prompts (Skills):** Extract recurring prompts into a "skills" library to standardize agent behavior across the team and reduce hallucinations or inconsistent coding styles.
*   **Advanced Features:** Registration/Accounts (auth, multi-tenant isolation), Calendar Integrations (Google, Outlook), Notifications (email, Telegram), and Advanced Scenarios (rescheduling, recurring events, analytics).
