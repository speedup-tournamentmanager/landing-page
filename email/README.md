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

- `previewCsvBatch()` / `sendCsvBatch()` — customer list in a CSV file in your
  **private Google Drive** (see below). Preview only logs; send emails every row
  whose `sent` is empty and writes a timestamp back into the CSV.

### Customer list: `customers.csv`

Columns: `name, email, request_type, contact_method, contact, sent` (only `email`
is required; leave `sent` empty). See `customers.example.csv`. Your real
`email/customers.csv` is git-ignored — never commit or host it (it would publish
customers' names and emails). Upload it to Google Drive, run `previewCsvBatch()`,
then `sendCsvBatch()`.

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
