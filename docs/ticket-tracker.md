# Epic: GraphQL Profile Page

> Build a hosted profile page that authenticates against the Zone01 platform
> (JWT), queries the user's own data from the GraphQL endpoint, and displays it
> in three mandatory information sections plus a statistics section with at
> least two SVG graphs.
>
> **Endpoints**
> - GraphQL: `https://((DOMAIN))/api/graphql-engine/v1/graphql`
> - Sign-in:  `https://((DOMAIN))/api/auth/signin`
>
> Every ticket below maps to one or more audit questions. The
> **Audit mapping** line in each ticket points at the exact question(s) in
> [audit-readme.md](./audit-readme.md) that the ticket must satisfy.

---

## Legend

- **Status:** `TODO` · `IN PROGRESS` · `DONE`
- **Priority:** `P0` (blocks audit pass) · `P1` (required) · `P2` (bonus)
- Acceptance criteria are written so each line can be checked off by an auditor.

---

## Audit coverage matrix

Quick view of which ticket satisfies which audit requirement. Keep this in sync
when tickets change.

| Audit requirement (audit-readme.md)                                  | Ticket(s)        |
| -------------------------------------------------------------------- | ---------------- |
| Invalid credentials show an appropriate error                        | T2               |
| Login with valid credentials (username **and** email)               | T2               |
| Profile has the three required sections                              | T5, T6, T7       |
| Section content is accurate vs GraphiQL                              | T5, T6, T7, T13  |
| Fourth section dedicated to graphical statistics                     | T9, T10, T11     |
| At least two different SVG graphs                                    | T10, T11         |
| Graphs display the expected data accurately                          | T10, T11, T13    |
| Profile accessible from a host domain                               | T12              |
| Logout logs the authenticated user out                              | T3               |
| Mandatory queries used: normal, nested, with arguments              | T8               |
| **Bonus** — extra information beyond the three sections             | T14 (T8)         |
| **Bonus** — extra graphs beyond the required two                    | T15              |
| **Bonus** — student created/used their own GraphiQL                 | T16              |
| **Bonus** — UI respects good practices                              | T17              |

---

## Ticket 1 — Project Setup & Structure

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:** Foundation (no direct audit question; enables all others)

### Goal
Stand up the repository and the static-site skeleton (login view + dashboard
view) so every later ticket has a place to live.

### Tasks
- [x] Initialise git repository
- [x] Create file structure: `index.html`, `css/style.css`, `js/app.js`
- [x] Build the two-view skeleton (`#login-view`, `#dashboard-view`)
- [x] Wire `index.html` to the CSS and JS files

### Acceptance criteria
- [x] The page opens locally with no console errors
- [x] Login view is shown by default; dashboard view is hidden

### Notes
Current `index.html` already has both views and the script/style links. The
view toggle currently uses inline `display` switching in `js/app.js` — keep or
refactor into a small router in T4.

---

## Ticket 2 — Authentication (JWT Login)

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"Try to log in with invalid credentials → Is an appropriate error shown?"*
  *"Ask the student to login with valid credentials."*

### Goal
Obtain a JWT from the `signin` endpoint using HTTP **Basic** auth
(base64 of `identifier:password`) and store it for later GraphQL requests.

### Tasks
- [x] Replace the hard-coded `https://DOMAIN/...` with the real platform domain
- [x] Build the login form (identifier + password) — `<form>` + labels in HTML
- [x] Encode credentials with `btoa("identifier:password")`
- [x] `POST` to `/api/auth/signin` with header `Authorization: Basic <base64>`
- [x] Parse the returned JWT (response is a quoted string — quotes stripped)
- [x] Persist the JWT to `localStorage`
- [x] On error, render a human-readable message into `#error`
- [x] Clear the error message on a subsequent successful login

### Acceptance criteria
- [x] **Invalid** credentials display a clear error message (no crash, no blank)
- [x] **Valid** login stores a JWT and switches to the dashboard view
- [x] Login works with **username**:password
- [x] Login works with **email**:password
  *(same input field handles both — sent verbatim as the Basic-auth identifier)*

### Implementation notes
- Domain centralised in `DOMAIN` (`js/app.js`); `SIGNIN_URL` derived from it.
- `cleanToken()` strips the surrounding quotes the endpoint wraps the JWT in.
- Distinct messages for empty fields, network failure, and rejected creds.
- Submit button is disabled during the request (basic loading guard).
- Form submits on Enter (`submit` handler with `preventDefault`).

### Manual verification (needs live creds)
- [ ] Log in with username+password → reaches dashboard
- [ ] Log in with email+password → reaches dashboard
- [ ] Wrong password → "Invalid credentials" message, stays on login
- [ ] Confirm stored token in DevTools has no surrounding quotes

---

## Ticket 3 — Session Management & Logout

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"Log out → Is the logout functionality successful in logging the
  authenticated user out?"*

### Goal
Persist the session across reloads and provide a working logout.

### Tasks
- [x] On load, check `localStorage` for a JWT and route accordingly
- [x] Treat an expired/invalid JWT as logged-out (client-side `exp` check)
- [x] Implement the logout button
- [x] Clear the JWT from `localStorage` on logout

### Acceptance criteria
- [x] Refreshing the page while logged in keeps the user on the dashboard
- [x] Logout clears the token and returns the user to the login view
- [x] After logout, protected data is no longer reachable (no stale render)

### Implementation notes
- Single `logout()` is the one way to end a session — used by the logout button
  and on load when the token is missing/expired. It removes the token AND clears
  `#profile` so no protected data lingers.
- `decodeJwtPayload()` reads the JWT's base64url payload; `isTokenExpired()`
  checks the `exp` claim (treats malformed tokens as expired).
- A server-side rejection (e.g. revoked token) will be caught by the GraphQL
  layer (Ticket 4), which should also call `logout()` on a 401/auth error.

### Manual verification (needs live session)
- [ ] Log in, refresh the page → stays on the dashboard
- [ ] Click Logout → returns to login, `localStorage.token` is `null`
- [ ] After logout, the dashboard shows no leftover profile data

---

## Ticket 4 — GraphQL Service Layer

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:** Foundation for T5–T11 and T13 (data accuracy)

### Goal
A single reusable function that runs any GraphQL query/variables against the
endpoint with `Bearer` auth and consistent error handling.

### Tasks
- [x] `graphqlRequest(query, variables)` helper
- [x] Send header `Authorization: Bearer <jwt>`
- [x] `POST` JSON `{ query, variables }` to the GraphQL endpoint
- [x] Surface GraphQL errors (response `errors[]`) and network errors
- [x] On auth failure, trigger the logout flow from T3

### Acceptance criteria
- [x] Every data query in the app goes through this one function
- [x] A failed/expired token produces a graceful error, not an uncaught throw

### Implementation notes
- `graphqlRequest(query, variables = {})` returns `result.data`.
- Pre-flight: missing/expired token → `logout()` + throw before any network call.
- Error layers handled distinctly: network failure, non-JSON response,
  HTTP 401/403 (→ logout), and GraphQL `errors[]`. JWT-related GraphQL errors
  (Hasura) also trigger `logout()`.
- Callers (Tickets 5–11) `await graphqlRequest(...)` and catch to show messages.

### Manual verification (needs live session)
- [ ] A simple `{ user { id login } }` call returns data while logged in
- [ ] Tampering the stored token then querying → graceful logout, no crash

---

## Ticket 5 — Section 1: User Identification

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"Does the profile page consist of three sections as required?"* (section 1/3)
  *"Are the details … accurate and correspond to the expected data?"*

### Goal
Display basic user identification — the first of the three required sections.

### Query
```graphql
{
  user {
    id
    login
  }
}
```

### UI
- [x] User login
- [x] User ID

### Acceptance criteria
- [x] The section renders the logged-in user's real `login` and `id`
- [ ] Values match what GraphiQL returns for the same query (manual — see T13)

### Implementation notes
- Markup: `#user-section` card in `index.html` with `#user-login` / `#user-id`.
- `loadUserSection()` (a "normal" query) runs via `loadProfile()`, which is
  called by `showDashboard()` — so data loads on login AND on refresh.
- Per-section try/catch so a failure shows a message without blanking the page.
- This satisfies the **normal query** requirement of Ticket 8.

### Manual verification (needs live session)
- [ ] Dashboard shows the correct login and id
- [ ] Values match `{ user { id login } }` run in GraphiQL

---

## Ticket 6 — Section 2: XP

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:** Three required sections (section 2/3); data accuracy.

### Goal
Display the user's total XP — the second required section.

### Query
```graphql
{
  transaction(where: { type: { _eq: "xp" } }) {
    amount
  }
}
```

### UI
- [x] Total XP (sum of `amount` where `type = "xp"`)
- [x] Human-readable formatting (e.g. kB / MB if the platform uses byte-XP)

### Acceptance criteria
- [ ] Total XP matches the sum computed from GraphiQL for the same query (manual — see T13)
- [x] Only `xp`-type transactions are counted (no `level`/`up`/`down` noise)

### Implementation notes
- Markup: `#xp-section` card in `index.html` with `#xp-total`.
- `loadXpSection()` runs via `loadProfile()` → `showDashboard()`, so XP loads on
  login AND on refresh. Per-section try/catch like T5.
- Query uses `where: { type: { _eq: "xp" } }` — this is a **"with arguments"**
  query, contributing to the Ticket 8 checklist.
- Sum done client-side via `reduce`; `formatXp()` renders bytes as B / kB / MB.

### Manual verification (needs live session)
- [ ] Dashboard shows the correct total XP
- [ ] Value matches the sum of `amount` for the same query in GraphiQL

---

## Ticket 7 — Section 3: Grades / Audits

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:** Three required sections (section 3/3); data accuracy.

### Goal
Display the third required section: the **audit ratio** — XP given (Done) vs
received (Received) — matching how the platform profile presents it. (Pass/fail
project counts were dropped: they don't correspond to anything shown on the
platform and the raw `result` table conflates projects with piscine exercises.)

### Query
Audit ratio (XP given vs received):
```graphql
{
  transaction(where: { type: { _in: ["up", "down"] } }) {
    type
    amount
  }
}
```

### UI
- [x] Done (sum of `up`) and Received (sum of `down`), byte-formatted
- [x] Audit ratio = total `up` / total `down`

### Acceptance criteria
- [x] Audit ratio matches the value shown on the platform profile (0.8 confirmed)

### Implementation notes
- Markup: `#grades-section` card with `#audit-done`, `#audit-received`, `#audit-ratio`.
- `loadGradesSection()` runs via `loadProfile()`; per-section try/catch like T5/T6.
- Audit ratio: `transaction(where: { type: { _in: ["up","down"] } })` (**with
  arguments**), ratio = sum(up) / sum(down), 1 decimal place. Done/Received
  rendered via `formatXp()`.

---

## Ticket 8 — Required GraphQL Query Types

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"Does the project have at least the mandatory queries
  (nested, normal and using arguments)?"*

### Goal
Guarantee all three mandatory query forms are actually used in the app. This is
a cross-cutting checklist over T5–T11, not a separate feature.

### Tasks — confirm each form is used somewhere in the codebase
- [x] **Normal** query — `{ user { id login } }` in `loadUserSection()` (T5)
- [x] **Query with arguments** —
  `transaction(where: { type: { _eq: "xp" } })` in `loadXpSection()` (T6);
  also the audit `_in: ["up","down"]` query in `loadGradesSection()` (T7)
- [x] **Nested** query — `result { grade object { name type } }` in
  `loadRecentSection()` (also powers the "Recent projects" card)

### Acceptance criteria
- [x] All three query types are present and executed in the running app
- [ ] Each is demonstrable to the auditor in DevTools network tab (manual)

### Notes
The nested query was added as a real feature (Recent projects) rather than a
throwaway, so the nesting is visible in the UI as well as the network tab. All
three forms fire on dashboard load via `loadProfile()`.

The query's `limit` was later raised from 5 to 30 so the card can offer a
**Show more** toggle over the full history (T15); it still displays
`RECENT_VISIBLE` (5) until expanded.

---

## Ticket 9 — Section 4: Statistics (SVG container)

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"Does the profile include a fourth section dedicated to graphical
  statistics?"*

### Goal
Create the dedicated statistics section that hosts the SVG graphs.

### Tasks
- [x] Add a clearly-labelled "Statistics" section to the dashboard
- [x] Provide responsive SVG containers for at least two graphs
- [x] Build a tiny SVG helper (scaling, axes, labels) reused by T10/T11

### Acceptance criteria
- [x] A distinct fourth section exists, separate from the three info sections
- [x] Graphs are drawn with **SVG** (not canvas, not an image, not a chart lib)

### Implementation notes
- Markup: `#stats-section` with two `<figure>` graph boxes (`#graph-xp`,
  `#graph-audit`), each showing a placeholder until T10/T11 draw into it.
- CSS `.graphs` is a 1-col grid that becomes 2-col ≥560px; `.graph-box svg`
  scales to container width via `viewBox` + `width:100%`.
- JS helpers `svgEl(name, attrs)` and `createSvg(w, h)` create namespaced SVG
  nodes — reused by T10/T11. `loadStatsSection()` is the single entry point
  that T10/T11 will fill in.

---

## Ticket 10 — SVG Graph #1: XP Progress Over Time

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"At least two different graphs created using SVG"* (graph 1/2);
  *"Do the graphs display the expected data accurately?"*

### Goal
A line/area chart of cumulative XP over time.

### Data source
```graphql
{
  transaction(
    where: { type: { _eq: "xp" } }
    order_by: { createdAt: asc }
  ) {
    amount
    createdAt
  }
}
```

### SVG features
- [x] X axis (time) and Y axis (cumulative XP) with labels
- [x] Polyline / path of the cumulative total
- [ ] Bonus: hover tooltip with the value at a point (not done)

### Acceptance criteria
- [ ] The final cumulative value equals the total XP shown in T6 (manual — see T13)
- [x] The trend visibly tracks the chronological transactions

### Implementation notes
- `drawXpGraph()` (called by `loadStatsSection()`) renders into `#graph-xp`.
- Cumulative running total over time; `polyline` for the line, `line`+`text`
  for axes and 0/max + first/last-date labels. Y-max label uses `formatXp()`.
- Coordinate scaling via `sx()`/`sy()` into a 480×260 viewBox; CSS scales it to
  the container. Uses the `svgEl()`/`createSvg()` helpers from T9.
- Guards: <2 points shows a "not enough data" placeholder.

---

## Ticket 11 — SVG Graph #2: Audit Ratio (bar chart)

- **Status:** DONE
- **Priority:** P0
- **Audit mapping:**
  *"At least two different graphs created using SVG"* (graph 2/2);
  data accuracy.

### Goal
A second, **different** graph type (bar chart) visualising the audit ratio —
XP given (Done) vs received (Received), consistent with the T7 section.

### Data source
```graphql
{
  transaction(where: { type: { _in: ["up", "down"] } }) {
    type
    amount
  }
}
```

### SVG features
- [x] Bar chart — a different chart type than T10's line chart
- [x] Per-bar value labels (`formatXp`) + category labels (Done / Received)

### Acceptance criteria
- [x] Two bars: Done = sum(up), Received = sum(down)
- [ ] Values match the Done/Received figures in T7 (manual — see T13)

### Implementation notes
- `drawAuditGraph()` (called by `loadStatsSection()`) renders into `#graph-audit`.
- Reuses the T7 up/down query; bars scaled to the larger of the two values.
- Switched from the tracker's original pass/fail idea to Done/Received to match
  what the platform actually shows (see T7 rationale).
- **Graph zoom:** clicking any `.graph-box` opens an enlarged clone of its SVG
  in a modal/lightbox (`#graph-modal`); closes via X, backdrop, or Escape.
  `setupGraphModal()` wires this once on load (counts toward T17 UI polish).

---

## Ticket 12 — Hosting / Deployment

- **Status:** TODO
- **Priority:** P0
- **Audit mapping:**
  *"Try to access the profile from the host domain → Is the profile
  successfully accessible and hosted online?"*

### Goal
Publish the site so the auditor can open it at a public URL.

### Tasks
- [ ] Choose a host (GitHub Pages / Netlify / …)
- [ ] Deploy the static site
- [ ] Verify the deployed login flow works against the live endpoints

### Acceptance criteria
- [ ] The profile is reachable at a public URL
- [ ] Login, all sections, graphs, and logout work on the hosted version
- [ ] Record the live URL in `README.md`

---

## Ticket 13 — Data Accuracy Verification (GraphiQL cross-check)

- **Status:** IN PROGRESS
- **Priority:** P0
- **Audit mapping:**
  *"Verify the accuracy of the content … using GraphiQL"* and
  *"Try to validate the accuracy of the information presented in the graphs."*

### Goal
A pre-audit pass confirming every displayed number matches the source data.
This is the step an auditor will literally perform, so do it first ourselves.

### Tasks
- [x] Write the cross-check procedure: every UI value paired with the exact
      GraphiQL query that proves it — [docs/data-verification.md](./data-verification.md)
- [x] Internal review of the rendered dashboard — no discrepancies
- [x] Confirm both graphs (T10/T11) agree with the card values they mirror
- [ ] Run each app query in GraphiQL and compare values to the source rows

### Acceptance criteria
- [x] No discrepancy between the UI's own values (cards vs graphs vs arithmetic)
- [ ] No discrepancy between the UI and GraphiQL for any displayed value
- [ ] Every checkbox in [data-verification.md](./data-verification.md) is ticked

### Implementation notes
- [docs/data-verification.md](./data-verification.md) has six checks, one per
  data surface (3 required sections, the nested recent-projects query, and both
  SVG graphs), each with the query copied verbatim from `js/app.js` and the
  expected computation spelled out.
- It also documents the `formatXp()` byte→kB/MB conversion, since GraphiQL
  returns raw bytes and a mismatch there looks like a data bug but isn't.
- A "cross-section consistency" block catches the common regressions (graph
  totals drifting from the card totals) without needing GraphiQL at all.
- **Internal review (2026-08-30) found no discrepancies.** Total XP `2.19 MB`,
  Done `790.35 kB`, Received `968.59 kB`, Ratio `0.8` — the ratio arithmetic
  checks out (0.8159… → 0.8) and both graphs match the cards they mirror. The
  audit card and bar chart share one `fetchAuditTotals()` call so they cannot
  drift; Total XP and the graph's Y-max are computed independently from the same
  query, so their agreement genuinely validates the cumulative logic.
- Still open: running the queries in GraphiQL to confirm the numbers match the
  source rows, not just each other. See the doc's "Result" section.

### Manual verification (needs live session)
- [ ] Work through [data-verification.md](./data-verification.md) end to end

---

## Ticket 14 — Bonus: Extra Information

- **Status:** DONE
- **Priority:** P2
- **Audit mapping:**
  *"+Does the profile showcase additional information beyond the three
  mandatory sections?"*

### Goal
Add genuinely useful extra data beyond the three required sections.

### Delivered
- [x] **Skills breakdown** — new `#skills-section` card listing the user's
      skills as labelled percentage bars, with a Show more / Show less toggle
      when there are more than 6
- [x] **Recent projects** — `#recent-section` (already shipped under T8, where
      it served as the nested query; it counts as extra information too)

### Acceptance criteria
- [x] At least one meaningful section exists beyond the three required ones
      (two do: Skills and Recent projects)

### Implementation notes
- The platform records skills as transactions whose `type` is prefixed
  `skill_` (`skill_go`, `skill_prog`, …) where `amount` is a **percentage**,
  not XP. Matched with `where: { type: { _like: "skill_%" } }` — another
  "with arguments" query.
- A skill is re-recorded each time it improves, so the current level is the
  **highest** amount for that type, not the sum. `loadSkillsSection()` orders
  by `amount: desc` and keeps the first row per type, then shows the top 6.
- `formatSkillName()` turns `skill_web-dev` into `Web dev` for display.
- Rendered as CSS bars rather than SVG, deliberately: the SVG graphs belong to
  the Statistics section (T9–T11), and keeping this card visually distinct
  avoids muddying the "fourth section dedicated to graphs" requirement.
- Shows the top `SKILLS_VISIBLE` (6); any beyond that are rendered but hidden
  behind a **Show N more / Show less** toggle. The button stays hidden when
  nothing overflows, and the list re-collapses on reload or logout so it never
  reopens in a stale expanded state.
- The toggle machinery is generic (`applyOverflow` / `setExpanded` /
  `resetOverflow` in the SHOW MORE section), shared with Recent projects and
  the XP-by-project graph rather than duplicated per section.
- Bar widths are clamped to 0–100% so an unexpected value can't overflow the
  card; an empty result renders "No skill data available." instead of an error.

### Manual verification
- [x] Skills card lists real skills with plausible percentages — verified
      2026-08-30: 19 skills from Prog 75% down to Sys admin 10%, correctly
      ordered, names formatted, "Show 13 more" toggle working
- [ ] Values match `transaction(where: { type: { _like: "skill_%" } })` in
      GraphiQL, taking the max `amount` per type *(needs GraphiQL)*

---

## Ticket 15 — Bonus: Extra Graph(s)

- **Status:** DONE
- **Priority:** P2
- **Audit mapping:**
  *"+Are there additional graphs featured apart from the required two?"*

### Goal
Add a third SVG graph (e.g. XP by project, piscine attempts per exercise).

### Delivered
- [x] **XP by project** — horizontal bar chart in `#graph-projects`, showing the
      top 8 projects by XP earned

### Query
```graphql
{
  transaction(
    where: {
      type: { _eq: "xp" }
      object: { type: { _eq: "project" } }
    }
    order_by: { amount: desc }
  ) {
    amount
    object { name }
  }
}
```

### Acceptance criteria
- [x] A third distinct SVG graph is present
- [ ] Values are accurate vs GraphiQL (manual — see data-verification.md)

### Implementation notes
- `drawProjectsGraph()` runs from `loadStatsSection()` alongside T10/T11.
- **A third chart orientation**, not a third copy of the same idea: the other
  two run vertically, but project names are long, so bars grow left-to-right
  with the name in a left gutter and the XP value past the bar's end.
- Nested query (`transaction → object { name }`) — the project name arrives in
  the same round trip, reinforcing the T8 nested-query requirement.
- A project can pay out XP more than once, so amounts are **summed per name**
  rather than taking a single row.
- Local geometry instead of the shared `CHART.pad`: the left gutter is widened
  to 132px for names and the right to 72px so the longest bar's value label
  ("200.00 kB") still fits inside the viewBox. Height grows with the row count
  so bars keep a readable thickness at any project count.
- `truncate()` shortens names past 18 chars — SVG has no `text-overflow`.
- Spans both grid columns (`.graph-wide`) so it isn't orphaned in a half-width
  cell; horizontal bars read better wide.
- Inherits click-to-zoom, loading and reset states automatically, since all
  three are wired by `.graph-box` selectors.
- **Show more / Show less**: shows the top `PROJECTS_VISIBLE` (8) with a toggle
  revealing the rest. An SVG can't be collapsed with a CSS class the way a list
  can, so `renderProjectsGraph(expanded)` redraws it at the new length from the
  cached `allProjects`; the height grows to match. The toggle's click is
  stopped from bubbling so it doesn't also open the zoom modal.

### Manual verification (needs live session)
- [ ] Graph lists real projects with plausible XP values
- [ ] Totals match the same query in GraphiQL, summed per project name

---

## Ticket 16 — Bonus: Own GraphiQL

- **Status:** DONE
- **Priority:** P2
- **Audit mapping:**
  *"+Has the student created and utilized their own GraphiQL?"*

### Goal
Provide an in-app query playground (custom GraphiQL-like panel) authenticated
with the user's JWT.

### Delivered
- [x] `#graphiql-section` card with a query editor, an optional variables
      editor, a Run button and a JSON result pane
- [x] Four one-click example queries — the same ones that back the profile
      sections, so the T13 cross-check can be run inside the app itself

### Acceptance criteria
- [x] User can type a query, run it, and see the JSON result inside the app

### Implementation notes
- **Deliberately does not reuse `graphqlRequest()`.** That helper returns only
  `data` and throws on `errors[]` — correct for the dashboard, wrong for a
  playground, which must *show* a malformed query's error (message, line,
  column) rather than collapse it into a thrown string. `runPlaygroundQuery()`
  posts directly and renders the whole envelope, `errors` and `data` alike.
- Auth and session handling still match the rest of the app: the JWT is checked
  for expiry before the request, and a 401/403 triggers `logout()`.
- Variables are `JSON.parse`d client-side so a JSON typo is reported as such,
  instead of arriving at the server as a confusing GraphQL error.
- Status line reports outcome and timing (`OK · 42 ms`, `2 errors · 31 ms`).
- <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd> runs the query from the
  editor. Example buttons only *load* a query — the user still presses Run, so
  nothing fires against the endpoint unasked.
- The card is **collapsed by default** so the playground doesn't compete with
  the profile itself, and the result pane is height-capped with its own scroll
  so a large response can't push the dashboard off-screen.
- `resetPlayground()` clears the result on logout so one session's query output
  can't linger into the next.

### Manual verification (needs live session)
- [ ] A valid query returns JSON matching the dashboard
- [ ] A malformed query shows the GraphQL error rather than a blank pane
- [ ] Invalid variables JSON is reported before any request is sent
- [ ] Ctrl+Enter runs the query
- [ ] After logout, the result pane is cleared

---

## Ticket 17 — Bonus: UI / Good Practices

- **Status:** DONE
- **Priority:** P2
- **Audit mapping:**
  *"+Does the UI respect the good practices?"*

### Goal
Polish the interface to good-UI standards.

### Tasks
- [x] Loading states for async data
- [x] Empty / error states
- [x] Responsive layout, readable contrast, consistent spacing
- [x] Accessible labels on inputs and buttons

### Acceptance criteria
- [x] The UI is responsive, gives feedback during/after actions, and is legible

### What was already in place
Much of this arrived with earlier tickets rather than as a late polish pass:
`showLoading()` fills every value slot with "Loading…" (T5–T11), each section
has its own empty and error state, the login form has real labels plus
`autocomplete` and `required`, the layout uses only max-widths, and the graphs
scale via `viewBox`.

### Fixed in this ticket
- **Dashboard errors were invisible.** All nine section-failure messages went
  to `#error`, which lives inside the login view and is hidden once the
  dashboard is up — so a failed XP or skills query reported nothing at all.
  `showError()` now routes to whichever view is on screen, and the new
  `#dashboard-error` banner accumulates failures (one reload can break several
  sections independently). Cleared on each load and on logout.
- **Contrast below WCAG AA.** `.hint` and `.graph-placeholder` used `#64748b`
  — 3.07:1 on the card background, under the 4.5:1 body-text floor. Moved to
  `#94a3b8` (5.71:1). Measured, not eyeballed; the remaining `#475569` is a
  hover background and an axis stroke, neither of which is text.
- **Focus was mostly invisible.** Only two elements had a focus style. Added
  one `:focus-visible` ring covering every interactive element.
- **The graph zoom was mouse-only.** The `.graph-box` elements now carry
  `tabindex`/`role`/`aria-label` and respond to Enter and Space.
- **The modal ignored focus.** Opening it now moves focus to Close, Tab is kept
  inside the dialog, and closing returns focus to the graph that opened it.
- **A click on the graph's Show more also opened the zoom modal** — the modal's
  delegated handler now ignores clicks that land on a button.
- **`<label for>` pointed at a `<pre>`**, which isn't a labelable element;
  replaced with `aria-labelledby` on a `role="region"`.
- **Narrow screens**: below 420px, skill names sit above their bar instead of
  squeezing it, and the run/controls rows wrap.
- **`prefers-reduced-motion`** is honoured.

### Manual verification
- [ ] Tab through the page — every stop is visibly focused
- [ ] Tab to a graph, press Enter — it zooms; Escape closes and focus returns
- [ ] Break a query in the playground — the error appears in the banner
- [ ] Resize to ~360px — nothing overflows horizontally
