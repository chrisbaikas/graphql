# Data Accuracy Verification (Ticket 13)

Pre-audit cross-check: every number the dashboard shows, next to the exact
GraphiQL query an auditor would run to confirm it.

The auditor's questions this answers (see [audit-readme.md](./audit-readme.md)):

> *Verify the accuracy of the content/information in the three Sections using **GraphiQL**.*
> *Try to validate the accuracy of the information presented in the graphs.*

---

## How to run this check

1. Serve the app and log in:
   ```bash
   make run   # http://localhost:8042
   ```
2. Open a GraphiQL. Either works:
   - **The app's own playground** (Ticket 16) — expand the **GraphiQL** card at
     the bottom of the dashboard. Its example buttons load the exact queries
     behind each section, so most checks below are one click plus Run.
   - The platform's GraphiQL at
     `https://platform.zone01.gr/api/graphql-engine/v1/graphql`, logged in as
     the same user — use this to confirm the app isn't validating itself.
3. For each check below, run the query, compute the expected value, and compare
   it with the value on the dashboard. Tick the box when they match.

All queries are scoped to the logged-in user automatically — the JWT decides
which rows Hasura returns, so no user id filter is needed.

> **XP formatting.** The platform stores XP in bytes; the UI renders it with
> `formatXp()` — `MB` (÷1 000 000, 2dp) at ≥1 000 000, `kB` (÷1 000, 2dp) at
> ≥1 000, otherwise raw bytes. So GraphiQL's raw sum of `1234567` displays as
> `1.23 MB`. Compare after applying the same conversion.

---

## Check 1 — Section 1: User identification (T5)

**UI:** "User" card → *Login*, *User ID*.

```graphql
{ user { id login } }
```

- [ ] `login` in GraphiQL == *Login* on the dashboard
- [ ] `id` in GraphiQL == *User ID* on the dashboard

---

## Check 2 — Section 2: Total XP (T6)

**UI:** "XP" card → *Total XP*.

```graphql
{
  transaction(where: {
    type: { _eq: "xp" }
    path: { _like: "/athens/div-01/%" }
  }) { amount }
}
```

Expected value = **sum of every `amount`**, then byte-formatted.

> **Why the `path` filter.** Transactions carry the event they belong to in
> `path`: `/athens/div-01/...` for the main cursus, `/athens/piscine-go/...`,
> `/athens/piscine-rust/...`, `/athens/piscine-js/...` and
> `/athens/piscine-data-ai/...` for the Piscines. The platform's own profile
> page counts only the cursus toward Total XP. Dropping the filter sums the
> Piscines in too and roughly doubles the figure, so the dashboard scopes every
> XP query the same way (`CURSUS_PATH` in `js/config.js`).

- [ ] Sum of `amount` (formatted) == *Total XP* on the dashboard
- [ ] The figure matches *Total XP* on the platform's own profile page
- [ ] The result set contains only `xp` rows — no `level` / `up` / `down` noise
      (sanity check: run `{ transaction { type } }` and confirm the filtered
      query returns strictly fewer rows)
- [ ] Removing the `path` clause returns strictly MORE rows (the Piscine XP the
      dashboard deliberately excludes); confirm the extra rows' paths all start
      `/athens/piscine-`

---

## Check 3 — Section 3: Audit ratio (T7)

**UI:** "Audit ratio" card → *Done*, *Received*, *Ratio*.

```graphql
{ transaction(where: { type: { _in: ["up", "down"] } }) { type amount } }
```

Expected values:

| UI field   | Computed from GraphiQL                     |
| ---------- | ------------------------------------------ |
| *Done*     | sum of `amount` where `type == "up"`       |
| *Received* | sum of `amount` where `type == "down"`     |
| *Ratio*    | `Done / Received`, rounded to **1 decimal** |

- [ ] *Done* matches sum(up), byte-formatted
- [ ] *Received* matches sum(down), byte-formatted
- [ ] *Ratio* matches Done ÷ Received to 1dp
- [ ] *Ratio* also matches the audit ratio shown on the platform profile page

---

## Check 4 — Recent projects (nested query, T8)

**UI:** "Recent projects" card → list of `name — pass|fail`.

```graphql
{
  result(
    where: {
      path: { _like: "/athens/div-01/%" }
      object: { type: { _eq: "project" } }
    }
    order_by: { createdAt: desc }
    limit: 5
  ) {
    grade
    object { name type }
  }
}
```

- [ ] The listed names match `object.name`, in the same (newest-first) order
      (5 shown; "Show N more" reveals the rest, up to the query's `limit: 30`)
- [ ] Each item's status matches the rule `grade >= 1 → pass`, otherwise `fail`
- [ ] Every returned `object.type` is `project`
- [ ] Every returned `path` starts `/athens/div-01/` — Piscine exercises are
      excluded, matching the platform's own "Last activity" panel

---

## Check 4b — Skills breakdown (T14, bonus)

**UI:** "Skills" card → up to 6 rows of `Name` + bar + `NN%`.

```graphql
{
  transaction(
    where: { type: { _like: "skill_%" } }
    order_by: { amount: desc }
  ) {
    type
    amount
  }
}
```

Expected: for each distinct `type`, its **highest** `amount` (a skill is
re-recorded as it improves, so the max is the current level — not the sum). The
card shows the top 6 by that value.

- [x] The listed skills are the highest-scoring `skill_*` types, descending —
      19 skills, 75% down to 10%, correctly ordered with ties preserved
- [ ] Each percentage == the max `amount` for that type *(needs GraphiQL)*
- [x] Bar widths look proportional to their percentages
- [x] Names render readably — `skill_back-end` → `Back end`,
      `skill_sys-admin` → `Sys admin`
- [x] "Show 13 more" / "Show less" reveals and re-collapses the overflow

---

## Check 5 — Graph 1: cumulative XP over time (T10)

**UI:** Statistics → left graph (line chart). Click it to zoom for readable labels.

```graphql
{
  transaction(
    where: {
      type: { _eq: "xp" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: { createdAt: asc }
  ) {
    amount
    createdAt
  }
}
```

- [ ] The **Y-axis top label** equals the running total of all `amount` —
      i.e. the *same* number as *Total XP* in Check 2
- [ ] The **left X-axis label** equals the first row's `createdAt` (DD/MM/YYYY)
- [ ] The **right X-axis label** equals the last row's `createdAt` (DD/MM/YYYY)
- [x] The line only ever rises (cumulative) — confirmed on the rendered graph
      (monotonic, no dips)

---

## Check 6 — Graph 2: audit Done vs Received (T11)

**UI:** Statistics → right graph (bar chart).

Same query as Check 3 (the app runs it once and shares the totals between the
section and the graph, via `fetchAuditTotals()`).

- [ ] *Done* bar label == the *Done* value in Check 3 (same number, same format)
- [ ] *Received* bar label == the *Received* value in Check 3
- [x] Bar heights are proportional: Done/Received ≈ 0.82, matching the rendered
      bar heights

---

## Check 7 — Graph 3: XP by project (T15, bonus)

**UI:** Statistics → "XP by project" (full-width horizontal bars).

```graphql
{
  transaction(
    where: {
      type: { _eq: "xp" }
      path: { _like: "/athens/div-01/%" }
      object: { type: { _eq: "project" } }
    }
    order_by: { amount: desc }
  ) {
    amount
    objectId
    object { id name }
  }
}
```

Expected: sum `amount` **per `object.id`** (a project can pay out more than
once), then the top 8 by that total. Grouping is by ID rather than by name on
purpose: two distinct projects can carry the same display name, and rows whose
`object` is null have no name to group on — either case would merge unrelated
projects into a single bar. `objectId` is the fallback key when the nested
`object` is missing; the name is used only as the bar's label.

- [ ] The listed projects are the 8 highest XP earners, longest bar first
      ("Show N more" redraws the graph with every project)
- [ ] Each value label == that project's summed XP, byte-formatted
- [ ] Bar lengths are proportional to their values
- [ ] The listed projects all appear in the platform's own project list

---

## Cross-section consistency

These must hold within the UI alone, with no GraphiQL needed — a fast
regression check after any change:

- [x] XP graph's Y-max label == "XP" card's *Total XP* — both `2.19 MB`
- [x] Audit graph's bar labels == "Audit ratio" card's *Done* / *Received* —
      both `790.35 kB` / `968.59 kB`
- [x] *Ratio* == *Done* ÷ *Received* to 1dp — 790.35 ÷ 968.59 = 0.8159… → `0.8`

---

## Result

### Internal review — 2026-08-30

Checked against a logged-in dashboard render (user `chbaikas`, id `6844`) plus a
read of the query/render code under `js/` (then a single `js/app.js`,
since split into ES modules). **No discrepancies found.**

Values seen: Total XP `2.19 MB` · Done `790.35 kB` · Received `968.59 kB` ·
Ratio `0.8` · XP graph spanning 18/11/2024 → 25/08/2026.

Everything that can be verified without live GraphiQL access passes:

- **Ratio arithmetic** — 790.35 ÷ 968.59 = 0.8159…, rendered `0.8` at 1dp. Also
  matches the ratio on the platform profile (confirmed under T7).
- **Card ↔ graph agreement is structural, not coincidental.** The audit card
  (`loadGradesSection`) and the bar chart (`drawAuditGraph`) both read the same
  `fetchAuditTotals()` result, so the two can never drift. Total XP and the XP
  graph's Y-max come from the same `xp` query but are computed independently —
  a `reduce` over `amount` vs. the last point of the running total — so their
  agreement at `2.19 MB` is a genuine cross-check of the cumulative logic.
- **Graph shape** — the XP line is monotonically rising, as a cumulative series
  must be; the bars are proportional (0.82) to their labelled values.
- **Byte formatting** — `formatXp()` renders ≥1 000 000 as MB and ≥1 000 as kB,
  consistent across cards, bar labels and the Y-axis label.

### Remaining — needs live GraphiQL

The checks above confirm the UI is *self*-consistent. What is still open is
whether those numbers match the **source rows**. If a query had a wrong filter,
every displayed value would be equally consistent and equally wrong.

GraphiQL returns **raw bytes**, so here are the values to compare against —
already converted, so this is a comparison rather than arithmetic:

| Run this in GraphiQL | Expected raw result |
| --- | --- |
| sum of `amount` where `type = "xp"` | between **2,185,000** and **2,195,000** (displays `2.19 MB`) |
| sum of `amount` where `type = "up"` | ≈ **790,350** (displays `790.35 kB`) |
| sum of `amount` where `type = "down"` | ≈ **968,590** (displays `968.59 kB`) |
| earliest xp `createdAt` | **18/11/2024** |
| latest xp `createdAt` | **25/08/2026** |
| `790350 / 968590` | **0.816** → displays `0.8` |

Plus the non-numeric ones:

- the 5 recent project names, newest first, and their pass/fail from `grade >= 1`
- each skill's percentage == the **max** `amount` for that `skill_*` type
- the 8 project bars == XP **summed per** `object.name`

**Do this in the platform's own GraphiQL, not the app's playground.** The app
running its own queries and agreeing with itself proves nothing — the point is
to check it against an independent client.

#### One query for all the totals

Hasura can do the summing, so the three XP figures come back in a single run
with no manual arithmetic:

```graphql
{
  xp: transaction_aggregate(where: { type: { _eq: "xp" } }) {
    aggregate { sum { amount } count }
  }
  up: transaction_aggregate(where: { type: { _eq: "up" } }) {
    aggregate { sum { amount } }
  }
  down: transaction_aggregate(where: { type: { _eq: "down" } }) {
    aggregate { sum { amount } }
  }
}
```

Compare `xp.sum.amount`, `up.sum.amount` and `down.sum.amount` to the table
above. And for the two dates:

```graphql
{
  first: transaction(
    where: { type: { _eq: "xp" } }
    order_by: { createdAt: asc }
    limit: 1
  ) { createdAt }
  last: transaction(
    where: { type: { _eq: "xp" } }
    order_by: { createdAt: desc }
    limit: 1
  ) { createdAt }
}
```

If `transaction_aggregate` is not exposed on this platform, fall back to the
plain queries in Checks 2 and 3 and sum the rows yourself.

Ticket 13 passes when every box above is ticked with no discrepancy.
