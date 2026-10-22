# Data Accuracy Verification (Ticket 13)

Last reviewed: **2026-10-22**. Code and browser checks with synthetic data pass;
**live GraphiQL verification remains open**. No real account was used for this
review. Do not treat old account totals as expected values for today's data.

## Procedure

1. Run `make run` and log in with your own Zone01 account.
2. Open the platform's GraphiQL at `https://platform.zone01.gr/graphiql/`,
   authenticated as the same user. The app's playground helps inspect queries,
   but final verification must use an independent client.
3. Run the queries below. They mirror `js/data/queries.js`; if `CURSUS_ROOT`
   changes in `js/config.js`, replace `/athens/div-01` here too.
4. Record date, browser, and discrepancies below. Never record a password or JWT.

The JWT scopes rows to the authenticated user. Confirm that `{ user { id login } }`
returns your identity before comparing data. XP uses decimal units:
`1234567` bytes → `1.23 MB`, `12345` → `12.35 kB`, values below 1000 → bytes.
Dates display as DD/MM/YYYY in the browser's local timezone.

## Platform assumptions to verify before closing T13

- [ ] Confirm the account's main cursus really uses `/athens/div-01`. The
      requirements do not mandate the Athens path; the configured scope came
      from the earlier platform XP-board comparison (commit `3ea3afa`). USER
      currently returns only `id` and `login`; the other queries already filter
      XP, level and recent results by the configured root. These responses cannot
      deterministically discover another account's main cursus. Keep this
      configuration until live event/schema evidence supports a different rule;
      an empty filtered result alone does not establish that the account has no XP.
- [ ] Confirm the platform's row permissions return only the authenticated user's
      data. Compare USER identity with the current account; inspect `userId` on
      the same transaction/result rows in the platform GraphiQL. Production
      queries rely on server permissions rather than an explicit user-ID filter.
      Do not query arbitrary other users as a substitute for permission evidence.
- [ ] Inspect the real output scalar types and JSON representations: `user.id`,
      `transaction.id`, `transaction.objectId`, `transaction.amount`, `object.id`,
      `result.id` and `result.grade`. Include XP, level, skills and up/down audit
      transactions. The query variables' `Int` declarations describe inputs and
      do not prove output types. Record scalar names and `typeof` values without
      recording any token or password.

Use the authenticated schema explorer, or the metadata query below if
introspection is enabled. If a type name differs, inspect the actual return type
in the explorer. A denied introspection query leaves this check open.

```graphql
query AuditOutputTypes {
  userType: __type(name: "user") {
    fields { name type { kind name ofType { kind name } } }
  }
  transactionType: __type(name: "transaction") {
    fields { name type { kind name ofType { kind name } } }
  }
  resultType: __type(name: "result") {
    fields { name type { kind name ofType { kind name } } }
  }
  objectType: __type(name: "object") {
    fields { name type { kind name ofType { kind name } } }
  }
}
```

Strict validation is unchanged: paginated row/user IDs must be integer numbers;
transaction amounts must be finite numbers (`null` contributes zero). Numeric
grades determine pass/fail; null/non-numeric grades display pending. No schema
snapshot or authenticated session was available in this review, and the linked
platform GraphiQL page could not be retrieved by the browsing tool. An anonymous
metadata POST returned HTTP 200 with `data.__type: null` for `transaction`; this
does not reveal the authenticated role's output types. The
[official database description](https://github.com/01-edu/public/blob/master/docs/db/database-structure.md)
lists fields without specifying their GraphQL scalar serialization. It also
describes users belonging to multiple events, so event membership alone does not
select a main cursus. The requirements' numeric examples support the current
assumption but do not prove this platform's serialization. Do not add permissive
string coercion without evidence from the real schema and response bodies.

## Pagination

All list queries below have `$limit` / `$offset` variables with defaults 500/0.
Run the first page, then repeat with `{ "offset": N, "limit": 500 }`, where N
is the **number of raw rows already received**, until an empty page is returned.
Do not stop just because a page contains fewer than 500 rows: the platform can
cap page size. Combine pages before applying the filters/calculations below.
Stable row IDs break ordering ties. If data changes during loading and repeats
an ID, the app reports an error instead of double-counting; repeat the check
with stable source data. These requests are not an atomic database snapshot.

The JWT lives only in sessionStorage; tabs have independent sessions. Startup,
login and logout delete the former localStorage credential without migrating it.

## 1. User (T5)

```graphql
{ user { id login } }
```

- [ ] Login and User ID match the response.

## 2. XP total, history and cumulative graph (T6/T10)

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

Apply the app's `isCursusPath()` rule before computing totals: keep rows under
`/athens/div-01/`, excluding rows with a `piscine` or `piscine-*` segment
**before the last path segment**. A Piscine roll-up itself is kept; its nested
exercises are excluded to avoid double counting. Exam folders remain included
regardless of their names. Verify this scope against the platform's XP board.

- [ ] Sum of kept `amount` values, formatted as above, equals Total XP.
- [ ] Number of kept rows equals Transactions.
- [ ] History shows those same rows newest first, with names from `object.name`
      (path slug fallback when no object), and correct XP per row.
- [ ] Show more / Show less reveals and re-collapses all history rows.
- [ ] Total and history agree with the platform's XP board.
- [ ] Graph's point values are the running sums of kept rows, oldest first.
- [ ] Final point tooltip equals Total XP; first/last dates match the kept rows.
- [ ] Y-axis maximum is the maximum running total (including zero), which can
      exceed the final total if there are negative corrections. Negative running
      totals fit the graph too. A rise is expected only for positive XP rows.
- [ ] Fewer than two kept rows shows the insufficient-data placeholder.

Do not use an unfiltered `transaction_aggregate(type: "xp")` to verify this
figure: it includes other cursus paths and double-counted Piscine exercises.

## 2b. Current level

```graphql
query Level($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: {
      type: { _eq: "level" }
      path: { _like: "/athens/div-01/%" }
    }
    order_by: [{ amount: desc }, { id: asc }]
  ) {
    id
    amount
    path
  }
}
```

- [ ] Apply the same path rule as Check 2. Maximum kept `amount` equals Current
      level; no rows displays `—`. Do not sum level transactions or limit the
      response before filtering.
- [ ] Level agrees with the platform's main cursus level.

## 3. Audit card and bars (T7/T11)

```graphql
query AuditTotals($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    order_by: { id: asc }
    where: { type: { _in: ["up", "down"] } }) { id type amount }
}
```

- [ ] Done equals sum of `up`; Received equals sum of `down`, byte-formatted.
- [ ] Ratio equals Done / Received to one decimal, or `—` when Received is zero.
- [ ] Figures agree with the platform profile. Audit totals span all paths.
- [ ] Audit graph labels match the card; bar heights have the same proportion.
- [ ] Both totals zero shows the empty-data placeholder.

## 4. Recent projects (T8)

```graphql
query RecentProjects($limit: Int = 500, $offset: Int = 0) {
  result(
    limit: $limit
    offset: $offset
    where: {
      path: { _like: "/athens/div-01/%" }
      object: { type: { _eq: "project" } }
    }
    order_by: [{ createdAt: desc }, { id: desc }]
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

Read pages until there are 60 results passing the same path rule as Check 2,
or the server returns an empty page. Keep the latest 60 **after** filtering.
The app shows five initially; Show more reveals the remaining kept results.
This is recent activity, not a complete project archive.

- [ ] Names and ordering match kept `object.name` values, newest first.
- [ ] Numeric `grade >= 1` displays pass; lower numeric grades display fail.
      A missing/non-numeric grade displays pending.
- [ ] Only project objects under the cursus are shown; nested Piscine rows are
      excluded. No kept results shows No projects yet.

## 4b. Skills (T14, bonus)

```graphql
query Skills($limit: Int = 500, $offset: Int = 0) {
  transaction(
    limit: $limit
    offset: $offset
    where: { type: { _like: "skill_%" } }
    order_by: [{ amount: desc }, { id: asc }]
  ) {
    id
    type
    amount
  }
}
```

- [ ] Each percentage equals the maximum `amount` for that transaction type.
- [ ] Skills are sorted descending, with six initially visible.
- [ ] Names are readable (`skill_back-end` → Back end), bars are proportional
      (width capped to 0–100%), and Show more reveals the remaining skills.
- [ ] No rows displays No skill data available.

## 5. XP by project (T15, bonus)

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

Apply the same path rule as Check 2. Group by `object.id`, falling back to
`objectId`; sum each group's `amount`. Names are labels, **not grouping keys**.
Rows with neither object ID stay separate. Transaction IDs still identify pages.
This graph includes Piscine roll-ups and
exam XP so it covers the same rows as Total XP despite its short title.
It uses the same cached XP rows, without another query or a different snapshot.

- [ ] Groups are sorted by total XP descending; eight appear initially.
- [ ] Each label/tooltip and proportional bar matches its group's total.
- [ ] Different objects with the same name remain separate bars.
- [ ] Show more reveals all groups; the sum of **all** bars equals Total XP.
- [ ] No kept rows displays No project XP yet.

## Session and browser checks before audit

For reproducible synthetic regressions, see [browser-verification.md](browser-verification.md).
They do not replace the real-account checkboxes below.

- [ ] Valid username/password and email/password both reach the dashboard.
- [ ] Wrong password shows Invalid credentials and stays on login.
- [ ] Refresh preserves the session; `sessionStorage.token` has no wrapper quotes.
- [ ] Logout clears token, cards, lists, graphs, zoom overlay and playground.
- [ ] Expired/revoked token returns to login with a readable explanation.
- [ ] Late requests from a previous session cannot render or end a new session.
- [ ] A new independent tab has its own login; logout affects the current tab.
      Refresh in the same tab preserves its unexpired session.
- [ ] Dashboard requests contain six query definitions: User, XP, Level, Audits,
      RecentProjects and Skills. Each list is paginated, including a terminal
      empty page (unless RecentProjects already has 60 kept rows). Small nonempty
      datasets need 11 POSTs; larger datasets need more. XP and audit consumers
      share promises. Playground requests are additional.
- [ ] Keyboard zoom / Escape / focus return and Show more controls work.
- [ ] Only rendered graphs have zoom button semantics and Tab stops; loading,
      empty and error placeholders do not. Check Enter and Space on loaded charts.
- [ ] Chart and modal labels remain readable at 320/375/768/1280/1920px, with
      no clipped labels or page overflow. Reduced-motion dots appear immediately.
- [ ] At 360px and desktop widths, content fits without horizontal overflow.
- [ ] Playground runs valid queries, displays malformed-query errors, rejects
      invalid/non-object variables, and supports Ctrl/Cmd+Enter.

## Verification record

| Date | Environment | Result |
| --- | --- | --- |
| 2026-10-22 | Local Chromium, intercepted synthetic API responses | Eleven scenario groups: initial/login failures/success, UTF-8 credentials, server/network/query errors, timeout recovery (shortened test budget), paginated totals, three SVGs, empty/single/negative/zero/large/Unicode datasets, modal keyboard/inert/focus cleanup, A→B and pending-request races, playground envelope/variables/shortcuts, refresh and simulated project-subpath hosting. Widths 320/360/560/1280px. No unexpected console errors, CSP violations or missing local assets. A real streamed body timeout was also verified against a temporary local HTTP server. This does not prove live schema, real source data or platform CORS. |
| 2026-10-22, independent-audit fixes | Chromium + Firefox, committed `tests/browser/run.cjs` | All 14 scenario groups pass, including the original eleven, responsive chart/modal labels at 320/375/768/1280/1920px, placeholder semantics, focus/reset, reduced motion and real streamed body timeout. Synthetic responses still do not close T13. |
| Pending | Real Zone01 account + independent platform GraphiQL | Complete all live checks above, then update T13. |
| Pending | Public HTTPS deployment | Complete T12 and record the URL in README.md. |

T13 is complete only after the source-row comparisons pass with a real account.
