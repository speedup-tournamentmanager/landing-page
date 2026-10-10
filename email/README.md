# Speedup email templates

## `demo-pricing-reply.html`

HTML reply for people who request a demo, quotation or pricing: launch pricing
table, "Book your demo" button, WhatsApp / Telegram buttons. Hosted copy:
https://speedup-tournamentmanager.github.io/landing-page/email/demo-pricing-reply.html

Images (including the "Speedup" word, pre-rendered in the Playball font so it looks the same in every email app) load from the same GitHub Pages site, so keep
them as hosted files (Gmail/Outlook block base64 images). After editing anything
in `email/` or `assets/`, commit and push and wait for Pages to redeploy.

## Sending: `apps-script/Code.gs`

Google Apps Script that fetches the hosted template, fills the placeholders
(`{{NAME}}`, `{{REQUEST_TYPE}}`, `{{CONTACT_METHOD}}`, `{{CONTACT}}`, `{{DEMO_LINK}}`,
`{{SITE_URL}}`) and sends it from your Gmail.

- `sendBatch()` — Google Sheet with headers `name, email, request_type,
  contact_method, contact, sent`. Sends every row whose `sent` is empty and
  stamps the time, so it never double-sends. Only `email` is required.

- `previewCsvBatch()` / `sendCsvBatch()` — reads `email/customers.csv` from the
  GitHub Pages site (same flow as the Tudlo script). Preview only logs; send emails
  everyone not emailed yet and remembers them in the script's properties
  (`sent:<email>`), so re-running never double-sends. `clearSentFlags()` forgets
  them (testing only).

### Customer list: `customers.csv`

Columns: `name, email, request_type, contact_method, contact` (only `email` is
required). Edit it, commit + push, wait for Pages to redeploy, then run
`previewCsvBatch()` and `sendCsvBatch()`.

> The repo and Pages site are public, so anything in `customers.csv` is readable
> by anyone with the URL.

Setup: paste `Code.gs` into script.google.com (CSV send) or a Sheet's
Extensions -> Apps Script (batch), run once and approve the Gmail permissions.
Gmail cap: ~500 recipients/day (consumer), 2,000 (Workspace).

## Auto-reply to form submissions: `apps-script/AutoReply.gs`

Replies automatically to each Web3Forms notification in the Gmail that receives
them. A 5-minute trigger finds new submissions, sends the HTML reply, and labels
the thread `speedup-replied` so it is never answered twice. It only reads emails
Web3Forms actually delivered (captcha already passed), so it can't be abused to
send mail to arbitrary addresses. Needs `Code.gs` in the same Apps Script project.

Setup (signed in as the Gmail that receives the Web3Forms emails):

1. Paste `Code.gs` and `AutoReply.gs` into one project at script.google.com.
2. Submit the live form once, then run `debugLatestSubmission()` and check the
   log shows the right name / email / request_type / contact. If a field is empty,
   the Web3Forms email layout differs — adjust `parseSubmission_()`.
3. Run `processNewSubmissions()` with `AUTO_REPLY_DRY_RUN = true`: it logs who it
   *would* reply to, sends nothing.
4. Set `AUTO_REPLY_DRY_RUN = false`, run it once (approve permissions), then run
   `installTrigger()`. `removeTrigger()` stops it.

Safeguards: max 15 replies per run, one reply per address per 24 h, skips
invalid emails and the account's own address, stops at the Gmail daily quota.
