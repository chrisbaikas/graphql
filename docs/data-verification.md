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
2. Open the platform's GraphiQL at
   `https://platform.zone01.gr/api/graphql-engine/v1/graphql` (use the
   platform's GraphiQL UI, logged in as the same user).
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
{ transaction(where: { type: { _eq: "xp" } }) { amount } }
```

Expected value = **sum of every `amount`**, then byte-formatted.

- [ ] Sum of `amount` (formatted) == *Total XP* on the dashboard
- [ ] The result set contains only `xp` rows — no `level` / `up` / `down` noise
      (sanity check: run `{ transaction { type } }` and confirm the filtered
      query returns strictly fewer rows)

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
    where: { object: { type: { _eq: "project" } } }
    order_by: { createdAt: desc }
    limit: 5
  ) {
    grade
    object { name type }
  }
}
```

- [ ] The 5 listed names match `object.name`, in the same (newest-first) order
- [ ] Each item's status matches the rule `grade >= 1 → pass`, otherwise `fail`
- [ ] Every returned `object.type` is `project`

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
    where: { type: { _eq: "xp" } }
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
      object: { type: { _eq: "project" } }
    }
    order_by: { amount: desc }
  ) {
    amount
    object { name }
  }
}
```

Expected: sum `amount` **per `object.name`** (a project can pay out more than
once), then the top 8 by that total.

- [ ] The listed projects are the 8 highest XP earners, longest bar first
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
read of the query/render code in `js/app.js`. **No discrepancies found.**

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

Checks 1–5 above still need a run against the platform's GraphiQL to confirm the
app's numbers match the *source* rows (not just each other):

- sum of `amount` where `type = "xp"` == `2.19 MB`
- sums of `up` / `down` == `790.35 kB` / `968.59 kB`
- the 5 recent project names and their order
- first/last `createdAt` == 18/11/2024 / 25/08/2026

Ticket 13 passes when every box above is ticked with no discrepancy.
