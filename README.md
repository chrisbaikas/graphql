# GraphQL Profile

A personal profile page for the Zone01 platform. It authenticates against the
platform (JWT), queries the logged-in user's own data from the GraphQL
endpoint, and displays it as profile sections plus SVG statistics graphs.

- **Platform:** `platform.zone01.gr`
- **Live URL:** _(add after deploying — see Deployment)_

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
tests/            # node:test unit tests for the pure helpers
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

Unit tests for the pure helpers — formatting, JWT parsing/expiry, the Basic
auth credential builder, and the fetch timeout. They use Node's built-in test
runner, so there is nothing to install:

```bash
make test
# or directly:
node --test 'tests/*.test.js'
```

Requires Node 18 or newer. The tests import the same ES modules the browser
loads; none of them touch the DOM or the network.

## Deployment

Static hosting — no build step and no server-side anything. Every path in
`index.html` is relative (`./css/`, `./js/`), so the site works unchanged
whether it is served from a domain root or from a project subpath.

The app must be served over HTTP, not opened from the filesystem: ES modules
and `fetch` both fail under `file://`.

### GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Source:** "Deploy from a branch".
3. Pick the `main` branch and the `/ (root)` folder, then Save.
4. Add an empty `.nojekyll` file at the repository root first if you ever add a
   directory whose name starts with an underscore — Jekyll skips those. The
   current layout has none, so it is not needed today.
5. The site appears at `https://<user>.github.io/<repo>/`.

### Netlify / Vercel / any static host

Drag the folder into the Netlify dashboard, or point the host at the repository
with an empty build command and `/` as the publish directory.

Once it is live, put the public URL in the **Live URL** field at the top of this
file.

## Docs

- [Project instructions](docs/instructions.md)
- [Audit criteria](docs/audit-readme.md)
- [Ticket tracker](docs/ticket-tracker.md)
