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

### Customer list: a Google Sheet

The customer list lives only in a Google Sheet (same flow as the Tudlo script),
never in this repo. The repo and Pages site are public, so anything committed
here is readable by anyone.

Row 1 of the Sheet = these headers (exact words, any column order):
`name, email, request_type, contact_method, contact, sent`. One customer per
row, leave `sent` blank. Only `email` is required (plus the `sent` column).

- `previewBatch()` — only logs who would be emailed. Sends nothing.
- `sendBatch()` — emails every row whose `sent` is empty and writes the time
  there, so re-running never double-sends. A failed row stays blank and is
  retried on the next run; an invalid address is marked `SKIPPED`.

Add new customers at the bottom and run again.

Setup, either way:

- **From the Sheet:** Extensions -> Apps Script, paste `Code.gs`, leave
  `SHEET_ID` empty. A **Speedup** menu with both actions appears in the Sheet
  after a reload.
- **By ID (any Apps Script project):** paste `Code.gs` and set `SHEET_ID` to the
  Sheet's ID: the long text between `/d/` and `/edit` in its address (the whole
  address also works). `SHEET_NAME` picks a tab other than the first. There is no
  menu here; run `previewBatch` / `sendBatch` from the editor. Paste the real ID
  in the Apps Script editor only, never in this repo.

Then run `previewBatch()` once and approve the Gmail and Sheets permissions.
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
