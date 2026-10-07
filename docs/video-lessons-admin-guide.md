# Public video lessons

The public website is static and lives in `public-site/`. The React portal is a separate application.

## Update lessons

Edit `content/video-lessons.json`. Each entry has:

- `subject`: `english-essay-writing`, `math`, or `grammar`
- `grade`: a grade label such as `7/8/9`
- `title`: the lesson title
- `learningFocus`: what the student will learn
- `videoUrl`: the existing HTTPS video URL
- `order`: a positive integer, unique within its subject

Run `npm run build:public`, then `npm test` and `npm run check:public`.
Commit the generated pages with the data change. Do not hand-edit generated lesson rows.
Subjects without lessons automatically show the coming-soon component; adding their first entry produces the shared lesson table.

The reusable HTML components and subject metadata are in `scripts/video-lesson-components.mjs`.
The lesson design is in `public-site/video-lessons.css`; disclosure styles and behavior are in `public-site/video-navigation.css` and `.js`.
The existing homepage and shop retain their headers; the generator updates only the marked video-navigation region.

## Static hosting and routes

Deploy the complete `public-site/` directory using the existing static hosting workflow.
Generated files are committed, so the existing deployment with an empty build command continues to work.
Optionally set the static-site build command to `npm run build:public`.

- `/grade-7-8-9-essay-writing`: existing essay route, backed by `grade-7-8-9-essay-writing.html` on hosts with clean HTML URLs.
- `/grade-7-8-9-essay-writing.html`: retained for existing direct links.
- `/video-lessons/math`: backed by `video-lessons/math/index.html`.
- `/video-lessons/grammar`: backed by `video-lessons/grammar/index.html`.

Directory routes also work with trailing slashes. Assets use absolute paths so nested pages resolve them correctly.
Keep the existing host's essay URL mapping. If uploading to an Apache/SiteGround host without clean HTML URLs, configure only the essay route to serve `grade-7-8-9-essay-writing.html`; do not overwrite WordPress or unrelated rewrite rules.
The repository-root essay HTML is a synchronized legacy artifact; deploy it with the shared assets from `public-site/`, rather than uploading it alone.

## Validation and preview

`npm run preview:public` serves the public site locally at `http://127.0.0.1:5186`.
This is a development utility, not a production backend.

`npm test` runs Playwright against desktop, tablet, and mobile layouts using installed Google Chrome.
The tests cover the 24 original lesson entries, old and clean URLs, subject switching, SEO, click/touch/keyboard dropdown behavior, overflow, and operation without JavaScript.
Screenshots are saved in `test-results/` and ignored by Git.

There is no existing lint configuration in this repository. `npm run check:public` checks generated output and public JavaScript syntax; `npm run typecheck`, `npm run build`, and `npm run build:server` validate the existing portal.
