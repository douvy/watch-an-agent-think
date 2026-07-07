// Production smoke test. Boots the real built server, drives real Chrome,
// and walks the one path every viewer walks: land → hit the gate → answer
// → reach the end card. Its main job is catching what unit tests can't:
// hydration failures (a stale or broken client bundle renders fine and
// then does nothing) and Player wiring regressions.
//
// Run: npm run build && npm run smoke
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 4123;
const BASE = `http://localhost:${PORT}`;

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✓ ${msg}`);

// --- server ---------------------------------------------------------------
const server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
  stdio: "ignore",
});
const killServer = () => {
  if (!server.killed) server.kill();
};
process.on("exit", killServer);

const deadline = Date.now() + 30_000;
for (;;) {
  try {
    const res = await fetch(BASE);
    if (res.ok) break;
  } catch {
    /* not up yet */
  }
  if (Date.now() > deadline) {
    fail(`server did not answer on :${PORT} within 30s`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 250));
}
ok("server up");

// --- browser ---------------------------------------------------------------
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();

  // Hydration failures are silent: the static HTML looks perfect and no
  // click ever works. Any pageerror or console error fails the run.
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  // 1. Landing renders with a working transport.
  await page.goto(BASE);
  await page.waitForSelector('[aria-label="play"]', { timeout: 10_000 });
  ok("landing renders, play button present");

  // 2. Deep link to the first gate wall — the choice card must be live.
  await page.goto(`${BASE}/?s=1&t=3.6`);
  const gate = page.getByRole("button", { name: "nashville hot chicken" });
  await gate.waitFor({ timeout: 10_000 });
  ok("deep link lands on the opening gate");

  if (!(await page.getByText("not interested in these tasks?").isVisible()))
    fail("escape hatch missing at the opening gate");
  else ok("escape hatch present");

  // 3. Answering the gate resumes playback (the clock moves on its own).
  const readTime = async () => {
    const text = await page.textContent("body");
    const m = text.match(/(\d+(?:\.\d+)?) \/ \d+s/);
    if (!m) throw new Error("time readout not found");
    return parseFloat(m[1]);
  };
  await gate.click();
  const t0 = await readTime();
  await page.waitForTimeout(1500);
  const t1 = await readTime();
  if (t1 > t0) ok(`answering resumed playback (${t0}s → ${t1}s)`);
  else fail(`playback did not resume after answering (${t0}s → ${t1}s)`);

  // 4. Keyboard-scrub to the end; the done card and takeaway must land.
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowRight");
  await page.getByText("I don't write down are gone").waitFor({
    timeout: 10_000,
  });
  ok("scrubbed to done; takeaway on screen");

  if (errors.length) {
    for (const e of errors) fail(e);
  } else {
    ok("no page or console errors");
  }
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
  killServer();
}

process.exit(process.exitCode ?? 0);
