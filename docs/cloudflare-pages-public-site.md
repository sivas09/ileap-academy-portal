# Cloudflare Pages Setup For ileapacademy.com

Date: May 21, 2026  
Scope: Simple public one-page website for `ileapacademy.com`

## What Was Built

The simple public website lives in:

`public-site/`

Files:

- `public-site/index.html`
- `public-site/styles.css`
- `public-site/Logo_large.jpg`
- `public-site/_headers`
- `public-site/robots.txt`

The page links students to:

`https://english.ileapacademy.com/`

## Recommended Hosting

Use Cloudflare Pages for `ileapacademy.com`.

Keep:

- `ileapacademy.com` on Cloudflare Pages
- `english.ileapacademy.com` on Render
- uploads on Cloudflare R2

## Option A: Deploy From GitHub

1. Log in to Cloudflare.
2. Go to `Workers & Pages`.
3. Click `Create application`.
4. Select `Pages`.
5. Select `Connect to Git`.
6. Pick the GitHub repository: `ileap-academy-portal`.
7. Set project name, for example: `ileapacademy-public-site`.
8. Build settings:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `public-site`
9. Click `Save and Deploy`.

## Custom Domain

After the Pages project is deployed:

1. Open the Cloudflare Pages project.
2. Go to `Custom domains`.
3. Add `ileapacademy.com`.
4. Add `www.ileapacademy.com`.
5. Follow Cloudflare DNS instructions.

Recommended final setup:

- `ileapacademy.com` serves the public landing page.
- `www.ileapacademy.com` redirects or also serves the same page.
- `english.ileapacademy.com` remains pointed to Render.

## SiteGround/WordPress Transition

If `ileapacademy.com` currently points to SiteGround, changing the DNS to Cloudflare Pages will stop serving the WordPress homepage.

Before switching:

1. Confirm you no longer need the WordPress homepage.
2. Keep a backup of the WordPress site.
3. Confirm email DNS records are not changed or deleted.
4. Only change web records for `ileapacademy.com` and `www`.

Do not remove MX records, SPF, DKIM, or DMARC records if email is used for the domain.

## Test Before Switching Main Domain

Cloudflare Pages gives a temporary URL like:

`https://ileapacademy-public-site.pages.dev`

Open that URL first and confirm:

- logo displays
- page looks correct on desktop and mobile
- Student Portal button opens `https://english.ileapacademy.com/`

