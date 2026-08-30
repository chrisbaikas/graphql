# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this project is

A Zone01 school project: a personal **GraphQL profile page**. It logs the user
into the Zone01 platform (JWT via Basic auth), queries the user's own data from
the platform's GraphQL endpoint, and renders profile sections plus SVG
statistics graphs. The end goal is to **pass the audit** in
[docs/audit-readme.md](docs/audit-readme.md).

Read these before making changes:
- [docs/instructions.md](docs/instructions.md) — official project requirements
- [docs/audit-readme.md](docs/audit-readme.md) — the exact audit checklist
- [docs/ticket-tracker.md](docs/ticket-tracker.md) — work plan; each ticket maps
  to audit criteria. Keep statuses/checkboxes updated as you complete work.
- [docs/data-verification.md](docs/data-verification.md) — the GraphiQL
  cross-check procedure (Ticket 13): every displayed value paired with the query
  that proves it. Run it before an audit and after changing any query.

## Tech stack & constraints

- **Vanilla HTML + CSS + JavaScript only.** No frameworks, no build step, no npm
  dependencies. Do not introduce React/Vue/bundlers/TypeScript.
- Graphs **must** be hand-drawn **SVG** — not `<canvas>`, not images, not a
  charting library (audit requirement).
- Keep it a static site so it can be hosted on GitHub Pages / Netlify with no
  build.

## Layout

```
index.html          # login view (#login-view) + dashboard view (#dashboard-view)
css/style.css       # styles (one file on purpose — see below)
js/
  main.js           # ENTRY POINT: wiring + routing, nothing else
  config.js         # DOMAIN/URLs, display constants, localStorage key
  playground.js     # the in-app GraphiQL card
  core/
    auth.js         # login(), logout(), cleanToken()
    graphql.js      # graphqlRequest() — the ONLY dashboard GraphQL transport
    jwt.js          # decodeJwtPayload(), isTokenExpired()
    session.js      # session-end hook + SilentError (breaks the import cycle)
  data/
    queries.js      # every GraphQL query string, named
    profile.js      # fetch layer: returns plain data, touches no DOM
  sections/         # one module per dashboard card; data in, DOM out
    user.js xp.js audit.js recent.js skills.js stats.js
  charts/
    svg.js          # hand-written SVG primitives + shared geometry
    xpGraph.js auditGraph.js projectsGraph.js
  ui/
    views.js        # showLogin/showDashboard/loadProfile/resetProfile
    errors.js       # showError, reportSectionError, clearDashboardError
    collapsible.js  # generic "top N + Show more" behaviour
    modal.js        # graph zoom lightbox
    sections.js     # expand/collapse all cards
    format.js       # formatXp, formatDate, formatSkillName, truncate
Makefile            # `make run` -> python3 -m http.server
docs/               # instructions, audit criteria, ticket tracker
.github/prompts/    # self-audit prompt
```

### Architecture rules

- **`js/main.js` is the only entry point**, loaded as `<script type="module">`.
  It does wiring and routing and nothing else.
- **Fetching and rendering are separate layers.** `data/profile.js` returns
  plain objects and never touches the DOM; `sections/` and `charts/` take those
  objects and render. Add a new query to `data/queries.js` and a fetcher to
  `data/profile.js` — never `fetch` from a render module.
- **`data/profile.js` caches per load**, so sections that share rows cost one
  request between them (the XP card and XP graph share one query; the audit card
  and audit graph share another). `clearProfileCache()` runs on every load and
  on logout, so no data crosses sessions.
- **`core/session.js` exists to break an import cycle**: `graphql.js` must end
  the session, but importing `auth.js` would close the loop
  `graphql -> auth -> views -> sections -> graphql`. `main.js` registers
  `logout` there once at start-up.
- **`css/style.css` stays one file.** Splitting it means extra `<link>` requests
  or serialised `@import`s, and there is no build step to concatenate.

## Run / verify

```bash
make run          # serves on http://localhost:8042 (override: make run PORT=9000)
```

**Must be served over HTTP.** This is now a hard requirement, not a caution:
the app loads as ES modules, which browsers fetch under CORS rules, so
`file://` fails outright rather than partially.

There are no automated tests; verify by running the server and checking
behaviour in the browser + DevTools network tab. After editing JS, sanity-check
syntax — note `node --check` needs the module flag for these files:

```bash
for f in $(find js -name '*.js'); do cp "$f" /tmp/c.mjs && node --check /tmp/c.mjs || echo "FAIL $f"; done
```

## Key facts in code

- Platform domain lives in one place: `DOMAIN` in [js/config.js](js/config.js).
  `SIGNIN_URL` and `GRAPHQL_URL` are derived from it — do not hardcode URLs
  elsewhere. The `localStorage` key is `TOKEN_KEY` in the same file.
- Auth: `POST` to `SIGNIN_URL` with `Authorization: Basic base64(identifier:password)`.
  Login must accept **both** `username:password` and `email:password`.
- The returned JWT may come back wrapped in quotes — trim them before use.
- GraphQL requests use `Authorization: Bearer <jwt>` against `GRAPHQL_URL`.
- The JWT is stored in `localStorage` under the key `token`.

## Conventions

- Match the existing simple, dependency-free style.
- Centralise GraphQL calls in `core/graphql.js` rather than scattering `fetch`
  calls. The one deliberate exception is `playground.js`: it posts directly
  because it must SHOW a query's `errors[]` rather than throw on them.
- The app must use all three query forms — normal, nested, and with arguments
  (audit requirement; see Ticket 8). All of them live in
  [js/data/queries.js](js/data/queries.js), labelled, so the requirement can be
  checked at a glance.

## Definition of done

A change is done when the relevant ticket's acceptance criteria pass and the
corresponding audit check in [docs/audit-readme.md](docs/audit-readme.md) would
pass. Update [docs/ticket-tracker.md](docs/ticket-tracker.md) accordingly.

## Git

- Don't commit or push unless explicitly asked. If asked, branch off `main`
  first.
- Never commit credentials or a real JWT.
