# Status (2026-10-26)

## Done (showcase, awaiting Honza's review)
- One-pager: particle hero with logo formation · Über uns (lit intro, puzzle scene, 3 cards) · Leistungen (flow
  scene + selectable module board, Full-Service switch) · authorities band · founder · Kontakt (form with module
  chips, channels, "Münchner Westen" drawing) · footer.
- Impressum 1:1 from pe-admin.de (headings added for readability: "Angaben gemäß § 5 DDG", "Haftung für
  Inhalte", "Haftung für Links", "Urheberrecht").
- Datenschutzerklärung: **demo draft** (shown with a draft note on the page). Facts used: hosting at Hostinger
  International Ltd. (Larnaca, Cyprus), no cookies/tracking/external services, self-hosted fonts, contact form,
  BayLDA as authority. PE Admin must review it; the video-conference tool is a placeholder.
- Feedback round 1 (26.10.): Über uns cards with live navy scenes (AboutCard.astro); header always visible,
  compact (80 → 60 px) once scrolled, dark glass over full-width dark sections; calm spark field in the footer;
  hero: sparks glide (eased, no spring wobble) into the real PE mark (white P, blue E-bars, sampled from the logo
  paths); bokeh discs replaced by fine dust + slow light rays from the mark and a richer night gradient; hero
  kicker shows the real P/E symbol.
- Contact endpoint `/api/contact` (stores to `data/submissions`, mails once SMTP env vars are set).

## New copy (not on pe-admin.de, needs client approval)
- Über uns card labels: "Unser Team", "Full-Service oder Module", "Münchner Westen".
- Leistungen: heading "Full-Service oder einzelne Module.", the hint sentence, board labels (Full-Service,
  Auswählen/Ausgewählt, counter, "Anfrage mit Auswahl"); flow scene labels Fonds, Bundesbank, BaFin, BZSt, Investoren.
- Kontakt: heading "Wie können wir Sie entlasten?", "Ihre Auswahl" box (button "Module auswählen" / link
  "Auswahl ändern", jumps back to the module board), consent sentence, "So erreichen Sie uns",
  "Termin per E-Mail oder Telefon vereinbaren", "Besprechungsräume in München für Meetings" (from the Über uns text).
- Footer claim "Fondsadministration für Private Equity und Venture Capital."
- Hero: the claim sentence is split into headline + lead (wording unchanged).

## Open
- **Address**: Impressum says Römerstr. 111, 82205 Gilching; the commercial register (HRB 285307, published
  08.01.2024) lists Am Bergerfeld 35, 85617 Aßling. Client to confirm; Impressum + Datenschutz + FIRM data follow.
- Datenschutz review by the client (and their video-conference tool).
- SMTP mailbox for the form (Honza to provide), then set env vars in Hostinger.
- Deploy as showcase on Hostinger; later domain switch from WordPress (`hostinger:connect-domain`).
