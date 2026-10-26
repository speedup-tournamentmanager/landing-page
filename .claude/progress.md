# Progress — Speedup landing page

## Now
- Schedule. (Master Schedule) and Call. (Court Board) sections added to index.html, each with
  an "At the table" / "Venue screen" tab pair + 4 new assets/*.webp. Pushed to main (b7d083c),
  Pages is building; check the live site once it is up.
- GA4 behind a consent banner is pushed to main (a2029ac), Pages is building.
  Files: index.html (banner, loader, events), privacy.html (new), sitemap.xml.

## Next
- [ ] Test the live site: fresh private window, no googletagmanager request before Accept,
      then Analytics Realtime and Admin > DebugView (generate_lead)
- [ ] In GA: mark generate_lead and contact_click as key events once they show under
      Admin > Events
- [ ] Review privacy.html wording (no legal name/address on it yet)

## Done (latest first, max 10)
- 2026-10-26 Consent banner restyled: page font for the title (no Playball), no green left border,
  ball logo removed (assets/speedup-ball.png itself left in place); in b7d083c
- 2026-10-25 Added Schedule. + Call. sections after Play (ids #schedule, #courts); shots from a
  scratch SQLite Rizal Cup, staged mid-afternoon; tab script now per-tablist; checked 375/768/1440
- 2026-10-23 GA data retention set to 14 months (event and user data), reset-on-activity on
- 2026-10-23 Pushed a2029ac to origin/main; Measurement ID G-JPREMJE6Y8 confirmed by user
- 2026-10-23 GA4 (G-JPREMJE6Y8) loads only after Accept; events demo_open, generate_lead,
  contact_click; Cookie settings + Privacy links in footer; privacy.html; sitemap entry
- 2026-10-23 Created GA account/property/web stream for speeduppb.com (done by user in Google)

## Decisions
- Master Schedule and Court Board get one section each with two tabs (normal view / display
  mode), reusing .tie-tabs; tab JS selects `.tie-tabs[role="tablist"]` so groups stay separate
  (2026-10-25)
- GA script and cookies load only after Accept, nothing otherwise — simplest and strictest;
  no Consent Mode modelling (2026-10-23)
- generate_lead sends only the dropdown category, never name/email/message — keeps personal
  data out of GA (2026-10-23)
- Consent code is inline in index.html; privacy.html runs no GA and links to ./#cookie-settings
  — avoids adding a 4th file (2026-10-23)
- Google signals, ad storage and GA data-sharing toggles are off — no ads on this site (2026-10-23)
- Commit a2029ac also contains older uncommitted re-wrapping of index.html (formatting only,
  no content change); left as is (2026-10-23)

## Open questions
- Legal name / address to put on privacy.html?
- hCaptcha and Web3Forms load without consent (disclosed in the policy) — acceptable?
- Old empty GA property "dasd" could not be trashed (internal error); harmless, retry later
