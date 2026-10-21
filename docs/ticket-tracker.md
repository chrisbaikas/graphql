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

## Where the project stands (2026-10-22)

The required features and bonus cards/graphs/playground are implemented.
**The project is not yet fully audit-verified.** Remaining work:

| Remaining | Completion evidence | Ticket |
| --- | --- | --- |
| Publish on a public HTTPS host | Record live URL in README and test login, sections, graphs, refresh and logout there | T12 — TODO |
| Verify source data with a real account | Complete [data-verification.md](./data-verification.md) in the platform's independent GraphiQL | T13 — IN PROGRESS |
| Final live browser pass | Username AND email login, wrong credentials, expired/revoked token, keyboard controls, small screen and tab-scoped sessions | T2/T3/T4/T17 manual boxes |

The 2026-10-22 review exercised the app locally with synthetic API responses;
it did not use real credentials, publish a site, or establish live data accuracy.
Checked implementation boxes describe code delivered; unchecked manual boxes
remain required before claiming a complete audit pass.

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
- [x] Create file structure: `index.html`, `css/style.css`, `js/` (originally a
  single `js/app.js`; split into ES modules under `js/` in the modular refactor)
- [x] Build the two-view skeleton (`#login-view`, `#dashboard-view`)
- [x] Wire `index.html` to the CSS and JS files

### Acceptance criteria
- [x] The page opens locally with no console errors
- [x] Login view is shown by default; dashboard view is hidden

### Notes
Current `index.html` already has both views and the script/style links. View switching lives in `js/ui/views.js`; `js/main.js` wires the app.

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
- [x] Encode credentials as UTF-8 bytes, then base64
- [x] `POST` to `/api/auth/signin` with header `Authorization: Basic <base64>`
- [x] Parse the returned JWT (response is a quoted string — quotes stripped)
- [x] Persist the JWT to `sessionStorage`
- [x] On error, render a human-readable message into `#error`
- [x] Clear the error message on a subsequent successful login

### Acceptance criteria
- [x] **Invalid** credentials display a clear error message (no crash, no blank)
- [x] **Valid** login stores a JWT and switches to the dashboard view
- [x] Login works with **username**:password
- [x] Login works with **email**:password
  *(same input field handles both — sent verbatim as the Basic-auth identifier)*

### Implementation notes
- Domain centralised in `DOMAIN` (now `js/config.js`); `SIGNIN_URL` derived from it.
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
- [x] On load, check `sessionStorage` for a JWT and route accordingly
- [x] Treat an expired/invalid JWT as logged-out (client-side `exp` check)
- [x] Implement the logout button
- [x] Clear the JWT from `sessionStorage` on logout

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
  layer (Ticket 4), which should also call `logout()` on a 401/explicit JWT error; a permission denial preserves the session.

### Manual verification (needs live session)
- [x] Log in, refresh the page → stays on the dashboard
- [ ] Click Logout → returns to login, `sessionStorage.token` is `null`
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
- [x] Every dashboard data query goes through this function; the playground
      deliberately retains the complete response envelope
- [x] A failed/expired token produces a graceful error, not an uncaught throw

### Implementation notes
- `graphqlRequest(query, variables = {})` returns `result.data`.
- Pre-flight: missing/expired token → `logout()` + throw before any network call.
- Error layers handled distinctly: network failure, non-JSON response,
  HTTP 401 (→ logout), 403 permissions (session preserved), and GraphQL `errors[]`. JWT-related GraphQL errors
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
{ user { id login } }
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
- [x] Dashboard shows the correct login and id — `chbaikas` / `6844`
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
query XpTransactions($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "xp" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: [{ createdAt: asc }, { id: asc }]
  ) {
    id
    objectId
    amount
    createdAt
    path
    object {
      id
      name
    }
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
- [x] Dashboard computes cursus XP from the filtered transactions; live total
      verification remains under T13
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
query AuditTotals($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    order_by: { id: asc }
    where: { type: { _in: ["up", "down"] } }) { id type amount }
}
```

### UI
- [x] Done (sum of `up`) and Received (sum of `down`), byte-formatted
- [x] Audit ratio = total `up` / total `down`

### Acceptance criteria
- [ ] Audit ratio matches the current platform profile — live re-check under T13
      (the old 0.8 observation is not a current baseline)

### Implementation notes
- Markup: `#grades-section` card with `#audit-done`, `#audit-received`, `#audit-ratio`.
- `loadAuditSection()` runs via `loadProfile()`; per-section try/catch like T5/T6.
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
  also the audit `_in: ["up","down"]` query in `loadAuditSection()` (T7)
- [x] **Nested** query — `result { grade object { name type } }` in
  `loadRecentSection()` (also powers the "Recent projects" card)

### Acceptance criteria
- [x] All three query types are present and executed in the running app
- [ ] Each is demonstrable to the auditor in DevTools network tab (manual)

### Notes
The nested query was added as a real feature (Recent projects) rather than a
throwaway, so the nesting is visible in the UI as well as the network tab. All
three forms fire on dashboard load via `loadProfile()`.

Recent results are now paginated until 60 pass the cursus filter or rows are
exhausted. **Show more** reveals that bounded recent history; the card displays
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
- Markup: `#stats-section` with three `<figure>` graph boxes (`#graph-xp`,
  `#graph-audit`, `#graph-projects`), each showing a placeholder until drawn.
- CSS `.graphs` is a responsive grid with 320px minimum column widths; `.graph-box svg`
  scales to container width via `viewBox` + `width:100%`.
- JS helpers `svgEl(name, attrs)` and `createSvg(w, h)` create namespaced SVG
  nodes — reused by T10/T11. `loadStatsSection()` is the single entry point
  that starts all three graph loaders.

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
query XpTransactions($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "xp" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: [{ createdAt: asc }, { id: asc }]
  ) {
    id
    objectId
    amount
    createdAt
    path
    object {
      id
      name
    }
  }
}
```

### SVG features
- [x] X axis (time) and Y axis (cumulative XP) with labels
- [x] Polyline / path of the cumulative total
- [x] Bonus: native SVG title tooltips on sampled points, including the final total

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
query AuditTotals($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    order_by: { id: asc }
    where: { type: { _in: ["up", "down"] } }) { id type amount }
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

## Post-implementation audit (2026-08-31)

A full read of `js/app.js`, `index.html` and `css/style.css` after T17, looking
for defects rather than polish. Fixed on branch `chbaikas/fixes`:

**Session leaks between users**
- `logout()` left `allProjects` populated, so one user's project names and XP
  stayed in memory and could be redrawn for the next. Now cleared.
- `resetPlayground()` cleared the GraphiQL *result* but left the query and
  variables the previous user typed in the editors. Both now reset.
- `resetOverflow()` left `dataset.hidden` and `aria-expanded` from the previous
  render, so a stale "Show 14 more" could be read back. Both now cleared.

**Wrong information shown to the user**
- Login mapped **every** non-2xx to "Invalid credentials" — a 500 or 502 from
  the platform told the user their password was wrong. Now only 401/403 say
  that; other statuses report a server error.
- The XP graph took the last cumulative point as its maximum. A negative XP
  correction breaks that assumption and plots earlier points above the top of
  the chart. Now uses the real maximum.
- On an expired token all six section loaders called `logout()` and each wrote
  to the login view's single error line, so five messages overwrote the first.
  Only the first now reports (`SilentError` + `reportSectionError`).
- The playground's bare `catch` labelled every failure "Network error". Now
  only an actual fetch rejection says that.

**Init-order crashes (found by executing app.js against a stubbed DOM)**
- `DEFAULT_PLAYGROUND_QUERY` and `allProjects` were declared below the routing
  that runs at parse time, and the **logged-out** branch reaches both through
  `logout() → resetProfile()`. Every first visit would have thrown a TDZ
  `ReferenceError`. Both moved into the config block.

**Comments contradicting the code**
- Removed a click guard and a `stopPropagation()` that both defended against a
  conflict that cannot occur (the graphs' Show more buttons sit outside
  `.graph-box`), along with the comments describing it.
- "Expand all" includes the GraphiQL card; it starts collapsed, and explicit
  expansion of all cards also opens the playground.
- Corrected the hoisting comment to name the real caller (`showLoading`).

---

## Ticket 12 — Hosting / Deployment

- **Status:** TODO — public deployment and hosted verification remain open
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
- [ ] Record the live URL in `README.md`

### Acceptance criteria
- [ ] The profile is reachable at a public URL
- [ ] Login, all sections, graphs, and logout work on the hosted version
- [ ] Record the live URL in `README.md`

### Ready to deploy
No build is required. The site is plain static files with
no build step, and the repo holds no credentials — only code that *handles* a
password (verified by scanning the tracked files). The deployable set is:

```
index.html
css/style.css
js/          # the whole directory — the app loads as ES modules
.nojekyll    # bypass Jekyll on GitHub Pages
```

The **entire** `js/` directory ships, not a single file: `index.html` loads
`js/main.js` as a module and that module imports the rest of the tree at
runtime. Omitting any of it leaves the deployed page blank.

`docs/`, `AGENTS.md` and `Makefile` are harmless to ship but irrelevant to the
audit.

### Option A — Netlify Drop

1. Open the Netlify deployment dashboard / Drop and sign in as required.
2. Upload only `index.html`, `css/`, `js/` and `.nojekyll`.
3. Netlify returns a URL like `https://random-name-123.netlify.app`.
4. Optionally rename it under *Site settings → Change site name*.

No git push is needed. Static hosting serves the HTML, CSS and JavaScript
source to visitors; never include credentials or local secret files.

### Option B — GitHub Pages

The project's `origin` is the Zone01 Gitea instance, which does not serve
Pages, so this needs a GitHub remote as well.

```bash
# 1. Create a public GitHub repository for static hosting
gh repo create graphql-profile --public --source=. --remote=github

# 2. Publish the reviewed branch without rewriting any remote history
git push github chbaikas/security-and-polish

# 3. Turn on Pages, serving from the root of the reviewed branch
gh api -X POST repos/:owner/graphql-profile/pages \
  -f "source[branch]=chbaikas/security-and-polish" -f "source[path]=/"
```

The URL will be `https://<username>.github.io/graphql-profile/`. It can take a
minute or two to go live on the first deploy.

**Note:** this makes the source public. Nothing sensitive is in it, but it is a
one-way step — a repo that has been public should be treated as having been
seen.

### Option C — any other static host

Vercel, Cloudflare Pages, Surge, GitLab Pages all work the same way: point them
at the folder, no build command, no output directory.

### After deploying — verify on the live URL, not localhost

- [ ] The login page loads over **https**
- [ ] Log in with valid credentials → dashboard appears
- [ ] All three required sections show real values
- [ ] Both required graphs render, plus the bonus third
- [ ] Logout returns to the login view
- [ ] Reload while logged in → still on the dashboard
- [ ] Paste the URL into `README.md` under **Live URL**

If login works locally but fails on the live URL, check the browser console for
a CORS error: the platform must accept requests from the new origin. The GraphQL POST uses `Authorization` and `Content-Type: application/json`,
so verify that the platform allows the hosted origin and its CORS preflight.

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
- [x] Document the current path filters and computation rules for each value;
      remove stale account totals and unscoped aggregate comparisons
- [ ] Run those queries in the **platform's** GraphiQL and compare
      *(the only step that needs live credentials)*

### Acceptance criteria
- [x] No discrepancy between the UI's own values (cards vs graphs vs arithmetic)
- [ ] No discrepancy between the UI and GraphiQL for any displayed value
- [ ] Every checkbox in [data-verification.md](./data-verification.md) is ticked

### Implementation notes
- [data-verification.md](./data-verification.md) mirrors the current named
  queries in `js/data/queries.js`, including level, history, skills and all graphs.
- XP comparisons must apply `isCursusPath()`; unfiltered aggregates include
  out-of-cursus and nested Piscine rows and cannot prove the displayed total.
- XP by project groups by object ID, not display name. Recent projects fetch
  pages until 60 results remain after the client-side Piscine filter or the source is exhausted.
- Synthetic browser results verify behavior, not the actual platform's schema,
  access rules, row completeness, CORS, or today's account totals.
- Complete the independent GraphiQL comparison with a real account before
  marking this ticket DONE. Do not reuse historical XP totals as a baseline.

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
query XpTransactions($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "xp" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: [{ createdAt: asc }, { id: asc }]
  ) {
    id
    objectId
    amount
    createdAt
    path
    object {
      id
      name
    }
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
- A project can pay out XP more than once, so amounts are **summed per object ID**
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
  cached `allProjects`; the height grows to match. The toggle sits outside
  the zoom trigger, so it does not open the modal.

### Manual verification (needs live session)
- [ ] Graph lists real projects with plausible XP values
- [ ] Totals match the same query in GraphiQL, summed per object ID

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
- [x] Five one-click example queries — the same ones that back the profile
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
  for expiry before the request. HTTP 401 / explicit JWT failures end the
  session; HTTP 403 / query permission failures preserve it.
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
- [x] Chromium fixtures: visible keyboard focus throughout the page
- [x] Chromium fixtures: Enter zooms, Tab stays in the modal, Escape restores focus
- [x] Chromium fixtures: playground GraphQL errors appear in the result pane
- [x] Chromium fixtures: 320/360/560/1280px layouts fit without horizontal overflow

---

## Refactor — modular architecture (2026-08-31)

`js/app.js` had grown to 1265 lines holding seven unrelated responsibilities.
Split into 25 ES modules loaded natively by the browser, so the "no build step,
no dependencies" constraint is unchanged — `index.html` now loads
`<script type="module" src="./js/main.js">`.

### The organising seam

Fetching and rendering were entangled: every `loadXSection()` built a query,
awaited it, *and* wrote DOM. They are now separate layers — `data/profile.js`
returns plain objects and touches no DOM; `sections/` and `charts/` render
those objects and never fetch. See AGENTS.md § Architecture rules.

### Defects found and fixed

- **Two duplicate GraphQL requests per dashboard load.** The XP card and the
  XP-over-time graph each fetched the same `type: "xp"` transactions, and the
  audit card and audit graph each fetched the same `up`/`down` rows. The fetch
  layer now caches per load, so shared rows cost one request between them:
  **8 requests down to 6**, and the card and its graph can no longer disagree.
- **Logout could skip clearing cached data.** `resetProfile()` returned early
  if `#profile` was missing, *before* reaching `resetPlayground()`,
  `resetProjectsCache()` and `clearDashboardError()` — leaving one user's
  project data and typed query available to the next. Those calls now run
  before any DOM lookup can bail out.
- **Unhandled promise rejection in the new cache** (introduced during this
  refactor, caught by the harness below). Caching `fn().catch(...)` — the
  derived promise — left a rejection unhandled in the window between eviction
  and the next caller, even though every caller had a try/catch. The original
  promise is cached now, with eviction attached as a separate settled handler.
- **Two `document` keydown listeners** in the graph modal, with an implicit
  ordering dependency between the open and close branches. Merged into one
  handler that branches on `modal.hidden`.

### Verification

At the time of this historical refactor, no automated tests existed; the app was executed against a stubbed DOM in Node
(the same technique the T17 audit used) to check behaviour, not just syntax:

- all 25 modules parse as modules; every `import` resolves to a real export
- full load renders all six values, both lists and all three SVGs — 6 requests,
  **no duplicates**
- logout clears token, values, playground and caches; re-login re-fetches
- expired token on load → login view, **zero** requests fired
- one failing section leaves the others rendered and shows the banner
- a mid-session 401 logs out with **one** message, not six
- Enter opens the zoom modal and Escape closes it, through the single handler
- served over HTTP, all 25 modules return 200 `text/javascript`

### Manual verification
- [ ] `make run`, log in — every card populates and all three graphs draw
- [ ] DevTools Network: six query definitions, with shared paginated XP/audit requests
- [ ] Log out, log back in — everything repopulates


## Repository review — 2026-10-22

Deep review covers the whole repository and the preceding uncommitted pass on
`chbaikas/security-and-polish`. The final source retains vanilla ES modules,
zero runtime dependencies, hand-written SVG, and no build step.

### Fixed and verified
- [x] **Session credentials:** restored the branch's intended sessionStorage
      design, following the final user instruction. Startup/login/logout remove
      legacy localStorage tokens; credentials are never migrated or logged.
      Updated AGENTS/README so the former storage instruction cannot recur.
- [x] **Authentication races:** pending login ownership prevents repeat submits;
      logout releases the old attempt, cancels it, and guards both its response
      and finally block against a newer login. Returned JWTs are validated.
- [x] **JWT parsing:** UTF-8/base64url payloads, three nonempty segments and finite
      expiry are checked. The platform still verifies signatures/permissions.
- [x] **Cancellation/timeouts:** caller signals combine with the 12-second budget;
      session generations abort prior work, including body reads. Timeouts,
      aborts, HTTP statuses, malformed JSON and network failures remain distinct.
- [x] **GraphQL errors:** HTTP 401 / explicit JWT errors end the session and show
      the reason after reset. HTTP 403 / access-denied query errors preserve a
      valid session. HTTP 400/5xx retain useful GraphQL/server messages. Invalid
      envelopes are rejected; dashboard partial data is not displayed as totals.
- [x] **Complete data:** list queries page with stable ID tie-breaks until an
      empty page, even when the server caps page size below the requested limit.
      Recent activity retains 60 rows after filtering. Repeated IDs fail clearly
      rather than double-counting. No user/event/project IDs are hardcoded.
- [x] **Calculations/cache:** malformed arrays, IDs, amounts and XP dates fail
      visibly; skills explicitly take their maximum; null grades show pending.
      XP card/history/line/project bars share the same filtered XP promise and
      snapshot. Grouping uses object IDs. Cache eviction and generation changes
      cannot serve one user's rows to another.
- [x] **Playground:** named examples reuse query definitions, object variables
      are validated before requests, complete GraphQL envelopes remain visible,
      repeat execution is guarded, and late output/finally cannot affect a new
      run. Logout resets editors, output, status and button ownership.
- [x] **UI/modal/security:** logout clears enlarged SVGs and chart descriptions;
      the modal makes background content inert, traps Tab, supports Escape and
      restores focus. Main landmark, route focus, placeholder contrast, narrow
      header, wrapped labels and readable chart widths were corrected. Login is
      disabled until JS wiring succeeds; native fallback uses POST, never a
      password in a URL. The CSP remains restrictive, without unsafe-inline/eval.
- [x] **SVG math:** negative corrections, zero-width bars, identical timestamps,
      single/empty/large datasets, Unicode labels and measured value gutters are
      handled. Screen readers can read chart summaries; reset clears them.
- [x] **Deployment/docs:** relative modules/assets and subpath refresh tested;
      `.nojekyll` added. Current queries, paging, session lifetime and remaining
      live checks are documented. Historical sections above describe earlier
      implementations; this review and data-verification.md describe the final code.

### Evidence
- **122 Node tests**: direct execution of each `tests/*.test.js`, plus `make test`
      and `make check` (tests + module syntax). No test framework was added.
- **11 Chromium scenario groups** with synthetic API responses: login and
      transport failures, timeout recovery with a shortened test budget, paging
      under a three-row server cap, calculations, three SVGs, all dataset edge
      cases above, modal/keyboard/focus, pending logout and A→B races, playground,
      expired stored sessions, same-tab refresh and simulated hosting subpaths.
- Real streamed HTTP body timeout verified in Chromium against a temporary
      local server, separately from the mocked response tests.
- Widths **320/360/560/1280px**, reduced-motion mode, screenshots inspected locally;
      no unexpected JS errors, unhandled rejections, CSP violations or missing assets.
- `git diff --check`, complete diff review, import/asset checks and a targeted
      credential scan pass before the final commit. All 27 non-entry modules
      import successfully in Node; Chromium loads the entry module and its assets. Temporary browser
      scripts/screenshots stay outside the repository.

### Genuinely open
- **T13:** no real platform account/session was supplied. Verify the live schema,
      every displayed source value, permissions, and dataset completeness using
      [data-verification.md](./data-verification.md). Synthetic data is not proof
      of real-account accuracy.
- **T12:** no public URL/deployment target is configured. Publish the static site,
      record its HTTPS URL in README, and verify real hosted login/CORS/data/logout.

The complete audited change is committed on the existing branch under the
user's explicit instruction. No new branch or history rewrite is needed; git
history records the commit hash and the final delivery report records push status.
