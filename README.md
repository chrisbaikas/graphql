# GraphQL Profile

A personal profile page for the Zone01 platform. It authenticates against the
platform (JWT), queries the logged-in user's own data from the GraphQL
endpoint, and displays it as profile sections plus SVG statistics graphs.

- **Platform:** `platform.zone01.gr`
- **Live URL:** https://chrisbaikas.github.io/graphql-profile/
- **GitHub repository:** https://github.com/chrisbaikas/graphql-profile

## Tech

Plain static site — HTML + CSS + vanilla JavaScript, organised as ES modules
that the browser loads natively. No build step, no dependencies, no framework.

```
index.html        # login + dashboard views
css/style.css     # styles
js/
  main.js         # entry point: wiring + routing
  config.js       # domain, derived URLs, display constants
  core/           # auth, GraphQL transport, JWT, token storage, fetch timeout
  data/           # query strings + the fetch layer (no DOM)
  sections/       # one module per dashboard card (no fetching)
  charts/         # hand-written SVG primitives + the three graphs
  ui/             # views, errors, collapsible lists, modal, formatting
  playground.js   # in-app GraphiQL
tests/            # node:test helper, data and transport regressions
docs/             # project instructions, audit criteria, ticket tracker
```

## Run locally

The app uses `fetch` against the platform API and loads as ES modules, so it
must be served over HTTP (opening `index.html` with `file://` breaks both).
Use any static server:

```bash
# Recommended — uses the Makefile (Python, no dependencies)
make run
# then open http://localhost:8042
# change the port with: make run PORT=9000

# Equivalent without make:
python3 -m http.server 8042

# or Node
npx serve .
```

In VS Code you can also use the **Live Server** extension.

## Tests

Tests cover formatting, JWT parsing/expiry, Basic auth, fetch timeouts,
data transformations and GraphQL session isolation. They use Node's built-in test
runner, so there is nothing to install:

```bash
make test
make check  # tests + module syntax
# or directly:
node --test tests/*.test.js
```

Optional Chromium/Firefox regressions: `make test-browser`, using Playwright
installed outside the repository. See [browser verification](docs/browser-verification.md)
for exact setup, commands and the 14 covered scenario groups.

Requires Node 22.7 or newer for native ES module detection without package
metadata. The tests import the same modules the browser loads and stub API
responses; they do not contact the platform or require credentials.

Current audit status and remaining hosting/live-account checks are in the
[ticket tracker](docs/ticket-tracker.md#where-the-project-stands-2026-10-26).

## Sessions and data scope

JWTs are stored only in `sessionStorage` under `token`. Reload in the same tab
preserves an unexpired session; independent tabs have their own login/logout.
An old `localStorage.token` is deleted at startup/login/logout, never migrated.
Passwords are cleared on successful login and logout. Blocked storage produces
a visible login error.

The dashboard targets the Athens main cursus (`CURSUS_ROOT` in `js/config.js`).
XP includes Piscine roll-ups and exams, excluding nested Piscine exercises.
Changing `DOMAIN` also requires updating the static CSP connect-src allowlist
in `index.html`. There are no hardcoded user/event/project IDs.

List queries paginate with stable ID ordering; XP consumers share one complete
cached result per load. A terminal empty page establishes completeness even
when the platform returns fewer rows than requested. Recent activity keeps
60 results after filtering. A small nonempty profile uses 11 GraphQL POSTs;
large profiles use more. Playground examples show one page by default and
accept `limit`/`offset` variables. HTTP 403/query permission errors preserve the
session; HTTP 401/explicit JWT errors end it.

Use a current browser with native ES modules, `AbortSignal.timeout()`,
`AbortSignal.any()` and `ResizeObserver`. All three request paths have a 12-second
budget, including body reads; logout aborts pending work. Live schema/data and
successful hosted authentication still need the checks in the linked tracker.

## Deployment

Static hosting — no build step and no server-side anything. Every path in
`index.html` is relative (`./css/`, `./js/`), so the site works unchanged
whether it is served from a domain root or from a project subpath.

The app must be served over HTTP, not opened from the filesystem: ES modules
and `fetch` both fail under `file://`.

### GitHub Pages

The public site uses **Deploy from a branch**, **`main / root`**, with HTTPS
enforced. The included `.nojekyll` bypasses Jekyll. The `origin` remote remains
Zone01 Gitea; the separate `github` remote publishes to GitHub.

On 2026-10-26, Chromium and Firefox verified the hosted login page, all 31
HTML/CSS/JavaScript files against local source, module MIME types, subpath reload,
invalid credentials, keyboard focus and login layout at 320–1920px. Real API
preflights and rejection responses were accessible from the hosted origin.
Successful authentication, authenticated refresh/logout, live dashboard/graphs
and independent platform GraphiQL comparisons remain pending a real account.
T12 and T13 remain open until those checks pass.

### Netlify / Vercel / any static host

Upload `index.html`, `css/`, `js/` and `.nojekyll`, or configure a host to serve
these files with no build command and the repository root as its publish
directory. Exclude local secret files and tooling metadata.

When changing hosts, update the **Live URL** above and repeat the hosted checks.

## Docs

- [Project instructions](docs/instructions.md)
- [Audit criteria](docs/audit-readme.md)
- [Ticket tracker](docs/ticket-tracker.md)
- [Live data verification](docs/data-verification.md)
