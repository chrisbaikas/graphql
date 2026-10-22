---
agent: agent
description: Self-audit the GraphQL Profile project exactly the way a Zone01 auditor would, before submitting for review.
---

# GraphQL Profile — Self Audit

You are acting as the **auditor** for the Zone01 "GraphQL" project. Your job is
to verify, with evidence, that the project would **PASS** a real audit.

Audit using the official criteria in [audit-readme.md](../../docs/audit-readme.md)
and the requirements in [instructions.md](../../docs/instructions.md). Track
status against [ticket-tracker.md](../../docs/ticket-tracker.md).

## How to run this audit

For **every** check below:
1. State **PASS / FAIL / NEEDS MANUAL CHECK**.
2. Give the **evidence**: the file + line, the GraphQL query, the network
   request, or the exact UI behaviour you observed.
3. If FAIL, explain precisely what is missing and which ticket owns the fix.

Inspect the actual code (`index.html`, `css/`, `js/`) — do not assume. Where a
check needs a running app or live credentials, mark it **NEEDS MANUAL CHECK**
and give step-by-step instructions for the human to verify it.

Do **not** modify any files. This is a read-only audit; produce a report only.

---

## A. Functional checks (mandatory — any FAIL blocks the audit)

### A1 — Invalid login shows an error
- [ ] Logging in with **invalid** credentials shows an appropriate, visible
      error message (no crash, no silent failure, no blank screen).
- Evidence to find: error rendered into `#error`; the `signin` request returns
  non-2xx and the catch path runs.

### A2 — Valid login works (username AND email)
- [ ] Valid **username**:password logs in and reveals the dashboard.
- [ ] Valid **email**:password logs in and reveals the dashboard.
- [ ] A JWT is obtained from `/api/auth/signin` via **Basic** auth (base64) and
      stored.
- Evidence to find: real platform domain (NOT a `DOMAIN` placeholder),
  `Authorization: Basic <base64>` header, JWT persisted to storage.

### A3 — Three required sections exist
- [ ] The profile shows **three** distinct information sections (e.g. user id,
      XP, grades/audits).
- [ ] Each section's content is **accurate** vs the same query run in GraphiQL.
- Evidence to find: three rendered sections + a GraphiQL value comparison.

### A4 — Fourth section: statistics with SVG graphs
- [ ] A **fourth** section is dedicated to graphical statistics.
- [ ] It contains **at least two different** graphs.
- [ ] Graphs are built with **SVG** (not `<canvas>`, not images, not a chart
      library).
- [ ] The two graphs are **different types** (e.g. line + pie/bar).

### A5 — Graphs are accurate
- [ ] Each graph's values match the underlying data (cross-check in GraphiQL).
- Evidence to find: e.g. cumulative XP graph end == total XP section; pie/bar
  counts == pass/fail counts.

### A6 — Hosted and accessible
- [ ] The profile is reachable at a **public host URL**.
- [ ] Login, all sections, graphs and logout work on the **hosted** version.
- Evidence to find: live URL recorded in `README.md`.

### A7 — Logout works
- [ ] Logout logs the user out (token cleared) and returns to the login view.
- [ ] After logout, no stale protected data remains on screen.

---

## B. General check (mandatory)

### B1 — All three query types are used
- [ ] **Normal** query (e.g. `{ user { id login } }`).
- [ ] **Query with arguments** (e.g. `object(where: { id: { _eq: ... } })`).
- [ ] **Nested** query (e.g. `result { user { login } }`).
- Evidence to find: each query form actually executed in the app (visible in
  the DevTools network tab or in the source).

---

## C. Bonus checks (do not block; note if present)

- [ ] **C1** — Extra information beyond the three mandatory sections.
- [ ] **C2** — Additional graph(s) beyond the required two.
- [ ] **C3** — The student created and uses their own GraphiQL panel.
- [ ] **C4** — UI respects good practices (responsive, loading/empty/error
      states, readable, accessible labels).

---

## D. Output format

Produce a report in this shape:

```
# Audit Report — GraphQL Profile (<date>)

## Verdict: PASS ✅ / FAIL ❌

## Mandatory results
A1 Invalid login error ......... PASS/FAIL  — <evidence>
A2 Valid login (user + email) .. PASS/FAIL  — <evidence>
A3 Three sections accurate ..... PASS/FAIL  — <evidence>
A4 Stats section + 2 SVG ....... PASS/FAIL  — <evidence>
A5 Graphs accurate ............. PASS/FAIL  — <evidence>
A6 Hosted/accessible ........... PASS/FAIL  — <evidence>
A7 Logout ...................... PASS/FAIL  — <evidence>
B1 Three query types ........... PASS/FAIL  — <evidence>

## Bonus
C1 / C2 / C3 / C4 .............. yes/no     — <evidence>

## Blocking issues (must fix to pass)
- <issue> → owned by Ticket <n>

## Manual verification steps (need running app / live creds)
- <step-by-step>
```

A **PASS verdict requires every mandatory check (A1–A7, B1) to PASS.**
Any FAIL among them => overall FAIL. List blocking issues with the owning ticket
number from the tracker so they can be fixed next.
