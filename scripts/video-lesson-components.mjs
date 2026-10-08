export const subjects = [
  {
    id: 'english-essay-writing', label: 'English Essay Writing',
    route: '/grade-7-8-9-essay-writing', file: 'grade-7-8-9-essay-writing.html',
    title: 'Grade 7/8/9 English Essay Writing Videos | iLEAP Academy',
    description: 'Grade 7/8/9 English Essay Writing video lessons for iLEAP Academy students. Topics include thesis writing, essay structure, introductions, conclusions, evidence, academic vocabulary, grammar, and revision.',
    eyebrow: 'Grade 7/8/9 English Essay Writing',
    heading: 'Essay writing video library for advanced middle school writers.',
    lead: 'Use these lessons to strengthen topic analysis, brainstorming, thesis writing, essay structure, evidence, academic vocabulary, grammar, editing, and revision.'
  },
  {
    id: 'grammar', label: 'Grammar', route: '/video-lessons/grammar', file: 'video-lessons/grammar/index.html',
    title: 'Grammar Video Lessons | iLEAP Academy',
    description: 'Watch iLEAP Academy’s Grammar video lessons for Grades 7/8/9. Learn punctuation, capitalization, parts of speech, sentence structure, subject–verb agreement, and more.',
    eyebrow: 'Grammar Video Lessons', heading: 'Stronger sentences start with clear grammar.',
    lead: 'A dedicated space to strengthen sentence structure, punctuation, and everyday language skills.'
  },
  {
    id: 'math', label: 'Math', route: '/video-lessons/math', file: 'video-lessons/math/index.html',
    title: 'Math Video Lessons | iLEAP Academy',
    description: 'Explore iLEAP Academy’s Math video lessons by grade band: Grade 5/6, Grade 7/8, Grade 9/10, and Grade 11/12.',
    eyebrow: 'Math Video Lessons', heading: 'Build confidence in math, one lesson at a time.',
    lead: 'A dedicated space for clear explanations, worked examples, and mathematical problem solving.'
  }
];

export const mathGradeBands = ['5-6', '7-8', '9-10', '11-12'].map(id => {
  const label = `Grade ${id.replace('-', '/')}`;
  const route = `/video-lessons/math/grade-${id}`;
  return {
    id: 'math', gradeBand: id, label, route, file: `${route.slice(1)}/index.html`,
    title: `${label} Math Video Lessons | iLEAP Academy`,
    description: `Explore iLEAP Academy’s ${label} Math video lessons to build mathematical understanding and problem-solving confidence.`,
    eyebrow: `${label} Math`, heading: `${label} Math Video Lessons`,
    lead: 'Watch lessons in order or revisit a topic to strengthen your understanding.'
  };
});

export function mathGradeNavigation(current) {
  return `<nav class="grade-navigation" aria-label="Math grade bands">${mathGradeBands.map(band => `<a href="${band.route}"${current === band.gradeBand ? ' aria-current="page"' : ''}>${band.label}</a>`).join('\n      ')}</nav>`;
}

export function mathLanding(lessons) {
  return `<section aria-labelledby="grade-bands-title">
      <h2 id="grade-bands-title">Choose your grade band</h2>
      <div class="grade-cards">${mathGradeBands.map(band => {
        const count = lessons.filter(lesson => lesson.gradeBand === band.gradeBand).length;
        return `<a class="panel grade-card" href="${band.route}"><h3>${band.label}</h3><p>${count ? `${count} lessons` : 'Coming soon'}</p><span>${count ? 'View lessons' : 'View grade band'} <span aria-hidden="true">→</span></span></a>`;
      }).join('\n        ')}</div>
    </section>`;
}

export function mathComingSoon(band) {
  return `<section class="panel coming-soon" aria-labelledby="coming-soon-title">
      <p class="eyebrow">${band.label} Math Video Library</p>
      <h2 id="coming-soon-title">Coming soon</h2>
      <p>New ${band.label} Math video lessons will be available here as they are added to the library.</p>
      <p>While you wait, explore our available Math lessons.</p>
      <div class="coming-soon-actions">
        <a class="button primary" href="/video-lessons/math/grade-5-6">Explore Grade 5/6 Math</a>
        <a class="button primary" href="/video-lessons/math/grade-7-8">Explore Grade 7/8 Math</a>
      </div>
    </section>`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function subjectLinks(current) {
  return subjects.map(subject => `<a href="${subject.route}"${current === subject.id ? ' aria-current="page"' : ''}>${subject.label}</a>`);
}

export function videoDropdown(current) {
  return `<details class="video-dropdown">
        <summary aria-controls="video-subject-menu">Video Lessons <span aria-hidden="true">▾</span></summary>
        <ul id="video-subject-menu" class="video-subject-menu">
          ${subjectLinks(current).map(link => `<li>${link}</li>`).join('\n          ')}
        </ul>
      </details>`;
}

export function subjectNavigation(current) {
  return `<nav class="subject-navigation" aria-label="Video lesson subjects">${subjectLinks(current).join('\n      ')}</nav>`;
}

export function lessonRow(lesson) {
  return `<tr>
          <td class="lesson-number" data-label="Lesson">${String(lesson.order).padStart(2, '0')}</td>
          <td class="topic" data-label="Topic">${escapeHtml(lesson.title)}</td>
          <td data-label="Learning Focus">${escapeHtml(lesson.learningFocus)}</td>
          <td class="watch" data-label="Video"><a href="${escapeHtml(lesson.videoUrl)}" aria-label="${escapeHtml(`Watch ${lesson.title}`)}">Watch</a></td>
        </tr>`;
}

export function lessonTable(lessons) {
  return `<section class="panel" aria-labelledby="lessons-title">
      <div class="table-header">
        <h2 id="lessons-title">Video Lessons</h2>
        <p>Watch lessons in order or review a specific learning skill.</p>
      </div>
      <table role="table" aria-label="Video lessons">
        <thead><tr><th scope="col">Lesson</th><th scope="col">Topic</th><th scope="col">Learning Focus</th><th scope="col">Video</th></tr></thead>
        <tbody>
        ${[...lessons].sort((a, b) => a.order - b.order).map(lessonRow).join('\n        ')}
        </tbody>
      </table>
    </section>`;
}

export function comingSoon(subject) {
  return `<section class="panel coming-soon" aria-labelledby="coming-soon-title">
      <p class="eyebrow">${subject.label} Video Library</p>
      <h2 id="coming-soon-title">Coming soon</h2>
      <p>New ${subject.label.toLowerCase()} video lessons will be available here as they are added to the library.</p>
      <p>While you wait, explore our English Essay Writing lessons or book a free trial class.</p>
      <div class="coming-soon-actions">
        <a class="button primary" href="/grade-7-8-9-essay-writing">Explore Essay Writing Lessons</a>
        <a class="button trial" href="https://forms.gle/9z8NPfYuaZfBDWEL7">Book a Free Trial Class</a>
      </div>
    </section>`;
}

export function subjectPage(subject, lessons) {
  let content = lessons.length ? lessonTable(lessons) : comingSoon(subject);
  if (subject.id === 'math') {
    content = subject.gradeBand
      ? (lessons.length ? lessonTable(lessons) : mathComingSoon(subject))
      : mathLanding(lessons);
    content = `${mathGradeNavigation(subject.gradeBand)}\n    ${content}`;
  }
  return `<!doctype html>
<!-- Generated by npm run build:public. Edit content/video-lessons.json and scripts/video-lesson-components.mjs. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject.title)}</title>
  <meta name="description" content="${escapeHtml(subject.description)}">
  <link rel="canonical" href="https://ileapacademy.com${subject.route}">
  <link rel="icon" href="/Logo_large.jpg">
  <link rel="stylesheet" href="/video-lessons.css">
  <link rel="stylesheet" href="/video-navigation.css">
  <script src="/video-navigation.js" defer></script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="iLEAP Academy home">
      <img src="/Logo_large.jpg" alt="iLEAP Academy logo">
      <span>iLEAP Academy</span>
    </a>
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
      <a href="/shop.html">Shop</a>
      ${videoDropdown(subject.id)}
      <a class="button trial" href="https://forms.gle/9z8NPfYuaZfBDWEL7">Book a Free Trial Class</a>
      <a class="button primary" href="https://english.ileapacademy.com/">Student Portal</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <div>
        <p class="eyebrow">${escapeHtml(subject.eyebrow)}</p>
        <h1>${escapeHtml(subject.heading)}</h1>
        <p class="lead">${escapeHtml(subject.lead)}</p>
      </div>
      <div class="actions">
        <a class="button trial" href="https://forms.gle/9z8NPfYuaZfBDWEL7">Book a Free Trial Class</a>
        <a class="button primary" href="https://english.ileapacademy.com/">Portal Login</a>
      </div>
    </section>
    ${subjectNavigation(subject.id)}
    ${content}
  </main>
  <footer>
    <img src="/Logo_large.jpg" alt="">
    <span>iLEAP Academy</span>
    <a href="mailto:ileap.academy.icat@gmail.com">ileap.academy.icat@gmail.com</a>
    <span>|</span>
    <a href="https://wa.me/16138168567">+1-613-816-8567</a>
    <a href="/shop.html">Shop</a>
  </footer>
</body>
</html>
`;
}
