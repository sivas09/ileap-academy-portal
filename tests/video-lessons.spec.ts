import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const originalLessons = JSON.parse(readFileSync(new URL('./fixtures/original-essay-lessons.json', import.meta.url), 'utf8')) as {
  title: string; learningFocus: string; videoUrl: string; order: number;
}[];
const subjects = [
  { name: 'English Essay Writing', route: '/grade-7-8-9-essay-writing' },
  { name: 'Math', route: '/video-lessons/math' },
  { name: 'Grammar', route: '/video-lessons/grammar' }
];

for (const route of ['/', '/shop.html', ...subjects.map(subject => subject.route)]) {
  test(`subject dropdown and navigation on ${route}`, async ({ page, isMobile }) => {
    expect((await page.goto(route))?.status()).toBe(200);
    const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
    const toggle = navigation.locator('summary');
    await expect(toggle).toHaveText('Video Lessons ▾');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    if (isMobile) await toggle.tap();
    else await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = navigation.locator('#video-subject-menu');
    await expect(menu.getByRole('link')).toHaveCount(3);
    for (const subject of subjects) {
      await expect(menu.getByRole('link', { name: subject.name, exact: true })).toHaveAttribute('href', subject.route);
    }
    await menu.getByRole('link', { name: 'Math', exact: true }).click();
    await expect(page).toHaveURL(/\/video-lessons\/math$/);
    await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
  });
}

test('keyboard disclosure, focus return, tab exit and outside click', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('navigation', { name: 'Main navigation', exact: true }).locator('summary');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  const menu = page.locator('#video-subject-menu');
  await expect(menu.getByRole('link', { name: 'English Essay Writing' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('link', { name: 'Math', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).not.toBeVisible();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  for (let index = 0; index < 4; index++) await page.keyboard.press('Tab');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('all original 24 lessons, titles, learning focus and video links are preserved', async ({ page }) => {
  await page.goto('/grade-7-8-9-essay-writing');
  await expect(page).toHaveTitle('Grade 7/8/9 English Essay Writing Videos | iLEAP Academy');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ileapacademy.com/grade-7-8-9-essay-writing');
  await expect(page.getByRole('columnheader', { name: 'Learning Focus', exact: true })).toHaveCount(1);
  const rows = await page.locator('tbody tr').evaluateAll(elements => elements.map(row => ({
    order: Number(row.children[0].textContent),
    title: row.children[1].textContent,
    learningFocus: row.children[2].textContent,
    videoUrl: row.querySelector('a')?.getAttribute('href')
  })));
  expect(rows).toEqual(originalLessons);
  await expect(page.getByText('Writing Focus', { exact: true })).toHaveCount(0);
  await expect(page.getByText('How to add more videos:', { exact: false })).toHaveCount(0);
  expect((await page.goto('/grade-7-8-9-essay-writing.html'))?.status()).toBe(200);
  await expect(page.locator('tbody tr')).toHaveCount(24);
});

test('subject selector highlights each destination with SEO and polished coming soon states', async ({ page }) => {
  await page.goto('/grade-7-8-9-essay-writing');
  for (const subject of [subjects[1], subjects[2], subjects[0]]) {
    const selector = page.getByRole('navigation', { name: 'Video lesson subjects', exact: true });
    await expect(selector.getByRole('link')).toHaveCount(3);
    await selector.getByRole('link', { name: subject.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${subject.route}$`));
    await expect(page.getByRole('navigation', { name: 'Video lesson subjects', exact: true }).locator('[aria-current="page"]')).toHaveText(subject.name);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://ileapacademy.com${subject.route}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    if (subject.name !== 'English Essay Writing') {
      await expect(page).toHaveTitle(`${subject.name} Video Lessons | iLEAP Academy`);
      await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
      await expect(page.locator('table')).toHaveCount(0);
    }
  }
});

test('pages, open dropdown, and lesson cards fit the viewport', async ({ page }, testInfo) => {
  for (const subject of subjects) {
    await page.goto(subject.route);
    await page.getByRole('navigation', { name: 'Main navigation', exact: true }).locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (subject.name === 'English Essay Writing') {
      await page.screenshot({ path: testInfo.outputPath('essay-lessons.png'), fullPage: true });
    } else if (subject.name === 'Math') {
      await page.screenshot({ path: testInfo.outputPath('math-coming-soon.png'), fullPage: true });
    }
  }
});

test('lessons and native subject navigation work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/grade-7-8-9-essay-writing`);
  await expect(page.locator('tbody tr')).toHaveCount(24);
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await navigation.locator('summary').click();
  await navigation.getByRole('link', { name: 'Grammar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
  await context.close();
});

test('navigation and subjects fit a narrow 320px mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ['/', ...subjects.map(subject => subject.route)]) {
    await page.goto(route);
    await page.getByRole('navigation', { name: 'Main navigation', exact: true }).locator('summary').click();
    const layout = await page.evaluate(() => ({
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right }))
    }));
    expect(layout.documentWidth, `${route}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.width);
  }
});
