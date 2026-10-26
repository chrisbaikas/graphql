# Reproducible browser verification

`tests/browser/run.cjs` runs 14 scenario groups against synthetic API responses.
It starts its own static server on a free loopback port, intercepts every platform
request, and closes the browser/server on completion or failure. No real account,
credentials, platform requests, screenshots or browser profiles are needed.

The application and Node tests still have zero dependencies. The optional browser
harness uses an external Playwright installation; it adds no package manifest,
lockfile, build step or runtime dependency to this repository.

## Setup and commands

With Node/npm installed, install the browser tool **outside the repository**:

```bash
npm install --prefix /tmp/graphql-browser-tools --no-save --package-lock=false playwright@1.62.1
node /tmp/graphql-browser-tools/node_modules/playwright/cli.js install chromium firefox

PLAYWRIGHT_MODULE=/tmp/graphql-browser-tools/node_modules/playwright make test-browser
PLAYWRIGHT_MODULE=/tmp/graphql-browser-tools/node_modules/playwright BROWSER=firefox make test-browser
```

Browser installation may report missing operating-system libraries; install the
libraries listed by Playwright for your OS. `/tmp` is temporary, so repeat setup
if it was cleared. An existing compatible installation can be supplied through
`PLAYWRIGHT_MODULE`; `BROWSER_EXECUTABLE` optionally selects an installed browser.
Without these overrides, the harness resolves `playwright` normally and uses its
installed Chromium. It exits nonzero on a failed assertion or unexpected error.

## Coverage

1. Initial state, UTF-8/email login, capped pagination, card totals, three SVGs,
   overflow controls, keyboard modal and logout cleanup.
2. Invalid credentials, sign-in 500, malformed JWT, injected network failure,
   recovery and refresh.
3. Dashboard query failure isolation and 403 preserving the session.
4. Logout mid-load, A → B, late responses and duplicate-login suppression.
5. Playground full response envelope, invalid variables, examples, Ctrl+Enter,
   403 and session rejection.
6. Sign-in/dashboard/playground timeout recovery with a shortened test budget.
7. Empty data and placeholders.
8. Negative/zero XP, identical timestamps, long Unicode/XSS labels and SVG math.
9. Single XP row and very large values.
10. Logout during a playground request and expired saved JWT on refresh.
11. Project-subpath assets and refresh.
12. Chart and modal labels at **320, 375, 768, 1280 and 1920px**, effective font
    size ≥10.8px (11px target), label bounds, full-name tooltips, no page overflow,
    Space/Escape/focus restoration and immediate reduced-motion dots.
13. Loading/empty/error placeholders without button semantics or Tab stops,
    loaded chart activation, section controls, skill values and complete reset.
14. A real local HTTP response whose headers arrive but body stalls: the shared
    body reader must report `TimeoutError`.

The harness checks page exceptions, unexpected console errors and missing local
assets. Deliberately injected API HTTP/network failures are expected console
diagnostics; Firefox describes the injected network abort as a CORS failure.
Requests aborted by logout may also reject fixture fulfillment. Other errors
remain failures. Timeout scenarios shorten only the test's browser budget; the
production default remains 12 seconds.

For a visual check, run `make run`, use your own account and inspect all three
charts at the widths above. Open each modal with mouse, Enter and Space; Escape
must return focus. Loading/empty/error graph boxes must be skipped by Tab. Enable
reduced motion in browser DevTools and confirm dots appear without a delay.

These synthetic checks do **not** establish live schema types, row permissions,
account totals or hosted CORS. Complete [data-verification.md](data-verification.md)
with a real account for T13 and test the public deployment for T12.

## Latest verification — 2026-10-26

`make test` and `make check` passed **123 tests**, with zero failures or skips.
The commands above passed **14/14 scenario groups in Chromium** and **14/14 in
Firefox**, using Playwright 1.62.1 outside the repository. The restricted sandbox
initially reported only ten file-level results; the unrestricted Node runner
executed all 123 individual tests.

Additional real-network checks against
https://chrisbaikas.github.io/graphql-profile/ passed in both browsers: HTTPS,
all 31 HTML/CSS/JS assets matching source, 29 loaded ES modules, correct MIME
types, the data-URI favicon, subpath reload, login keyboard focus and no login
overflow at 320/375/768/1280/1920px. Deliberately invalid credentials produced
HTTP 401 and a visible error, with no stored token. Real sign-in and GraphQL
preflights returned 204; their rejection responses were readable across origins.
There were no unexpected console errors, CSP violations or failed resources.

No real Zone01 session was available during that initial hosting pass. The
subsequent visible Chromium pass used manual username/email and platform logins:
hosted authentication, dashboard/graph values, authenticated refresh/logout and
independent platform GraphiQL comparisons all passed. Live graph/modal labels
also passed the five widths above, including keyboard focus and reduced motion.
T12/T13 are now DONE; see the [dated live-account evidence](data-verification.md#live-account-results--2026-10-26).
The synthetic results above remain separate from that real-account verification.
