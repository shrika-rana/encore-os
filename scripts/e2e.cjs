// End-to-end check of both features in a real browser.
// Setup once:  npm i -D playwright && npx playwright install chromium
// Run:         npm run build && npx vite preview --port 4173  (in one terminal)
//              node scripts/e2e.cjs                            (in another)
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/encore-os/';
const assert = (ok, msg) => { if (!ok) { console.error('FAIL', msg); process.exitCode = 1; } else console.log('PASS', msg); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);

  // Feature 1 — Song Studio
  const before = await page.$$eval('.chord .sym', (els) => els.map((e) => e.textContent).join(' '));
  await page.click('[data-testid=generate]');
  const after = await page.$$eval('.chord .sym', (els) => els.map((e) => e.textContent).join(' '));
  assert((await page.$$('.chord')).length === 14, 'progression has 14 chords across 4 sections');
  assert(before !== after, 'writing a new progression changes the chords');
  await page.click('[data-testid=play]');
  await page.waitForTimeout(1500);
  assert((await page.$$('.chord.active')).length === 1, 'playback highlights the current chord');
  await page.click('[data-testid=play]');
  await page.click('[data-testid=suggest]');
  await page.waitForSelector('.suggestion', { timeout: 8000 });
  assert((await page.$$('.suggestion')).length >= 3, 'co-writer suggests at least 3 next lines');
  const rhymes = await page.$$('.rhyme-chip');
  assert(rhymes.length > 0, 'rhyme finder returns rhymes');
  const letters = await page.$$eval('.rhyme-letter', (els) => els.map((e) => e.textContent).filter(Boolean));
  assert(letters.length >= 2, `rhyme scheme labels lines (${letters.join('')})`);

  // Feature 2 — Band Finder
  await page.click('text=Band Finder');
  await page.waitForTimeout(400);
  const scores = await page.$$eval('[data-testid=match-row] .ring b', (els) => els.map((e) => Number(e.textContent)));
  assert(scores.length > 0 && scores.every((s, i) => i === 0 || scores[i - 1] >= s), `matches are ranked (${scores.join(', ')})`);
  await page.getByRole('button', { name: 'Invite' }).first().click();
  await page.waitForTimeout(6000);
  const members = await page.$$eval('.member .nm b', (els) => els.map((e) => e.textContent));
  assert(members.length === 2, `top match accepted and joined (${members.join(', ')})`);
  const total = await page.$$eval('.share-input input', (els) => els.reduce((a, e) => a + Number(e.value), 0));
  assert(total === 100, `split shares total 100% (${total})`);
  await page.getByRole('button', { name: 'Lock agreement' }).click();
  assert(await page.isVisible('text=Agreement locked'), 'split agreement locks');

  assert(errors.length === 0, `no page errors (${errors.length})`);
  await browser.close();
})();
