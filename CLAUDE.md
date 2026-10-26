# CLAUDE.md: pe-admin-website

Handover for Claude Code agents. Read this first, then `README.md`, `docs/BRAND.md`, `docs/STATUS.md`.

## What this is
Redesign of **pe-admin.de** (PE Admin GmbH, fund administration for PE/VC funds, Gilching / Munich west).
The live site is a WordPress/Elementor one-pager that Alture built in 2024. This rebuild is first deployed as a
**showcase** to pitch it to the client, and will then replace the live site.
Built by Alture (Honza / Jan Matyáš) on the shared Astro stack (`sdx-website`, `jenomics-website`,
`amaze_genius`, `BLL_website`): Astro 7, static pages + `@astrojs/node` for `/api/contact`, CSS inlined,
self-hosted fonts, no CMS. **German only** (like the live site).

Pages: `/` (one-pager: Hero, Über uns, Leistungen, Band, Founder, Kontakt), `/impressum/`, `/datenschutz/`.
Repo: https://github.com/jmalture/pe-admin-website (branch `main`). Scrape of the live site (HTML, CSS, media):
`Documents\PE-Admin\pe-admin-scrape\` on Honza's PC (the container cannot reach pe-admin.de).

## Commands
```
npm install
npm run dev       # http://localhost:4321
npm run build     # must pass before every push
npm start         # serves the build (node dist/server/entry.mjs)
npm run format
```
Hostinger: framework Astro, build `npm run build`, output directory `dist`, entry file `server/entry.mjs`, Node 22.
Do not switch Astro to `output: 'server'`. SMTP env vars: `.env.example` (recipient info@pe-admin.de).

## Structure
```
src/pages/{index,impressum,datenschutz}         routes
src/components/home/NN-name.astro                 01 hero · 02 about · 03 services · 04 band · 05 founder · 06 contact
src/scripts/particles.ts                          hero + footer light particles (canvas) incl. the PE mark formation
src/components/ui/logo-paths.ts                   logo path data, shared by Logo.astro and the particle formation
src/components/home/AboutCard.astro               Über uns cards with live scenes (team / modules / place)
src/components/{Header,Footer}.astro              anchor nav + phone + drawer; navy footer
src/components/ui/{Logo,Icon}.astro               vectorised logo (dark parts = currentColor; `mark` = P/E only)
src/templates/Legal.astro + src/content/legal/    Impressum (1:1) and Datenschutz (DEMO DRAFT)
src/i18n/site.json, index.ts                      all texts (DE), FIRM data
src/styles/site.css, src/scripts/site.ts          tokens, buttons, reveal, scroll-lit words / shared behaviour
src/pages/api/contact.ts                          form endpoint (honeypot, rate limit, store before mail; + modules)
```

## Decisions (keep these)
- Content 1:1 from pe-admin.de; new microcopy is listed in `docs/STATUS.md` and needs client approval.
- **Hero = pure particle field** (Honza): no stock photos. The light particles imitate the sparks baked into
  the two old hero photos (amber + cyan sparks, blue-grey bokeh, warm focal flare). On desktop ~860 sparks glide into
  the real PE mark (sampled from the logo paths: white P, blue E-bars) with an eased in-out blend, no spring
  (Honza found the spring wobble too much), and drift apart on scroll. **No bokeh discs** (Honza: "vibecoded");
  depth comes from a fine dust layer, slow conic light rays from the mark (`@property --pe-ray`) and the
  gradient. No cursor reaction. Footer reuses the engine (`formation: false`, low density).
- The two old hero photos became animations: puzzle pieces locking (Über uns) and the flowchart (Leistungen).
- Leistungen = selectable module board (their text offers Full-Service or single modules); the selection is
  sent with the enquiry (`pe:modules` event → hidden field `modules`).
- Signature shape: logo E-bars → "leaf" corners (`--pe-leaf`: rounded top-right + bottom-left). Section eyebrows
  (`.pe-kicker`) carry the real P/E symbol (`<Logo mark class="pe-kicker__mark" label="" />`).
- Header: fixed and always visible, compact once scrolled; dark glass only over full-width dark sections.
- Phone number is shown (Honza). Clients are addressed with "Sie".

## Gotchas
- SMIL sparks (`animateMotion` with a `begin` delay) sit at 0,0 until they start: they carry
  `visibility="hidden"` + `<set attributeName="visibility" to="visible" begin=…>`.
- `.pe-flow > svg { overflow: visible }` must stay scoped with `>`; otherwise the logo inside the flow core shows
  the whole wordmark (the `mark` variant relies on the SVG clipping to its viewBox).
- Shared gotchas (reveal attribute removal, clip-path + IntersectionObserver, `overflow: clip` for sticky):
  see the `astro-marketing-site` skill.

## Verify before pushing
`npm run build`; Playwright 1440 + 390 (scroll first; hero shots at ~3 s so the formation has gathered);
mobile `scrollWidth === 390`; click modules → check the form chips; POST `/api/contact` (valid, invalid, honeypot).
