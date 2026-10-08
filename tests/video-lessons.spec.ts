import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const originalLessons = JSON.parse(readFileSync(new URL('./fixtures/original-essay-lessons.json', import.meta.url), 'utf8')) as {
  title: string; learningFocus: string; videoUrl: string; order: number;
}[];
const lessonData = JSON.parse(readFileSync(new URL('../content/video-lessons.json', import.meta.url), 'utf8')) as {
  subject: string; grade?: string; gradeBand?: string; title: string; learningFocus: string; videoUrl: string; order: number;
}[];
const subjects = [
  { id: 'english-essay-writing', name: 'English Essay Writing', route: '/grade-7-8-9-essay-writing' },
  { id: 'grammar', name: 'Grammar', route: '/video-lessons/grammar' },
  { id: 'math', name: 'Math', route: '/video-lessons/math' }
];
const gradeBands = ['5-6', '7-8', '9-10', '11-12'].map((id, index) => ({
  id, name: `Grade ${id.replace('-', '/')}`, route: `/video-lessons/math/grade-${id}`, count: [7, 14, 0, 0][index]
}));

async function expectMathLanding(page: Page) {
  await expect(page.getByRole('heading', { name: 'Choose your grade band' })).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.locator('.grade-card')).toHaveCount(4);
  for (const band of gradeBands) {
    const card = page.locator('.grade-card').filter({ has: page.getByRole('heading', { name: band.name, exact: true }) });
    await expect(card).toHaveAttribute('href', band.route);
    await expect(card).toContainText(band.count ? `${band.count} lessons` : 'Coming soon');
  }
  await expectGradeNavigation(page);
}

async function expectGradeNavigation(page: Page, current?: string) {
  const nav = page.getByRole('navigation', { name: 'Math grade bands', exact: true });
  await expect(nav.getByRole('link')).toHaveCount(4);
  for (const band of gradeBands) {
    await expect(nav.getByRole('link', { name: band.name, exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: band.name, exact: true })).toHaveAttribute('href', band.route);
  }
  if (current) await expect(nav.locator('[aria-current="page"]')).toHaveText(gradeBands.find(band => band.id === current)!.name);
  else await expect(nav.locator('[aria-current]')).toHaveCount(0);
}

async function expectSubjectContent(page: Page, subjectId: string, gradeBand?: string) {
  if (subjectId === 'math' && !gradeBand) return expectMathLanding(page);
  const lessons = lessonData.filter(lesson => lesson.subject === subjectId && (!gradeBand || lesson.gradeBand === gradeBand)).sort((a, b) => a.order - b.order);
  if (!lessons.length) {
    await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    return;
  }
  await expect(page.getByRole('heading', { name: 'Coming soon' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Learning Focus', exact: true })).toHaveCount(1);
  const rows = await page.locator('tbody tr').evaluateAll(elements => elements.map(row => ({
    order: Number(row.children[0].textContent), title: row.children[1].textContent,
    learningFocus: row.children[2].textContent, videoUrl: row.querySelector('a')?.getAttribute('href')
  })));
  expect(rows).toEqual(lessons.map(({ order, title, learningFocus, videoUrl }) => ({ order, title, learningFocus, videoUrl })));
}

for (const route of ['/', '/shop.html', ...subjects.map(subject => subject.route), ...gradeBands.map(band => band.route)]) {
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
    await expect(menu.getByRole('link')).toHaveText(['English Essay Writing', 'Grammar', 'Math']);
    for (const subject of subjects) {
      await expect(menu.getByRole('link', { name: subject.name, exact: true })).toHaveAttribute('href', subject.route);
    }
    await menu.getByRole('link', { name: 'Math', exact: true }).click();
    await expect(page).toHaveURL(/\/video-lessons\/math$/);
    await expectSubjectContent(page, 'math');
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
  await expect(menu.getByRole('link', { name: 'Grammar', exact: true })).toBeFocused();
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

test('subject selector highlights each destination with SEO and the appropriate lesson or coming soon state', async ({ page }) => {
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
    }
    await expectSubjectContent(page, subject.id);
  }
});

test('pages, open dropdown, and lesson cards fit the viewport', async ({ page }, testInfo) => {
  let essayColumns: { width: number; padding: string }[] = [];
  for (const subject of subjects) {
    await page.goto(subject.route);
    await page.getByRole('navigation', { name: 'Main navigation', exact: true }).locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (page.viewportSize()!.width > 800 && subject.id !== 'math') {
      const columns = await page.locator('thead th').evaluateAll(cells => cells.map(cell => ({
        width: cell.getBoundingClientRect().width, padding: getComputedStyle(cell).padding
      })));
      if (subject.id === 'english-essay-writing') essayColumns = columns;
      else expect(columns).toEqual(essayColumns);
    }
    if (subject.name === 'English Essay Writing') {
      await page.screenshot({ path: testInfo.outputPath('essay-lessons.png'), fullPage: true });
    } else if (subject.name === 'Math') {
      await page.screenshot({ path: testInfo.outputPath('math-landing.png'), fullPage: true });
    } else if (subject.name === 'Grammar') {
      await page.screenshot({ path: testInfo.outputPath('grammar-lessons.png'), fullPage: true });
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
  await expectSubjectContent(page, 'grammar');
  await page.getByRole('navigation', { name: 'Video lesson subjects', exact: true }).getByRole('link', { name: 'Math', exact: true }).click();
  await expectMathLanding(page);
  await page.locator('.grade-card').first().click();
  for (const band of gradeBands) {
    await page.getByRole('navigation', { name: 'Math grade bands', exact: true }).getByRole('link', { name: band.name, exact: true }).click();
    await expectGradeNavigation(page, band.id);
    await expectSubjectContent(page, 'math', band.id);
  }
  await context.close();
});

test('the 12 supplied Grammar lessons retain their grade, sequential order and exact YouTube links', async ({ page }) => {
  const grammar = lessonData.filter(lesson => lesson.subject === 'grammar');
  expect(grammar).toHaveLength(12);
  expect(grammar.map(lesson => lesson.grade)).toEqual(Array(12).fill('7/8/9'));
  expect(grammar.map(lesson => lesson.order)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
  expect(grammar.map(lesson => lesson.videoUrl)).toEqual([
    'https://youtu.be/9Dw3O937wCo', 'https://youtu.be/GueL75BjKmY',
    'https://youtu.be/mBGuAZM-ncQ', 'https://youtu.be/j9CBBQ0MTUI',
    'https://youtu.be/ZJ_B1s-W7Sg', 'https://youtu.be/w4bXV5Pe9_4',
    'https://youtu.be/rbqrOiUGBeU', 'https://youtu.be/wyzoB4ClIGg',
    'https://youtu.be/AeS9Y-c3YH0', 'https://youtu.be/TcnQn7d74HY',
    'https://youtu.be/Jx_ZZ8HDdgM', 'https://youtu.be/2Bb35sXfxnU'
  ]);
  await page.goto('/video-lessons/grammar');
  await expectSubjectContent(page, 'grammar');
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', /coming soon/i);
});

test('navigation and subjects fit a narrow 320px mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ['/', '/shop.html', ...subjects.map(subject => subject.route), ...gradeBands.map(band => band.route)]) {
    await page.goto(route);
    await page.getByRole('navigation', { name: 'Main navigation', exact: true }).locator('summary').click();
    const layout = await page.evaluate(() => ({
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right }))
    }));
    expect(layout.documentWidth, `${route}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.width);
  }
});

for (const band of gradeBands) {
  test(`${band.name} Math isolates lessons and supports both slash forms`, async ({ page }, testInfo) => {
    for (const suffix of ['', '/']) {
      expect((await page.goto(band.route + suffix))?.status()).toBe(200);
      await expect(page).toHaveTitle(`${band.name} Math Video Lessons | iLEAP Academy`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://ileapacademy.com${band.route}`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', new RegExp(band.name));
      await expectGradeNavigation(page, band.id);
      await expectSubjectContent(page, 'math', band.id);
      await expect(page.locator('tbody tr')).toHaveCount(band.count);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (!band.count) {
        await expect(page.locator('.coming-soon')).toContainText(`${band.name} Math`);
        await expect(page.locator('.coming-soon').getByRole('link')).toHaveCount(2);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`math-${band.id}.png`), fullPage: true });
  });
}

test('Math landing supports trailing slash and keyboard grade navigation', async ({ page }) => {
  expect((await page.goto('/video-lessons/math/'))?.status()).toBe(200);
  await expectMathLanding(page);
  const nav = page.getByRole('navigation', { name: 'Math grade bands', exact: true });
  await nav.getByRole('link').first().focus();
  await expect(nav.getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Grade 7/8', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/video-lessons\/math\/grade-7-8$/);
  await expectGradeNavigation(page, '7-8');
  await expectSubjectContent(page, 'math', '7-8');
});

test('all 21 Math lessons retain the approved titles, band order and exact YouTube links', () => {
  const expected = {
    '5-6': [
      ['Decimal Addition & Place Value', 'IBtIlnDtv3Y'], ['Types of Triangles', 'C3Fm_oHndM4'],
      ['Perimeter', 'lLzOUVal_0M'], ['Shaded Rectangle Area', 'XH3XOAQr0Bs'],
      ['Triangle Hidden Rules', 'NMxhdosgcqw'], ['Geometry Logic', 'ys2clRyzdY8'], ['Combination', 'QS7yiHp7ZsE']
    ],
    '7-8': [
      ['Absolute Value – Part 1', 'n7fVF1_jPhY'], ['Absolute Value – Part 2', 'cc4wCzkIidA'],
      ['Exponents – Part 1', 'G81P_rAIaXc'], ['Exponents – Part 2', 'o5md9MnH_Kc'], ['Square Roots', 'sZPjolkKnOg'],
      ['Radicals – Part 1', 'jgQ_PPzpDRw'], ['Radicals – Part 2: Higher Roots', 'C9H02hqJIis'],
      ['Radicals – Part 3: Adding & Subtracting', '7AXYY05jXcA'], ['Radicals – Part 4: Multiplying & Dividing', '0hhFlfFPrO4'],
      ['Scientific Notation', 'AGD3Dy8HcTA'], ['Cross Multiplication', 'OCMSYDf5Gf8'], ['Inequalities', 'VUv8ldd7zps'],
      ['Parallel Lines & Angles', '0Z39BcMr3tI'], ['Geometry Q10', '7BIIkPKeaFk']
    ]
  };
  const math = lessonData.filter(lesson => lesson.subject === 'math');
  expect(math).toHaveLength(21);
  expect(new Set(math.map(lesson => new URL(lesson.videoUrl).pathname)).size).toBe(21);
  for (const [gradeBand, lessons] of Object.entries(expected)) {
    expect(math.filter(lesson => lesson.gradeBand === gradeBand).map(({ title, videoUrl, order }) => ({ title, videoUrl, order })))
      .toEqual(lessons.map(([title, id], index) => ({ title, videoUrl: `https://youtu.be/${id}`, order: index + 1 })));
  }
});
