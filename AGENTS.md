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
index.html        # login view (#login-view) + dashboard view (#dashboard-view)
css/style.css     # styles
js/app.js         # config, auth, GraphQL, rendering
Makefile          # `make run` -> python3 -m http.server
docs/             # instructions, audit criteria, ticket tracker
.github/prompts/  # self-audit prompt
```

## Run / verify

```bash
make run          # serves on http://localhost:8000 (override: make run PORT=9000)
```

Must be served over HTTP — opening `index.html` via `file://` breaks `fetch`
(CORS). There are no automated tests; verify by running the server and checking
behaviour in the browser + DevTools network tab. After editing JS, sanity-check
syntax with `node --check js/app.js`.

## Key facts in code

- Platform domain lives in one place: `DOMAIN` in [js/app.js](js/app.js).
  `SIGNIN_URL` and `GRAPHQL_URL` are derived from it — do not hardcode URLs
  elsewhere.
- Auth: `POST` to `SIGNIN_URL` with `Authorization: Basic base64(identifier:password)`.
  Login must accept **both** `username:password` and `email:password`.
- The returned JWT may come back wrapped in quotes — trim them before use.
- GraphQL requests use `Authorization: Bearer <jwt>` against `GRAPHQL_URL`.
- The JWT is stored in `localStorage` under the key `token`.

## Conventions

- Match the existing simple, dependency-free style in `js/app.js`.
- Centralise GraphQL calls in one helper (see Ticket 4) rather than scattering
  `fetch` calls.
- The app must use all three query forms — normal, nested, and with arguments
  (audit requirement; see Ticket 8).

## Definition of done

A change is done when the relevant ticket's acceptance criteria pass and the
corresponding audit check in [docs/audit-readme.md](docs/audit-readme.md) would
pass. Update [docs/ticket-tracker.md](docs/ticket-tracker.md) accordingly.

## Git

- Don't commit or push unless explicitly asked. If asked, branch off `main`
  first.
- Never commit credentials or a real JWT.
