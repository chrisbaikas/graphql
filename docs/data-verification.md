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
- [ ] The line only ever rises (cumulative) and its steepest jumps line up with
      the largest `amount` values in the result set

---

## Check 6 — Graph 2: audit Done vs Received (T11)

**UI:** Statistics → right graph (bar chart).

Same query as Check 3 (the app runs it once and shares the totals between the
section and the graph, via `fetchAuditTotals()`).

- [ ] *Done* bar label == the *Done* value in Check 3 (same number, same format)
- [ ] *Received* bar label == the *Received* value in Check 3
- [ ] Bar heights are proportional: the shorter bar's height ÷ the taller bar's
      height ≈ the ratio of their values

---

## Cross-section consistency

These must hold within the UI alone, with no GraphiQL needed — a fast
regression check after any change:

- [ ] XP graph's Y-max label == "XP" card's *Total XP*
- [ ] Audit graph's bar labels == "Audit ratio" card's *Done* / *Received*
- [ ] *Ratio* == *Done* ÷ *Received* to 1dp

---

## Result

- **Verified on:** _(date)_
- **Verified by:** _(name)_
- **Discrepancies found:** _(none / list them)_

Ticket 13 passes when every box above is ticked with no discrepancy.
