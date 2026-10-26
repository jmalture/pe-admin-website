# pe-admin-website

Redesign of [pe-admin.de](https://pe-admin.de) (PE Admin GmbH) by Alture: a German one-pager plus Impressum and
Datenschutz, built with [Astro](https://astro.build) (static pages + one Node endpoint for the contact form).

## Commands
```
npm install
npm run dev       # http://localhost:4321
npm run build
npm start         # serves dist (needs a build first)
```

## Deployment (Hostinger Node.js app, linked via GitHub)
Build `npm run build`, output directory `dist`, entry file `server/entry.mjs`, Node 22.
Environment variables for the form: see `.env.example`.

Texts: `src/i18n/site.json`. Legal texts: `src/content/legal/`. Status and open points: `docs/STATUS.md`.
Agent handover: `CLAUDE.md`.
