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
 *   1. New project at script.google.com, paste this file. Your customer list
 *      is email/customers.csv on GitHub Pages (see "SEND FROM CSV" below).
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
const SITE_URL = "https://speedup-tournamentmanager.github.io/landing-page";
const TEMPLATE_URL = SITE_URL + "/email/demo-pricing-reply.html";
const FROM_NAME = "Speedup Tournament Manager";

// Where the "Book your demo" button goes. Default opens WhatsApp with a ready
// message; replace with a calendar link (Calendly, Google Calendar, ...) if you have one.
const DEMO_LINK =
  "https://wa.me/639061223189?text=" +
  encodeURIComponent("Hi Speedup! I'd like to book a demo.");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape user-supplied text before it goes into the HTML. */
function esc_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip line breaks so a value can never inject extra mail headers. */
function oneLine_(value) {
  return String(value)
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Turn a sheet row / form fields into clean values with sensible defaults. */
function normalize_(fields) {
  const name = oneLine_(fields.name || "") || "there";
  return {
    NAME: name,
    REQUEST_TYPE: oneLine_(fields.request_type || "") || "Request a demo",
    CONTACT_METHOD: oneLine_(fields.contact_method || "") || "Email",
    CONTACT: oneLine_(fields.contact || "") || oneLine_(fields.email || ""),
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
    .replace(/<!--[\s\S]*?-->/g, "") // drop the template's author notes
    .replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : match;
    });

  const leftover = html.match(/\{\{\s*[A-Z_]+\s*\}\}/g);
  if (leftover) {
    throw new Error(
      "Unfilled placeholders in template: " + leftover.join(", "),
    );
  }

  const text =
    "Hi " +
    v.NAME +
    ", thanks for reaching out to Speedup Tournament Manager. " +
    "We received your request (" +
    v.REQUEST_TYPE +
    ") and will reply within 1 business day. " +
    "You can also message us on WhatsApp or Telegram: " +
    "https://wa.me/639061223189 / https://t.me/+639061223189";

  return {
    html: html,
    text: text,
    subject: "Thanks for reaching out to Speedup — " + v.REQUEST_TYPE,
  };
}

function fetchTemplate_() {
  const res = UrlFetchApp.fetch(TEMPLATE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error(
      "Could not load template (" +
        res.getResponseCode() +
        "): " +
        TEMPLATE_URL,
    );
  }
  return res.getContentText();
}

// ---------------------------------------------------------------------------
// 2) BULK SEND — from a Google Sheet (alternative to the CSV)
//
// Sheet layout (row 1 = headers, exactly these words, any column order):
//   name | email | request_type | contact_method | contact | sent
//   (one customer per row; leave "sent" blank)
//
// Only "email" is required; the rest fall back to defaults. Run sendBatch (or use
// the Speedup menu): it emails every row whose "sent" cell is empty and writes a
// timestamp there, so re-running never double-sends. Add new rows at the bottom.
// ---------------------------------------------------------------------------
function sendBatch() {
  const template = fetchTemplate_();

  const sheet = SpreadsheetApp.getActiveSheet();
  if (!sheet) {
    throw new Error(
      "sendBatch only works inside a Google Sheet (Extensions -> Apps Script). " +
        "In this standalone project use previewCsvBatch / sendCsvBatch instead.",
    );
  }
  const values = sheet.getDataRange().getValues();
  const header = values.shift().map(function (h) {
    return String(h).trim().toLowerCase();
  });

  const col = function (key) {
    return header.indexOf(key);
  };
  const iMail = col("email");
  const iSent = col("sent");
  if (iMail < 0 || iSent < 0) {
    throw new Error("Header row must contain at least: email, sent");
  }
  const get = function (row, key) {
    const i = col(key);
    return i < 0 ? "" : row[i];
  };

  let sent = 0;
  let skipped = 0;
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    const email = String(row[iMail] || "").trim();
    if (row[iSent] || !email) continue; // already sent or empty row

    if (!isEmail_(email)) {
      sheet.getRange(r + 2, iSent + 1).setValue("SKIPPED: invalid email");
      skipped++;
      continue;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      Logger.log("Daily Gmail quota reached — run again tomorrow.");
      break;
    }

    const msg = buildEmail_(template, {
      name: get(row, "name"),
      email: email,
      request_type: get(row, "request_type"),
      contact_method: get(row, "contact_method"),
      contact: get(row, "contact"),
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

  Logger.log("Batch done. Sent: %s, skipped: %s", sent, skipped);
}

// ---------------------------------------------------------------------------
// 1) SEND FROM CSV — customers.csv hosted on GitHub Pages (main way)
//
// 1. Put your customers in email/customers.csv, commit + push, and wait for
//    GitHub Pages to redeploy (a minute or two). Columns (row 1, exact words,
//    any order):  name, email, request_type, contact_method, contact
//    Only "email" is required.
// 2. Run previewCsvBatch(): it only LOGS who would be emailed.
// 3. Run sendCsvBatch(): emails everyone who hasn't been emailed yet. Sent
//    addresses are remembered in this script's properties (key "sent:<email>"),
//    so re-running never double-sends. Add new customers to the CSV, push, run again.
//
// NOTE: the repo and Pages site are public, so anything in customers.csv can be
// read by anyone who knows the URL.
// ---------------------------------------------------------------------------
const CSV_URL = SITE_URL + "/email/customers.csv";

function fetchCsvRows_() {
  const res = UrlFetchApp.fetch(CSV_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error(
      "Could not load customers.csv (" + res.getResponseCode() + "): " + CSV_URL,
    );
  }
  const text = res.getContentText().replace(/^\uFEFF/, "");
  const rows = Utilities.parseCsv(text).filter(function (r) {
    return r.some(function (c) {
      return String(c).trim() !== "";
    });
  });
  if (rows.length < 1) throw new Error("customers.csv is empty.");
  const header = rows.shift().map(function (h) {
    return String(h).trim().toLowerCase();
  });
  if (header.indexOf("email") < 0) {
    throw new Error("customers.csv header row must contain: email");
  }
  return { header: header, rows: rows };
}

function previewCsvBatch() {
  runCsvBatch_(true);
}

function sendCsvBatch() {
  runCsvBatch_(false);
}

function runCsvBatch_(dryRun) {
  const csv = fetchCsvRows_();
  const header = csv.header;
  const iMail = header.indexOf("email");
  const get = function (row, key) {
    const i = header.indexOf(key);
    return i < 0 ? "" : row[i] || "";
  };

  const store = PropertiesService.getScriptProperties();
  const template = dryRun ? null : fetchTemplate_();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let r = 0; r < csv.rows.length; r++) {
    const row = csv.rows[r];
    const line = r + 2; // header is line 1
    const email = String(row[iMail] || "").trim();
    if (!email) continue;

    if (!isEmail_(email)) {
      Logger.log("Row %s: SKIPPED invalid email: %s", line, email);
      skipped++;
      continue;
    }
    if (store.getProperty("sent:" + email.toLowerCase())) {
      Logger.log("Row %s: skipped (already sent) - %s", line, email);
      skipped++;
      continue;
    }

    const fields = {
      name: get(row, "name"),
      email: email,
      request_type: get(row, "request_type"),
      contact_method: get(row, "contact_method"),
      contact: get(row, "contact"),
    };

    if (dryRun) {
      Logger.log(
        "Row %s: DRY RUN - would email %s <%s> | %s | %s: %s",
        line,
        fields.name || "(no name)",
        email,
        fields.request_type || "Request a demo",
        fields.contact_method || "-",
        fields.contact || "-",
      );
      sent++;
      continue;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      Logger.log("Daily Gmail quota reached - run again tomorrow.");
      break;
    }

    try {
      const msg = buildEmail_(template, fields);
      GmailApp.sendEmail(email, msg.subject, msg.text, {
        htmlBody: msg.html,
        name: FROM_NAME,
      });
      store.setProperty("sent:" + email.toLowerCase(), new Date().toISOString());
      Logger.log("Row %s: sent to %s <%s>", line, fields.name || "there", email);
      sent++;
    } catch (err) {
      // one bad address must not stop the rest of the batch
      Logger.log("Row %s: FAILED for %s - %s", line, email, err.message);
      failed++;
    }
    Utilities.sleep(1200); // be gentle with Gmail's rate limits
  }

  Logger.log(
    "%s done. %s=%s skipped=%s failed=%s",
    dryRun ? "Preview" : "Batch",
    dryRun ? "would_send" : "sent",
    sent,
    skipped,
    failed,
  );
}

/**
 * Forget every "already sent" flag so the next sendCsvBatch emails EVERYONE in
 * the CSV again. Use only while testing (e.g. to re-send to your own address).
 */
function clearSentFlags() {
  const store = PropertiesService.getScriptProperties();
  const keys = Object.keys(store.getProperties()).filter(function (k) {
    return k.indexOf("sent:") === 0;
  });
  keys.forEach(function (k) {
    store.deleteProperty(k);
  });
  Logger.log("Cleared %s sent flag(s).", keys.length);
}

/** Adds a "Speedup" menu to the Sheet so you can run sendBatch by click. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Speedup")
    .addItem("Send replies (unsent rows)", "sendBatch")
    .addToUi();
}
