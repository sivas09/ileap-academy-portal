import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { subjects, subjectPage, videoDropdown } from './video-lesson-components.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const lessons = JSON.parse(await readFile(resolve(root, 'content/video-lessons.json'), 'utf8'));
const orders = new Set();
for (const lesson of lessons) {
  if (!subjects.some(subject => subject.id === lesson.subject) ||
      !['grade', 'title', 'learningFocus', 'videoUrl'].every(field => typeof lesson[field] === 'string' && lesson[field].trim()) ||
      !Number.isInteger(lesson.order) || lesson.order < 1 || orders.has(`${lesson.subject}:${lesson.order}`) ||
      new URL(lesson.videoUrl).protocol !== 'https:') {
    throw new Error(`Invalid lesson: ${JSON.stringify(lesson)}`);
  }
  orders.add(`${lesson.subject}:${lesson.order}`);
}

async function emit(file, content) {
  const path = resolve(root, file);
  if (check) {
    const existing = await readFile(path, 'utf8');
    if (existing.replaceAll('\r\n', '\n') !== content.replaceAll('\r\n', '\n')) {
      throw new Error(`${file} is stale; run npm run build:public`);
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

for (const subject of subjects) {
  const html = subjectPage(subject, lessons.filter(lesson => lesson.subject === subject.id));
  await emit(`public-site/${subject.file}`, html);
  // Preserve the original standalone essay artifact as well as the public site's copy.
  if (subject.id === 'english-essay-writing') await emit(subject.file, html);
}

for (const file of ['index.html', 'shop.html']) {
  let html = await readFile(resolve(root, 'public-site', file), 'utf8');
  const dropdown = `<!-- video-navigation:start -->\n      ${videoDropdown()}\n      <!-- video-navigation:end -->`;
  if (html.includes('<!-- video-navigation:start -->')) {
    html = html.replace(/<!-- video-navigation:start -->[\s\S]*?<!-- video-navigation:end -->/, dropdown);
  } else {
    const existing = '<a href="./grade-7-8-9-essay-writing.html">Video Lessons</a>';
    if (!html.includes(existing)) throw new Error(`Missing navigation insertion point in ${file}`);
    html = html.replace(existing, dropdown);
  }
  if (!html.includes('src="/video-navigation.js"')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="/video-navigation.css" />\n    <script src="/video-navigation.js" defer></script>\n  </head>');
  }
  await emit(`public-site/${file}`, html);
}
console.log(check ? 'Public video lesson pages are up to date.' : 'Public video lesson pages generated.');
