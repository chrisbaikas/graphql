# Data Accuracy Verification (Ticket 13)

Last reviewed: **2026-10-26**. **T13 DONE**: the deployed application was compared
with the same account in the platform's own GraphiQL. All required values match;
see the dated results below. These figures are a dated observation, not fixed
expected values for future accounts or activity.

## Procedure

1. Open the live site (or `make run`) and log in with your own Zone01 account.
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

- [x] Confirm the account's main cursus really uses `/athens/div-01`. The
      requirements do not mandate the Athens path; the configured scope came
      from the earlier platform XP-board comparison (commit `3ea3afa`). USER
      currently returns only `id` and `login`; the other queries already filter
      XP, level and recent results by the configured root. These responses cannot
      deterministically discover another account's main cursus. Keep this
      configuration until live event/schema evidence supports a different rule;
      an empty filtered result alone does not establish that the account has no XP.
- [x] Confirm the platform's row permissions return only the authenticated user's
      data. Compare USER identity with the current account; inspect `userId` on
      the same transaction/result rows in the platform GraphiQL. Group results
      can have null `userId`; verify current-user membership through
      `group { members(where: {userId: {_eq: $userId}}) { userId } }` instead.
      Production queries rely on server permissions rather than an explicit
      user-ID filter.
      Do not query arbitrary other users as a substitute for permission evidence.
- [x] Inspect the real output scalar types and JSON representations: `user.id`,
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
grades determine pass/fail; null/non-numeric grades display pending. Authenticated
introspection confirmed `Int` IDs, `numeric` amounts/grades and `timestamptz`
dates. Actual IDs, amounts and grades were JSON numbers; dates were strings.
No numeric-string normalization is needed. The earlier anonymous metadata query
did not expose these types; the authenticated check supersedes that uncertainty.
The platform's own Module stats, transaction paths and matching totals establish
the configured cursus for this account, without inferring it from membership alone.

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

- [x] Login and User ID match the response.

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

- [x] Sum of kept `amount` values, formatted as above, equals Total XP.
- [x] Number of kept rows equals Transactions.
- [x] History shows those same rows newest first, with names from `object.name`
      (path slug fallback when no object), and correct XP per row.
- [x] Show more / Show less reveals and re-collapses all history rows.
- [x] Total and history agree with the platform's XP board.
- [x] Graph's point values are the running sums of kept rows, oldest first.
- [x] Final point tooltip equals Total XP; first/last dates match the kept rows.
- [x] Y-axis maximum is the maximum running total (including zero), which can
      exceed the final total if there are negative corrections. Negative running
      totals fit the graph too. A rise is expected only for positive XP rows.
- Conditional regression case: fewer than two kept rows. Not present in this
  account (53 kept rows); covered by the synthetic empty/single-row suites.

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

- [x] Apply the same path rule as Check 2. Maximum kept `amount` equals Current
      level; no rows displays `—`. Do not sum level transactions or limit the
      response before filtering.
- [x] Level agrees with the platform's main cursus level.

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

- [x] Done equals sum of `up`; Received equals sum of `down`, byte-formatted.
- [x] Ratio equals Done / Received to one decimal, or `—` when Received is zero.
- [x] Figures agree with the platform profile. Audit totals span all paths.
- [x] Audit graph labels match the card; bar heights have the same proportion.
- Conditional regression case: both totals zero. Not present in this account;
  covered by the synthetic empty-data suite.

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

- [x] Names and ordering match kept `object.name` values, newest first.
- [x] Numeric `grade >= 1` displays pass; lower numeric grades display fail.
      A missing/non-numeric grade displays pending.
- [x] Only project objects under the cursus are shown; nested Piscine rows are
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

- [x] Each percentage equals the maximum `amount` for that transaction type.
- [x] Skills are sorted descending, with six initially visible.
- [x] Names are readable (`skill_back-end` → Back end), bars are proportional
      (width capped to 0–100%), and Show more reveals the remaining skills.
- Conditional regression case: no skills. Not present in this account (19 skill
  types); covered by the synthetic empty-data suite.

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

- [x] Groups are sorted by total XP descending; eight appear initially.
- [x] Each label/tooltip and proportional bar matches its group's total.
- Conditional regression case: different objects sharing a name. Not present
  among this account's 52 XP groups; covered by the Node data regressions.
- [x] Show more reveals all groups; the sum of **all** bars equals Total XP.
- Conditional regression case: no kept XP. Not present in this account;
  covered by the synthetic empty-data suite.

## Session and browser checks before audit

For reproducible synthetic regressions, see [browser-verification.md](browser-verification.md).
They do not replace the real-account checkboxes below.

- [x] Valid username/password and email/password both reach the dashboard.
- [x] Wrong password shows Invalid credentials and stays on login.
- [x] Refresh preserves the session; `sessionStorage.token` has no wrapper quotes.
- [x] Logout clears token, cards, lists, graphs, zoom overlay and playground.
- [x] An expired saved-session fixture and a fabricated invalid-signature
      credential rejected by the real endpoint both return to login, clear
      storage and show a readable explanation. No real credential was revoked.
- Regression-only case: late requests across different accounts. Verified by
  the synthetic race suite; no second real account was used in this live pass.
- [x] A new independent tab has its own login; logout affects the current tab.
      Refresh in the same tab preserves its unexpired session.
- [x] Dashboard requests contain six query definitions: User, XP, Level, Audits,
      RecentProjects and Skills. Each list is paginated, including a terminal
      empty page (unless RecentProjects already has 60 kept rows). Small nonempty
      datasets need 11 POSTs; larger datasets need more. XP and audit consumers
      share promises. Playground requests are additional.
- [x] Keyboard zoom / Escape / focus return and Show more controls work.
- [x] Loaded graphs support Enter and Space. Empty/error/loading placeholder
      semantics are covered by the synthetic browser suite; this account renders
      three graphs, and logout resets them to placeholders.
- [x] Chart and modal labels remain readable at 320/375/768/1280/1920px, with
      no clipped labels or page overflow. Reduced-motion dots appear immediately.
- [x] At 320/375px and desktop widths, content fits without horizontal overflow.
- [x] Playground runs valid queries, displays malformed-query errors, rejects
      invalid/non-object variables, and supports Ctrl/Cmd+Enter.

## Verification record

| Date | Environment | Result |
| --- | --- | --- |
| 2026-10-22 | Local Chromium, intercepted synthetic API responses | Eleven scenario groups: initial/login failures/success, UTF-8 credentials, server/network/query errors, timeout recovery (shortened test budget), paginated totals, three SVGs, empty/single/negative/zero/large/Unicode datasets, modal keyboard/inert/focus cleanup, A→B and pending-request races, playground envelope/variables/shortcuts, refresh and simulated project-subpath hosting. Widths 320/360/560/1280px. No unexpected console errors, CSP violations or missing local assets. A real streamed body timeout was also verified against a temporary local HTTP server. This does not prove live schema, real source data or platform CORS. |
| 2026-10-22, independent-audit fixes | Chromium + Firefox, committed `tests/browser/run.cjs` | All 14 scenario groups pass, including the original eleven, responsive chart/modal labels at 320/375/768/1280/1920px, placeholder semantics, focus/reset, reduced motion and real streamed body timeout. Synthetic responses still do not close T13. |
| 2026-10-26 | Real Zone01 account + independent platform GraphiQL | Required comparisons complete; all MATCH. See the detailed record below. |
| 2026-10-26 | Final regression after real-account pass | `make test` and `make check`: 123/123 tests; 14/14 synthetic browser groups in each of Chromium and Firefox. No production code changes. |
| 2026-10-26, initial deployment | Public HTTPS deployment, Chromium + Firefox | https://chrisbaikas.github.io/graphql-profile/ serves `main / root`. Login assets/modules, invalid credentials, CORS preflights/rejection responses, unauthenticated reload and login layout passed. These initial checks alone did not verify authenticated data or complete T12. |
| 2026-10-26, initial deployment | Real-account availability | Initially unavailable. Superseded by the subsequent manual browser logins and authenticated results below. |

## Live account results — 2026-10-26

Environment: visible Chromium, deployed GitHub Pages app and the platform's
own `https://platform.zone01.gr/graphiql/`. The user entered all real credentials
manually in the browser. No passwords, session credentials or headers were
exported or recorded. Queries ran through the platform GraphiQL editor/Execute
button; source responses were compared in memory with the live DOM/SVG.

| Check | Independent source evidence | Result |
| --- | --- | --- |
| Identity | `user` returned ID 6844, login `chbaikas`; exact dashboard match | MATCH |
| Cursus | Platform Module stats route `/intra/athens/div-01` showed level 31 and 1.22 MB XP. Unfiltered transactions contained 279 XP rows under `/athens/div-01` and 116 under `/athens/piscine-go` | MATCH |
| Scope/permissions | All 737 unfiltered transactions had `userId = 6844`. All 35 recent results had nullable `userId` unset and a group membership for user 6844. No unrelated user's records were requested | MATCH |
| JSON/scalars | `user.id`, row IDs and object IDs: `Int` / JSON number. XP/level/audit/skill amounts and result grades: `numeric` / JSON number. `createdAt`: `timestamptz` / JSON string | MATCH; strict validation retained |
| XP | 279 raw cursus rows, 226 nested Piscine rows excluded, 53 kept; sum **1,218,125 B**, displayed **1.22 MB**. The 116 out-of-cursus XP rows were excluded. All history names, amounts and ordering match | MATCH |
| XP progression | All 53 polyline coordinates match independent running sums and timestamps; final sum 1,218,125 B. Date range 2025-01-20 through 2026-09-02, matching first/last labels and final tooltip | MATCH |
| Level | Maximum kept level from 65 raw rows is **31**, matching the app and platform Module | MATCH |
| Audits | 164 rows: Done **790,353 B**, Received **1,046,210 B**; exact ratio 0.7554439357299204, displayed **0.8**. The platform also shows 0.8. Graph labels and bar-height ratio match | MATCH |
| Skills | 88 rows reduced to **19** maximum-per-type values. Every displayed name/value, descending order and bar width matches; Show more reveals 6 → 19 | MATCH |
| Recent projects | All **35** results match names, ordering, numeric grades and pass/fail labels; Show more reveals 5 → 35 | MATCH |
| XP by project | **52** groups keyed by object ID. All expanded bar titles match independently summed amounts; their total equals 1,218,125 B. Show more reveals 8 → 52 | MATCH |
| Query forms | The actual dashboard generated normal User, nested object and argument queries, six definitions and 11 POSTs for this account | MATCH |
| Custom GraphiQL | User/XP/Audit envelopes equal platform GraphiQL results. Malformed query errors remain visible; invalid/non-object variables send no request; valid variables, every example, timing/status and Ctrl/Cmd+Enter pass. Logout resets query, variables, result and status | MATCH |

Platform GraphiQL pagination, including terminal empty pages:

| Query | Offset → returned rows |
| --- | --- |
| XP | 0 → 279; 279 → 0 |
| Audits | 0 → 164; 164 → 0 |
| Skills | 0 → 88; 88 → 0 |
| Recent projects | 0 → 35; 35 → 0 |
| Level | 0 → 65; 65 → 0 |
| Unfiltered transaction scope | 0 → 500; 500 → 237; 737 → 0 |

Transaction and result IDs were unique across pages. The live dataset had no
negative kept XP, zero audit denominator, empty cards or duplicate XP group
names; those conditional cases remain regression fixtures, not claimed live
observations. No data mismatch or production fix was required.

Hosted username and email login both returned HTTP 200. Same-tab refresh,
independent-tab isolation, logout/storage/data cleanup, keyboard/mouse zoom,
Escape/focus return and reduced motion passed. At 320/375/768/1280/1920px, all
chart/modal text stayed inside its SVG and at least 10.8px effective font size,
with no page overflow. Final authenticated refresh, user query and logout passed.

T13 is complete: all applicable live-data comparisons above passed.
