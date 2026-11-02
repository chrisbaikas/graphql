# Audit Queries

Run in `https://platform.zone01.gr/graphiql/`.

Expected values are **dated reference values from 2026-10-26** (account `chbaikas`).
They change as the account earns XP, so treat them as a snapshot, not fixed
results, and compare GraphiQL against the live dashboard.

- Each query returns one page. Paginate with `offset` until a page is empty.
- **Piscine filter:** the app drops rows with a `piscine` / `piscine-*` segment
  *before* the last path segment, because the Piscine roll-up already includes
  them. `/athens/div-01/piscine-go/quest-01/ex-03` is dropped;
  `/athens/div-01/piscine-go` is kept. GraphiQL cannot apply this filter, so do
  it by hand.

| Form | Queries | Arguments used |
| --- | --- | --- |
| Normal | 1 User | none |
| Nested | 2 XP, 5 Recent Projects | `object { ... }` selected inside the result |
| Arguments | 2, 3, 4, 5, 6 | `where`, `_eq`, `_like`, `_in`, `limit`, `offset`, `order_by` |

## 1. User — Normal Query

```graphql
query User {
  user {
    id
    login
  }
}
```

Expected:

```text
id: 6844
login: chbaikas
```

---

## 2. XP — Arguments + Nested Query

```graphql
query XpTransactions($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "xp" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: [
      { createdAt: asc }
      { id: asc }
    ]
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

Expected:

```text
Raw rows: 279
Rows after filter: 53
Total XP: 1,218,125 B
Displayed total: 1.22 MB
```

---

## 3. Level — Arguments Query

```graphql
query Level($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "level" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: [
      { amount: desc }
      { id: asc }
    ]
  ) {
    id
    amount
    path
  }
}
```

The app takes the **highest** amount, never the sum (levels are re-issued on each
level-up).

Expected:

```text
Raw rows: 65
Highest amount after filter: 31
```

---

## 4. Audit Ratio — Arguments Query

```graphql
query AuditTotals($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    order_by: { id: asc }
    where: {
      type: { _in: ["up", "down"] }
    }
  ) {
    id
    type
    amount
  }
}
```

Done = sum of `up`, Received = sum of `down`, ratio = Done / Received (shown to
one decimal). The audit card and audit graph use these same two totals.

Expected:

```text
Rows: 164
Done (up): 790,353 B
Received (down): 1,046,210 B
Ratio: 0.8   (0.7554... before rounding)
```

---

## 5. Recent Projects — Arguments + Nested Query

```graphql
query RecentProjects($limit: Int = 500, $offset: Int = 0) {
  result(
    limit: $limit
    offset: $offset
    where: {
      path: { _like: "/athens/div-01/%" }
      object: { type: { _eq: "project" } }
    }
    order_by: [
      { createdAt: desc }
      { id: desc }
    ]
  ) {
    id
    grade
    path
    object {
      name
      type
    }
  }
}
```

Expected:

```text
Results: 35
```

The app shows the newest 60 results after the Piscine filter; this account has fewer.

---

## 6. Skills — Arguments Query

```graphql
query Skills($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _like: "skill_%" }
    }
    order_by: [
      { amount: desc }
      { id: asc }
    ]
  ) {
    id
    type
    amount
  }
}
```

The app keeps the **highest** amount per skill type, never the sum.

Expected:

```text
Rows: 88
Skill types: 19
```

---

## 7. XP by Project

No separate query. It reuses the rows of Query 2, as do the XP card and the XP
line graph.

```text
Filter XP rows (Piscine filter)
→ group by object.id
→ sum amount per project
```

Expected:

```text
Filtered XP rows: 53
Project groups: 52
```

The XP-over-time line graph is the same 53 rows as a chronological running total.

---

## Checklist

- Wrong password → `Invalid credentials. Please try again.`
- Username login works.
- Email login works.
- Three main sections → queries **1, 2/3, 4**.
- Statistics = fourth section.
- XP over time = SVG line graph.
- Audit ratio = SVG vertical bar graph.
- XP by project = SVG horizontal bar graph.
- Hosted at `https://chrisbaikas.github.io/graphql/`
- Logout removes JWT and returns to login.
- Bonus: Skills.
- Bonus: Recent Projects.
- Bonus: XP by Project.
- Bonus: In-app GraphiQL.