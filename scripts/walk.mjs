// Phase 1 browser walk: both Run 01 branches, play mode + keyboard scrub.
// Screenshots land in /tmp/walk/ for visual review. Uses system Chrome.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const OUT = "/tmp/walk";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const arrowTo = async (n) => {
  for (let i = 0; i < n; i++) await page.keyboard.press("ArrowRight");
};

await page.goto("http://localhost:3006", { waitUntil: "networkidle" });
await shot("00-pristine");

// --- play to the wall ---
await page.getByRole("button", { name: "play" }).click();
await page.waitForTimeout(3200); // wall at 2.3s
await shot("01-wall-your-call");

// play button should be disabled at the wall
const disabled = await page.getByRole("button", { name: "play" }).isDisabled();
console.log("play disabled at wall:", disabled);

// space should do nothing at the wall
await page.keyboard.press(" ");
await page.waitForTimeout(400);
const status = await page.locator("text=your call").count();
console.log("still 'your call' after space:", status > 0);

// --- branch A: date ---
await page.getByRole("button", { name: "a date that won't parse" }).click();
await page.waitForTimeout(300);
await shot("02-date-resumed");
await page.waitForTimeout(5000); // ~7.6s: t1 fail visible
await shot("03-date-t1-fail");

// pause, then keyboard-scrub to the t3 evidence (~20s)
await page.keyboard.press(" ");
await arrowTo(7);
await page.waitForTimeout(600);
await shot("04-date-t3-evidence");

// scrub to the end
await arrowTo(11);
await page.waitForTimeout(800);
await shot("05-date-done");

// scrub BACKWARD through the whole run to t=2s (reverse purity check)
for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(600);
await shot("06-date-scrubbed-back");

// forward again to the end
await arrowTo(20);
await page.waitForTimeout(600);

// --- worst-moment switch: flip the answered choice at the end ---
// choice card is at the top of the stream; scroll it into view
await page.getByRole("button", { name: "a page that's one item short" }).scrollIntoViewIfNeeded();
await shot("07-before-flip");
await page.getByRole("button", { name: "a page that's one item short" }).click();
await page.waitForTimeout(600);
await shot("08-after-flip-offbyone");
const paginate = await page.locator("text=paginate").count();
const invalidDate = await page.locator("text=Invalid Date").count();
console.log("after flip: paginate visible:", paginate > 0, "| Invalid Date gone:", invalidDate === 0);

// stayed paused after flipping a past choice?
const paused = await page.locator("text=/^done$|^paused$/").count();
console.log("stayed put after flip (done/paused shown):", paused > 0);

// --- branch B from scratch: reload, play, pick offbyone live ---
await page.goto("http://localhost:3006", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "play" }).click();
await page.waitForTimeout(3000);
// scrub back a touch (to ~1.9s, card still visible), then answer —
// pick-resume must still fire. Arrow keys jump 2s, too coarse; drag the
// scrubber instead.
const track = page.locator("div.h-8.flex-1");
const box = await track.boundingBox();
await page.mouse.click(box.x + (1900 / 41000) * box.width, box.y + box.height / 2);
await page.waitForTimeout(200);
await shot("09a-scrubbed-back-before-answer");
await page.getByRole("button", { name: "a page that's one item short" }).click();
await page.waitForTimeout(500);
const playingNow = await page.locator("text=/^playing$/").count();
console.log("resumed after answering while scrubbed back:", playingNow > 0);
await page.waitForTimeout(4500); // t1 fail
await shot("09-offbyone-t1-fail");
await page.keyboard.press(" ");
await arrowTo(8);
await page.waitForTimeout(600);
await shot("10-offbyone-t3-evidence");
await arrowTo(11);
await page.waitForTimeout(800);
await shot("11-offbyone-done");

// let it truly play the final stretch in play mode too
for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
await page.keyboard.press(" "); // resume play through the ending
await page.waitForTimeout(13000);
await shot("12-offbyone-played-to-end");

console.log("console/page errors:", errors.length ? errors : "none");
await browser.close();
