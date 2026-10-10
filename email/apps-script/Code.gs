/**
 * Speedup — send the HTML demo/pricing reply from Gmail via Google Apps Script.
 *
 * WHY: pasting HTML into the Gmail compose box strips the document and often
 * sends blank. Apps Script sends a real text/html message, so <style>, media
 * queries and hosted images all survive.
 *
 * The template (email/demo-pricing-reply.html) is fetched from GitHub Pages, so
 * after editing it: commit + push, wait for Pages to redeploy, then send.
 *
 * ONE-TIME SETUP
 *   1. Single send: new project at script.google.com, paste this file.
 *      Bulk send:   create a Google Sheet, Extensions -> Apps Script, paste this.
 *   2. First Run -> "Authorization required" -> Review permissions -> your
 *      account -> Advanced -> Go to (project) -> Allow.
 *   3. Optional: change DEMO_LINK below to your calendar / booking link.
 *
 * Gmail daily send cap: ~500 recipients/day on consumer Gmail (2,000 on
 * Workspace).
 */

// ---------------------------------------------------------------------------
// CONFIG — edit these
// ---------------------------------------------------------------------------
const SITE_URL = 'https://speedup-tournamentmanager.github.io/landing-page';
const TEMPLATE_URL = SITE_URL + '/email/demo-pricing-reply.html';
const FROM_NAME = 'Speedup Tournament Manager';

// Where the "Book your demo" button goes. Default opens WhatsApp with a ready
// message; replace with a calendar link (Calendly, Google Calendar, ...) if you have one.
const DEMO_LINK =
  'https://wa.me/639061223189?text=' +
  encodeURIComponent("Hi Speedup! I'd like to book a demo.");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape user-supplied text before it goes into the HTML. */
function esc_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip line breaks so a value can never inject extra mail headers. */
function oneLine_(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Turn a sheet row / form fields into clean values with sensible defaults. */
function normalize_(fields) {
  const name = oneLine_(fields.name || '') || 'there';
  return {
    NAME: name,
    REQUEST_TYPE: oneLine_(fields.request_type || '') || 'Request a demo',
    CONTACT_METHOD: oneLine_(fields.contact_method || '') || 'Email',
    CONTACT: oneLine_(fields.contact || '') || oneLine_(fields.email || ''),
  };
}

/**
 * Fill every {{PLACEHOLDER}} in the template (tolerates {{ NAME }} spacing).
 * Returns { html, text, subject }.
 */
function buildEmail_(templateHtml, fields) {
  const v = normalize_(fields);
  const values = {
    SITE_URL: SITE_URL,
    DEMO_LINK: DEMO_LINK,
    NAME: esc_(v.NAME),
    REQUEST_TYPE: esc_(v.REQUEST_TYPE),
    CONTACT_METHOD: esc_(v.CONTACT_METHOD),
    CONTACT: esc_(v.CONTACT),
  };

  const html = templateHtml
    .replace(/<!--[\s\S]*?-->/g, '') // drop the template's author notes
    .replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : match;
    });

  const leftover = html.match(/\{\{\s*[A-Z_]+\s*\}\}/g);
  if (leftover) {
    throw new Error('Unfilled placeholders in template: ' + leftover.join(', '));
  }

  const text =
    'Hi ' + v.NAME + ', thanks for reaching out to Speedup Tournament Manager. ' +
    'We received your request (' + v.REQUEST_TYPE + ') and will reply within 1 business day. ' +
    'You can also message us on WhatsApp or Telegram: ' +
    'https://wa.me/639061223189 / https://t.me/+639061223189';

  return {
    html: html,
    text: text,
    subject: 'Thanks for reaching out to Speedup — ' + v.REQUEST_TYPE,
  };
}

function fetchTemplate_() {
  const res = UrlFetchApp.fetch(TEMPLATE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error(
      'Could not load template (' + res.getResponseCode() + '): ' + TEMPLATE_URL
    );
  }
  return res.getContentText();
}

// ---------------------------------------------------------------------------
// 1) SINGLE SEND — edit the values, then Run this function
// ---------------------------------------------------------------------------
function sendSpeedupReply() {
  const fields = {
    name: 'Maria',                       // person's first name
    email: 'maria@example.com',          // where to send the reply
    request_type: 'Request a demo',      // Request a demo / Request a quotation / Pricing question ...
    contact_method: 'WhatsApp',          // Phone number / WhatsApp / Telegram
    contact: '+63 917 000 0000',         // what they typed in the form
  };

  if (!isEmail_(fields.email)) throw new Error('Invalid email: ' + fields.email);

  const msg = buildEmail_(fetchTemplate_(), fields);
  GmailApp.sendEmail(fields.email, msg.subject, msg.text, {
    htmlBody: msg.html,
    name: FROM_NAME,
  });
  Logger.log('Sent to %s <%s>', fields.name, fields.email);
}

// ---------------------------------------------------------------------------
// 2) BULK SEND — from a Google Sheet
//
// Sheet layout (row 1 = headers, exactly these words, any column order):
//   name | email | request_type | contact_method | contact | sent
//   Maria | maria@example.com | Request a demo | WhatsApp | +63 917 000 0000 |   (blank)
//
// Only "email" is required; the rest fall back to defaults. Run sendBatch (or use
// the Speedup menu): it emails every row whose "sent" cell is empty and writes a
// timestamp there, so re-running never double-sends. Add new rows at the bottom.
// ---------------------------------------------------------------------------
function sendBatch() {
  const template = fetchTemplate_();

  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getDataRange().getValues();
  const header = values.shift().map(function (h) {
    return String(h).trim().toLowerCase();
  });

  const col = function (key) {
    return header.indexOf(key);
  };
  const iMail = col('email');
  const iSent = col('sent');
  if (iMail < 0 || iSent < 0) {
    throw new Error('Header row must contain at least: email, sent');
  }
  const get = function (row, key) {
    const i = col(key);
    return i < 0 ? '' : row[i];
  };

  let sent = 0;
  let skipped = 0;
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    const email = String(row[iMail] || '').trim();
    if (row[iSent] || !email) continue; // already sent or empty row

    if (!isEmail_(email)) {
      sheet.getRange(r + 2, iSent + 1).setValue('SKIPPED: invalid email');
      skipped++;
      continue;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      Logger.log('Daily Gmail quota reached — run again tomorrow.');
      break;
    }

    const msg = buildEmail_(template, {
      name: get(row, 'name'),
      email: email,
      request_type: get(row, 'request_type'),
      contact_method: get(row, 'contact_method'),
      contact: get(row, 'contact'),
    });

    GmailApp.sendEmail(email, msg.subject, msg.text, {
      htmlBody: msg.html,
      name: FROM_NAME,
    });

    sheet.getRange(r + 2, iSent + 1).setValue(new Date()); // +2: header + 1-index
    SpreadsheetApp.flush();
    sent++;
    Utilities.sleep(1200); // be gentle with Gmail's rate limits
  }

  Logger.log('Batch done. Sent: %s, skipped: %s', sent, skipped);
}

/** Adds a "Speedup" menu to the Sheet so you can run sendBatch by click. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Speedup')
    .addItem('Send replies (unsent rows)', 'sendBatch')
    .addToUi();
}
