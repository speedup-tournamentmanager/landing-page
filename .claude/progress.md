# Progress — Speedup landing page

## Now
- Messenger button pushed (c2912f1), Pages building. Look + motion pass (d1adf7f) is live; still
  eyeball hero tilt, panel grow, screenshot draw-in, FAQ slide and demo form on the live site.

## Next
- [ ] Click the live Messenger button: m.me/speeeeeduppb must open a chat with the page (if not,
      check the Facebook page's Messenger settings)
- [ ] Scroll the live page; drop the panel grow if it overlaps the screenshot draw-in too much
- [ ] Test the live site: fresh private window, no googletagmanager request before Accept,
      then Analytics Realtime and Admin > DebugView (generate_lead)
- [ ] GA: mark generate_lead and contact_click as key events; review privacy.html wording

## Done (latest first, max 10)
- 2026-10-27 Messenger button (c2912f1): top of the floating stack, m.me/speeeeeduppb
  (from facebook.com/speeeeeduppb); tracked as contact_click method messenger; privacy.html updated
- 2026-10-27 Look pass (d1adf7f): hero centered, "Read the FAQ →" link; no window dots; mint/warm
  alternating panels; plain-text pills; #why cards → ruled rows; demo form photo (assets/bg-1.jpg)
- 2026-10-27 Motion (d1adf7f): scroll-linked panel grow, hero tilt, screenshot draw-in, progress
  line; mission underline; FAQ slide; nav underline; tab fade; reduced motion honored
- 2026-10-26 Consent banner restyled (page font title, no green border, ball logo removed); b7d083c
- 2026-10-25 Schedule. + Call. sections (#schedule, #courts) with two tabs each; b7d083c
- 2026-10-23 GA4 (G-JPREMJE6Y8) behind consent banner + privacy.html + sitemap entry; a2029ac

## Decisions
- Design goal: simple, clear, direct to the audience; the Figma frame was only a reference, not a
  spec, and the repeated feature sections stay (2026-10-27)
- Panels: only mint/warm tints, alternating; pill buttons and tab switcher stay (2026-10-27)
- Scroll effects sit behind @supports and are off for reduced motion; screenshots use their frame's
  own view-timeline (--shot) because .frame's overflow:hidden would be the scroller (2026-10-27)
- Schedule/Court Board: one section each, two tabs, reusing .tie-tabs, JS per tablist (2026-10-25)
- GA loads only after Accept, no Consent Mode; generate_lead sends only the category; Google
  signals/ad toggles off; consent code inline in index.html; retention 14 months (2026-10-23)

## Open questions
- Legal name / address for privacy.html?
- hCaptcha and Web3Forms load without consent (disclosed in the policy) — acceptable?
- Old empty GA property "dasd" couldn't be trashed (internal error); retry later
