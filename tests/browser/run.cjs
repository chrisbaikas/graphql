// Optional dev-only harness. Install Playwright outside this static project.
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const root = path.resolve(__dirname, "../..");
const token = (sub) =>
  `e30.${Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.sig`;
const result = [];
(async () => {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/__test__/stream") {
      response.writeHead(200, { "Content-Type": "application/json", "Content-Length": "1000" });
      response.write('{"data":');
      const timer = setTimeout(() => response.end(), 2000);
      response.on("close", () => clearTimeout(timer));
      return;
    }
    const filename = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(filename, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      const type = filename.endsWith(".js")
        ? "text/javascript"
        : filename.endsWith(".css")
          ? "text/css"
          : "text/html";
      response.writeHead(200, { "Content-Type": type });
      response.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const engineName = process.env.BROWSER || "chromium";
  const engine = playwright[engineName];
  let browser;
  try {
    if (!["chromium", "firefox", "webkit"].includes(engineName))
      throw Error("Unknown BROWSER: " + engineName);
    browser = await engine.launch({
      headless: true,
      ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {})
    });
    async function scenario(name, run, init = {}) {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      const state = { signin: 200, cap: 500, owner: "A", requests: [], ...init };
      const consoleErrors = [];
      page.on("pageerror", (e) => consoleErrors.push(e.message));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        // Browsers log the deliberately injected HTTP/network failures too.
        const expectedHttp =
          m.location().url.includes("platform.zone01.gr") &&
          m.text().startsWith("Failed to load resource:");
        const expectedFirefoxAbort =
          state.abortedSignin &&
          m.text().includes("https://platform.zone01.gr/api/auth/signin") &&
          m.text().includes("CORS request did not succeed");
        if (!expectedHttp && !expectedFirefoxAbort) consoleErrors.push(m.text());
      });
      page.on("response", (r) => {
        if (r.url().startsWith("http://127.0.0.1") && r.status() >= 400)
          consoleErrors.push(`asset ${r.status()} ${r.url()}`);
      });
      if (state.shortTimeout)
        await page.addInitScript(() => {
          const timeout = AbortSignal.timeout.bind(AbortSignal);
          AbortSignal.timeout = () => timeout(180);
        });
      await context.route("https://platform.zone01.gr/**", async (route) => {
        const req = route.request();
        if (req.url().endsWith("/signin")) {
          state.signinCalls = (state.signinCalls || 0) + 1;
          state.credential = Buffer.from(req.headers().authorization.slice(6), "base64").toString(
            "utf8"
          );
          if (state.signinGate) await state.signinGate;
          if (state.signinHang) return;
          if (state.network) {
            state.abortedSignin = true;
            return route.abort("failed");
          }
          return route
            .fulfill({
              status: state.signin,
              contentType: "application/json",
              body: state.signinBody ?? JSON.stringify(token(state.owner))
            })
            .catch((error) => {
              // Logout intentionally aborts requests that may still be gated.
              if (!page.isClosed() && !route.request().failure()) throw error;
            });
        }
        const { query, variables = {} } = req.postDataJSON();
        const owner = JSON.parse(
          Buffer.from(req.headers().authorization.split(".")[1], "base64url").toString()
        ).sub;
        state.requests.push({ query, variables, owner });
        const gate = state.gate;
        if (gate) await gate;
        if (state.queryHang && query.includes(state.queryHang)) return;
        if (state.custom && query.includes("Custom"))
          return route.fulfill(state.custom).catch((error) => {
            // Logout intentionally aborts requests that may still be gated.
            if (!page.isClosed() && !route.request().failure()) throw error;
          });
        if (state.graphStatus)
          return route
            .fulfill({
              status: state.graphStatus,
              contentType: "application/json",
              body: JSON.stringify({
                errors: [
                  {
                    message: state.graphStatus === 403 ? "Permission denied" : "JWT expired",
                    extensions: {
                      code: state.graphStatus === 403 ? "access-denied" : "invalid-jwt"
                    }
                  }
                ]
              })
            })
            .catch((error) => {
              // Logout intentionally aborts requests that may still be gated.
              if (!page.isClosed() && !route.request().failure()) throw error;
            });
        if (state.queryError && query.includes("XpTransactions"))
          return route
            .fulfill({
              status: state.queryError,
              contentType: "application/json",
              body: JSON.stringify({ errors: [{ message: "Fixture query failure" }] })
            })
            .catch((error) => {
              // Logout intentionally aborts requests that may still be gated.
              if (!page.isClosed() && !route.request().failure()) throw error;
            });
        const xp =
          state.xp ??
          Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            objectId: i + 101,
            amount: 1000 * (i + 1),
            path: `/athens/div-01/p${i}`,
            createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
            object: { id: i + 101, name: `${owner} project ${i}` }
          }));
        let field = "transaction",
          rows;
        if (query.includes("user {")) {
          field = "user";
          rows = [{ id: owner === "A" ? 41 : 42, login: owner }];
        } else if (query.includes("RecentProjects")) {
          field = "result";
          rows = [
            {
              id: 1,
              grade: 1,
              path: "/athens/div-01/forum",
              object: { type: "project", name: `${owner} forum` }
            },
            {
              id: 2,
              grade: 0,
              path: "/athens/div-01/fail",
              object: { type: "project", name: "failed" }
            },
            {
              id: 3,
              grade: null,
              path: "/athens/div-01/pending",
              object: { type: "project", name: "pending" }
            }
          ];
        } else if (query.includes("AuditTotals"))
          rows = state.audits ?? [
            { id: 101, type: "up", amount: 8000 },
            { id: 102, type: "down", amount: 10000 }
          ];
        else if (query.includes("Level"))
          rows = state.empty ? [] : [{ id: 103, amount: 31, path: "/athens/div-01/forum" }];
        else if (query.includes("Skills"))
          rows = state.empty
            ? []
            : Array.from({ length: 9 }, (_, i) => ({
                id: 200 + i,
                type: `skill_${i}`,
                amount: 80 - i * 5
              }));
        else rows = xp;
        if (state.empty && field !== "user") rows = [];
        if (field !== "user")
          rows = rows.slice(
            variables.offset || 0,
            (variables.offset || 0) + Math.min(variables.limit ?? 500, state.cap)
          );
        return route
          .fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: { [field]: rows } })
          })
          .catch((error) => {
            // Logout intentionally aborts requests that may still be gated.
            if (!page.isClosed() && !route.request().failure()) throw error;
          });
      });
      await page.goto(baseURL);
      async function login(owner = "A") {
        state.owner = owner;
        await page.locator("#username").fill(owner + "@fixture.test");
        await page.locator("#password").fill("κωδικός🔑");
        await page.locator("#login-btn").click();
      }
      async function loaded() {
        await page.locator("#user-login").filter({ hasText: state.owner }).waitFor();
        await page.locator("#xp-total").filter({ hasText: /B/ }).waitFor();
        await page.locator("#skills-toggle").waitFor({ state: state.empty ? "hidden" : "visible" });
      }
      await run({ page, state, context, login, loaded });
      assert.deepEqual(consoleErrors, [], name + " console errors");
      result.push(name);
      console.log("PASS", name);
      await context.close();
    }
    await scenario(
      "initial, UTF8/email login, complete paging, values, 3 SVGs, overflow, modal keyboard and logout",
      async ({ page, state, login, loaded }) => {
        assert.equal(await page.locator("#login-view").isVisible(), true);
        await page.evaluate(() => localStorage.setItem("token", "legacy-fixture"));
        await page.reload();
        assert.equal(await page.evaluate(() => localStorage.getItem("token")), null);
        state.cap = 3;
        await login();
        await loaded();
        await page.locator("#graph-projects svg").waitFor();
        assert.match(state.credential, /A@fixture.test:κωδικός🔑/);
        assert.equal(await page.locator("#xp-total").textContent(), "78.00 kB");
        assert.equal(await page.locator("#audit-ratio").textContent(), "0.8");
        assert.equal(await page.locator(".graph-box svg").count(), 3);
        assert.equal(state.requests.filter((r) => r.query.includes("XpTransactions")).length, 5);
        assert.equal(
          await page.locator("#recent-list").textContent(),
          "A forum — passfailed — failpending — pending"
        );
        assert.equal(await page.evaluate(() => !!sessionStorage.getItem("token")), true);
        assert.equal(await page.evaluate(() => localStorage.getItem("token")), null);
        await page.locator("#xp-toggle").click();
        assert.equal(await page.locator("#xp-list li:visible").count(), 12);
        for (const width of [320, 375, 768, 1280, 1920]) {
          await page.setViewportSize({ width, height: 800 });
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
            "viewport " + width
          );
        }

        await page.locator("#graph-xp").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#app").evaluate((e) => e.inert), true);
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "modal-close");
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => document.activeElement.id), "graph-xp");
        await page.locator("#graph-xp").click();
        await page.locator(".modal-backdrop").click({ position: { x: 2, y: 2 } });
        await page.locator("#graph-xp").click();
        await page.evaluate(async () => {
          (await import("./js/core/auth.js")).logout();
        });
        assert.equal(await page.locator("#graph-modal").isVisible(), false);
        assert.equal(await page.locator("#modal-body").textContent(), "");
        assert.equal(await page.locator("#graph-xp").getAttribute("aria-description"), null);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("token")), null);
        assert.equal(await page.locator("#password").inputValue(), "");
      }
    );
    await scenario(
      "invalid credentials, 500, malformed token, network error and recovery",
      async ({ page, state, login, loaded }) => {
        for (const [code, expected] of [
          [401, "Invalid credentials"],
          [500, "500"]
        ]) {
          state.signin = code;
          await login();
          await page.locator("#error").filter({ hasText: expected }).waitFor();
          assert.equal(await page.locator("#login-btn").isEnabled(), true);
        }
        state.signin = 200;
        state.signinBody = "{}";
        await login();
        await page.locator("#error").filter({ hasText: "invalid or expired token" }).waitFor();
        delete state.signinBody;
        state.network = true;
        await login();
        await page.locator("#error").filter({ hasText: "Network error" }).waitFor();
        state.network = false;
        await login();
        await loaded();
        await page.reload();
        await loaded();
      }
    );
    await scenario(
      "GraphQL error isolation and authorization failure preserves session",
      async ({ page, state, login }) => {
        state.queryError = 400;
        await login();
        await page
          .locator("#dashboard-error")
          .filter({ hasText: "Fixture query failure" })
          .waitFor();
        await page.locator("#audit-ratio").filter({ hasText: "0.8" }).waitFor();
        assert.equal(await page.locator("#dashboard-view").isVisible(), true);
        state.queryError = null;
        state.graphStatus = 403;
        await page.reload();
        await page.locator("#dashboard-error").filter({ hasText: "Access denied" }).waitFor();
        assert.equal(await page.locator("#dashboard-view").isVisible(), true);
      }
    );
    await scenario(
      "rapid login, logout during loading, User A to B and late requests",
      async ({ page, state, login, loaded }) => {
        let release;
        state.gate = new Promise((r) => (release = r));
        await login();
        await page.locator("#dashboard-view").waitFor();
        await page.locator("#logout-btn").click();
        state.gate = null;
        await login("B");
        await loaded();
        await page.locator("#graph-projects svg").waitFor();
        release();
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        );
        assert.equal(await page.locator("#user-login").textContent(), "B");
        assert.match(await page.locator("#xp-list").textContent(), /B project/);
        assert.doesNotMatch(await page.locator("#xp-list").textContent(), /A project/);
        await page.locator("#logout-btn").click();
        let resume;
        state.signinGate = new Promise((r) => (resume = r));
        const before = state.signinCalls;
        await page.locator("#username").fill("A");
        await page.locator("#password").fill("fixture");
        const signinStarted = page.waitForRequest("**/signin");
        await page.evaluate(async () => {
          const { login } = await import("./js/core/auth.js");
          login();
          login();
        });
        await page.waitForFunction(() => document.getElementById("login-btn").disabled);
        await signinStarted;
        assert.equal(state.signinCalls, before + 1);
        resume();
        state.signinGate = null;
        await loaded();
      }
    );
    await scenario(
      "playground envelope, examples, variables, Ctrl+Enter, 403 and session rejection",
      async ({ page, state, login, loaded }) => {
        await login();
        await loaded();
        await page.locator("#graphiql-section summary").click();
        await page.locator("#gql-query").fill("query Custom { user { id } }");
        await page.locator("#gql-variables").fill("null");
        await page.locator("#gql-run").click();
        await page.locator("#gql-status").filter({ hasText: "Invalid variables" }).waitFor();
        await page.locator("#gql-variables").fill("{}");
        const envelope = {
          data: { user: null },
          errors: [{ message: "Permission denied", extensions: { code: "access-denied" } }]
        };
        state.custom = {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope)
        };
        await page.locator("#gql-query").press("Control+Enter");
        await page.locator("#gql-status").filter({ hasText: "1 error" }).waitFor();
        assert.deepEqual(JSON.parse(await page.locator("#gql-result").textContent()), envelope);
        state.custom = {
          status: 403,
          contentType: "application/json",
          body: '{"message":"Forbidden"}'
        };
        await page.locator("#gql-run").click();
        await page.locator("#gql-status").filter({ hasText: "HTTP 403" }).waitFor();
        assert.equal(await page.locator("#dashboard-view").isVisible(), true);
        delete state.custom;
        await page.locator('.gql-example[data-query="XP_TRANSACTIONS"]').click();
        assert.match(await page.locator("#gql-query").inputValue(), /query XpTransactions/);
        state.graphStatus = 401;
        await page.locator("#gql-run").click();
        await page.locator("#error").filter({ hasText: "session is no longer valid" }).waitFor();
        assert.equal(
          await page.locator("#gql-result").textContent(),
          "Run a query to see the result."
        );
      }
    );
    await scenario(
      "signin, dashboard and playground timeout recovery",
      async ({ page, state, login, loaded }) => {
        state.signinHang = true;
        await login();
        await page.locator("#error").filter({ hasText: "timed out" }).waitFor();
        assert.equal(await page.locator("#login-btn").isEnabled(), true);
        state.signinHang = false;
        state.queryHang = "XpTransactions";
        await login();
        await page.locator("#dashboard-error").filter({ hasText: "timed out" }).waitFor();
        state.queryHang = null;
        await page.reload();
        await loaded();
        await page.locator("#graphiql-section summary").click();
        await page.locator("#gql-query").fill("query Custom { user { id } }");
        state.queryHang = "Custom";
        await page.locator("#gql-run").click();
        await page.locator("#gql-status").filter({ hasText: "Timed out" }).waitFor();
        assert.equal(await page.locator("#gql-run").isEnabled(), true);
      },
      { shortTimeout: true }
    );
    await scenario(
      "empty datasets and placeholders",
      async ({ page, login, loaded }) => {
        await login();
        await loaded();
        await page.locator("#graph-xp").filter({ hasText: "Not enough XP" }).waitFor();
        assert.equal(await page.locator(".graph-box svg").count(), 0);
        assert.equal(await page.locator("#xp-total").textContent(), "0 B");
        assert.equal(await page.locator("#audit-ratio").textContent(), "—");
      },
      { empty: true }
    );
    await scenario(
      "negative, zero, identical-time values, long Unicode and injection-safe labels",
      async ({ page, login, loaded }) => {
        await login();
        await loaded();
        await page.locator("#graph-projects svg").waitFor();
        assert.equal(await page.locator("#xp-total").textContent(), "-1.00 kB");
        for (const svg of await page.locator(".graph-box svg").all()) {
          assert.doesNotMatch(await svg.getAttribute("viewBox"), /NaN|Infinity/);
          assert.doesNotMatch(await svg.innerHTML(), /NaN|Infinity|<img/);
          for (const rect of await svg.locator("rect").all()) {
            assert.ok(Number(await rect.getAttribute("width")) >= 0);
            assert.ok(Number(await rect.getAttribute("height")) >= 0);
          }
        }

        assert.equal(await page.evaluate(() => globalThis.injected), undefined);
      },
      {
        xp: [
          {
            id: 1,
            objectId: 1,
            amount: -2000,
            path: "/athens/div-01/a",
            createdAt: "2026-01-01T00:00:00Z",
            object: { id: 1, name: "🔑".repeat(80) + '<img src=x onerror="globalThis.injected=1">' }
          },
          {
            id: 2,
            objectId: 2,
            amount: 1000,
            path: "/athens/div-01/b",
            createdAt: "2026-01-01T00:00:00Z",
            object: { id: 2, name: "zero" }
          },
          {
            id: 3,
            objectId: 3,
            amount: 0,
            path: "/athens/div-01/c",
            createdAt: "2026-01-01T00:00:00Z",
            object: { id: 3, name: "zero" }
          }
        ],
        audits: [
          { id: 1, type: "up", amount: -1000 },
          { id: 2, type: "down", amount: 2000 }
        ]
      }
    );
    await scenario(
      "one XP row and large-value chart geometry",
      async ({ page, login, loaded }) => {
        await login();
        await loaded();
        await page.locator("#graph-xp").filter({ hasText: "Not enough XP" }).waitFor();
        await page.locator("#graph-projects svg").waitFor();
        assert.ok(Number(await page.locator("#graph-projects rect").getAttribute("width")) > 0);
        assert.equal(await page.locator("#xp-count").textContent(), "1");
      },
      {
        xp: [
          {
            id: 1,
            objectId: 1,
            amount: 9007199254740991,
            path: "/athens/div-01/large",
            createdAt: "2026-01-01T00:00:00Z",
            object: { id: 1, name: "Very large fixture" }
          }
        ]
      }
    );
    await scenario(
      "playground pending at logout and expired saved JWT on reload",
      async ({ page, state, login, loaded }) => {
        await login();
        await loaded();
        await page.locator("#graphiql-section summary").click();
        state.queryHang = "Custom";
        await page.locator("#gql-query").fill("query Custom { user { id } }");
        await page.locator("#gql-run").click();
        await page.locator("#gql-status").filter({ hasText: "Running" }).waitFor();
        await page.locator("#logout-btn").click();
        assert.equal(await page.locator("#gql-run").isEnabled(), true);
        assert.equal(
          await page.locator("#gql-result").textContent(),
          "Run a query to see the result."
        );
        await page.evaluate(() => sessionStorage.setItem("token", "e30.eyJleHAiOjF9.sig"));
        await page.reload();
        await page
          .locator("#error")
          .filter({ hasText: "saved session is invalid or expired" })
          .waitFor();
        assert.equal(await page.evaluate(() => sessionStorage.getItem("token")), null);
      }
    );
    await scenario(
      "project subpath module resolution and refresh",
      async ({ page, context, login, loaded }) => {
        await context.route(baseURL + "/profile/**", async (route) => {
          const url = new URL(route.request().url());
          let relative = url.pathname.slice("/profile/".length) || "index.html";
          const contentType = relative.endsWith(".js")
            ? "text/javascript"
            : relative.endsWith(".css")
              ? "text/css"
              : "text/html";
          await route.fulfill({
            status: 200,
            contentType,
            body: fs.readFileSync(root + "/" + relative)
          });
        });
        await page.goto(baseURL + "/profile/");
        await login();
        await loaded();
        await page.reload();
        await loaded();
        assert.equal(await page.locator("#dashboard-view").isVisible(), true);
      }
    );
    await scenario(
      "responsive labels, modal geometry and reduced motion",
      async ({ page, state, login, loaded }) => {
        state.xp = Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          objectId: index + 1,
          amount: (index + 1) * 1000,
          path: `/athens/div-01/p${index}`,
          createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
          object: { id: index + 1, name: `Very long Ελληνικό🔑 project label ${index}` }
        }));
        await login();
        await loaded();
        await page.locator("#graph-projects svg").waitFor();
        assert.match(
          await page.locator("#graph-projects rect title").first().textContent(),
          /Very long Ελληνικό🔑/
        );
        for (const width of [320, 375, 768, 1280, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          await page.waitForFunction(() =>
            [...document.querySelectorAll(".graph-box")].every((box) => {
              const svg = box.querySelector("svg");
              const available = box.clientWidth - 16;
              return svg && Math.abs(svg.viewBox.baseVal.width - Math.min(480, available)) < 1;
            })
          );
          async function checkLabels(selector) {
            const labels = await page.locator(selector).evaluateAll((svgs) =>
              svgs.flatMap((svg) => {
                const frame = svg.getBoundingClientRect();
                return [...svg.querySelectorAll("text")].map((text) => {
                  const bounds = text.getBoundingClientRect();
                  const scale = svg.getScreenCTM().a;
                  return {
                    text: text.textContent,
                    font: parseFloat(getComputedStyle(text).fontSize) * scale,
                    inside:
                      bounds.left >= frame.left - 1 &&
                      bounds.right <= frame.right + 1 &&
                      bounds.top >= frame.top - 1 &&
                      bounds.bottom <= frame.bottom + 1
                  };
                });
              })
            );
            assert.ok(labels.length);
            for (const label of labels) {
              assert.ok(
                label.font >= 10.8,
                `unreadable label at ${width}px: ${JSON.stringify(label)}`
              );
              assert.ok(label.inside, `clipped label at ${width}px: ${JSON.stringify(label)}`);
            }
          }
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true
          );
          await checkLabels(".graph-box svg");
          for (const id of ["graph-xp", "graph-audit", "graph-projects"]) {
            await page.locator("#" + id).focus();
            await page.keyboard.press("Space");
            await page.locator("#graph-modal").waitFor();
            await checkLabels("#modal-body svg");
            await page.keyboard.press("Escape");
            assert.equal(await page.evaluate(() => document.activeElement.id), id);
          }
        }
        const dots = await page.locator(".dot-fade").evaluateAll((elements) =>
          elements.map((element) => ({
            delay: getComputedStyle(element).animationDelay,
            opacity: getComputedStyle(element).opacity
          }))
        );
        assert.ok(dots.length);
        assert.ok(dots.every((dot) => dot.delay === "0s" && dot.opacity === "1"));
      }
    );

    await scenario(
      "placeholder semantics, reset and chart activation states",
      async ({ page, state, login, loaded }) => {
        async function checkPlaceholders() {
          const placeholders = await page
            .locator(".graph-box:not(:has(svg))")
            .evaluateAll((boxes) =>
              boxes.map((box) => ({
                role: box.getAttribute("role"),
                tabindex: box.getAttribute("tabindex"),
                label: box.getAttribute("aria-label"),
                description: box.getAttribute("aria-description")
              }))
            );
          assert.ok(placeholders.length);
          for (const box of placeholders)
            assert.deepEqual(box, { role: null, tabindex: null, label: null, description: null });
        }
        await checkPlaceholders();
        let release;
        state.gate = new Promise((resolve) => (release = resolve));
        await login();
        await page.locator("#dashboard-view").waitFor();
        await checkPlaceholders();
        assert.match(await page.locator("#graph-xp").textContent(), /Loading/);
        state.gate = null;
        release();
        await loaded();
        await page.locator("#graph-projects svg").waitFor();
        assert.equal(await page.locator('.graph-box[role="button"][tabindex="0"]').count(), 3);
        assert.equal(await page.locator("#xp-count").textContent(), "12");
        assert.equal(await page.locator(".skill-value").first().textContent(), "80%");
        await page.keyboard.press("Tab");
        await page.locator("#graph-xp").focus();
        assert.equal(
          await page.locator("#graph-xp").evaluate((box) => getComputedStyle(box).outlineWidth),
          "2px"
        );
        await page.locator("#collapse-all").click();
        await page.locator("#expand-all").click();
        await page.locator("#graph-xp").focus();
        await page.keyboard.press("Enter");
        await page.locator("#modal-close").click();
        assert.equal(await page.evaluate(() => document.activeElement.id), "graph-xp");
        state.queryError = 400;
        await page.reload();
        await page.locator("#graph-xp").filter({ hasText: "Could not load" }).waitFor();
        await checkPlaceholders();
        state.queryError = null;
        state.empty = true;
        await page.reload();
        await loaded();
        await page.locator("#graph-audit").filter({ hasText: "No audit data" }).waitFor();
        await checkPlaceholders();
        await page.locator("#logout-btn").click();
        await checkPlaceholders();
        assert.equal(await page.locator(".graph-box svg").count(), 0);
        assert.equal(await page.locator("#xp-total").textContent(), "—");
        assert.equal(await page.locator("#skills-list").textContent(), "—");
        assert.equal(await page.locator("#recent-list").textContent(), "—");
        assert.equal(await page.locator("#gql-query").inputValue(), "{ user { id login } }");
      }
    );

    await scenario("real streamed response-body timeout", async ({ page }) => {
      const outcome = await page.evaluate(async () => {
        const { fetchWithTimeout, readResponse } = await import("./js/core/http.js");
        try {
          const response = await fetchWithTimeout("/__test__/stream", {}, 100);
          await readResponse(response);
          return { name: "unexpected success" };
        } catch (error) {
          return { name: error.name, message: error.message };
        }
      });
      assert.equal(outcome.name, "TimeoutError");
      assert.match(outcome.message, /timed out/);
    });

    console.log(JSON.stringify({ browser: engineName, scenarios: result.length, passed: result }));
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
