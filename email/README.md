# Speedup email templates

## `demo-pricing-reply.html`

HTML reply for people who request a demo, quotation or pricing: launch pricing
table, "Book your demo" button, WhatsApp / Telegram buttons. Hosted copy:
https://speedup-tournamentmanager.github.io/landing-page/email/demo-pricing-reply.html

Images and the Playball font are loaded from the same GitHub Pages site, so keep
them as hosted files (Gmail/Outlook block base64 images). After editing anything
in `email/` or `assets/`, commit and push and wait for Pages to redeploy.

## Sending: `apps-script/Code.gs`

Google Apps Script that fetches the hosted template, fills the placeholders
(`{{NAME}}`, `{{REQUEST_TYPE}}`, `{{CONTACT_METHOD}}`, `{{CONTACT}}`, `{{DEMO_LINK}}`,
`{{SITE_URL}}`) and sends it from your Gmail.

- `sendSpeedupReply()` — one person; edit the values at the top of the function.
- `sendBatch()` — Google Sheet with headers `name, email, request_type,
  contact_method, contact, sent`. Sends every row whose `sent` is empty and
  stamps the time, so it never double-sends. Only `email` is required.

Setup: paste `Code.gs` into script.google.com (single send) or a Sheet's
Extensions -> Apps Script (batch), run once and approve the Gmail permissions.
Gmail cap: ~500 recipients/day (consumer), 2,000 (Workspace).
