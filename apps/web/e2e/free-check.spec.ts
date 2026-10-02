import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL!).origin && ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort();
  });
});

const evidence = { prompt: 'Original fixture question', platform: 'fixture', model: 'fixture', brand_mentioned: true, brand_sentiment: 'neutral', brand_position: 1, brand_cited: false, response_preview: 'Original fixture answer.', latency_ms: 1 };

async function submit(page: import('@playwright/test').Page) {
  await page.getByPlaceholder(/yourproduct\.com/i).fill('https://example.test');
  await page.getByRole('button', { name: 'Run check', exact: true }).click();
}

test('page exposes the public no-signup check', async ({ page }) => {
  await page.goto('/check');
  await expect(page.getByRole('heading', { name: 'Run your free check' })).toBeVisible();
  await expect(page.getByText('No signup', { exact: true })).toBeVisible();
});

for (const problem of ['503', 'unknown', 'incomplete', 'empty-scored', 'malformed-record']) {
  test(`poll ${problem} is an explicit error and permits retry`, async ({ page }) => {
    let recovered = false;
    await page.route('**/v1/free-check**', route => {
      if (route.request().method() === 'POST') return route.fulfill({ json: { id: 'fixture', brand_name: 'Fixture' } });
      if (recovered) return route.fulfill({ json: { status: 'completed', results: [evidence], mention_rate: 1 } });
      return problem === '503' ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: problem === 'unknown' ? {} : { status: 'completed', results: problem === 'malformed-record' ? [null] : [], ...(['empty-scored', 'malformed-record'].includes(problem) ? { mention_rate: 1 } : {}) } });
    });
    await page.goto('/check'); await submit(page);
    await expect(page.getByRole('button', { name: 'Run check', exact: true })).toBeEnabled();
    await expect(page.getByText(/You can retry/)).toBeVisible();
    await expect(page.getByText('100%', { exact: true })).toHaveCount(0);
    recovered = true; await submit(page);
    await expect(page.getByText('100%', { exact: true })).toBeVisible();
  });
}

test('running checks stop at the deadline', async ({ page }) => {
  await page.clock.install();
  await page.route('**/v1/free-check**', route => route.fulfill({ json: route.request().method() === 'POST' ? { id: 'fixture', brand_name: 'Fixture' } : { status: 'running' } }));
  await page.goto('/check'); await submit(page);
  await expect(page.getByRole('button', { name: 'Checking', exact: true })).toBeDisabled();
  await page.clock.fastForward(181_000);
  await expect(page.getByText('The check timed out. You can retry.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run check', exact: true })).toBeEnabled();
});

for (const width of [390, 768, 1440]) {
  test(`100 percent fits its score box at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/v1/free-check**', route => route.fulfill({ json: route.request().method() === 'POST' ? { id: 'fixture', brand_name: 'Fixture' } : { status: 'completed', results: [evidence], mention_rate: 1 } }));
    await page.goto('/check'); await submit(page);
    const score = page.getByText('100%', { exact: true }); await expect(score).toBeVisible();
    const bounds = await score.evaluate(el => {
      const value = el.getBoundingClientRect(); const box = el.parentElement!.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(el); const text = range.getBoundingClientRect();
      return { textRight: text.right, boxRight: box.right, textLeft: text.left, boxLeft: box.left, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(bounds.textRight).toBeLessThanOrEqual(bounds.boxRight);
    expect(bounds.textLeft).toBeGreaterThanOrEqual(bounds.boxLeft);
    expect(bounds.overflow).toBe(0);
  });
}
