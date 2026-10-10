/**
 * Speedup — automatically reply to demo/pricing requests that arrive via
 * Web3Forms.
 *
 * HOW IT WORKS
 *   Web3Forms emails every form submission to your Gmail. A time-based trigger
 *   runs processNewSubmissions() every few minutes: it finds new Web3Forms
 *   emails, reads the submitter's details, sends the HTML reply from Code.gs,
 *   and labels the thread so it is never answered twice.
 *
 *   Because it only reads emails Web3Forms actually delivered (i.e. submissions
 *   that passed the captcha), nobody can use it to make your Gmail send mail to
 *   arbitrary addresses.
 *
 * REQUIRES Code.gs in the same Apps Script project (it reuses its template
 * fetching, placeholder filling, FROM_NAME and isEmail_). Both files share one
 * project; paste both.
 *
 * SETUP (once, in the Apps Script project signed in as the Gmail that receives
 * the Web3Forms emails)
 *   1. Run debugLatestSubmission(). Check the log: does it show the right name,
 *      email, request_type, contact_method, contact? If a field is empty, the
 *      email layout differs from what the parser expects -> tell me / adjust
 *      parseSubmission_().
 *   2. Leave AUTO_REPLY_DRY_RUN = true and run processNewSubmissions(): it logs
 *      who it WOULD reply to without sending or labelling anything.
 *   3. Set AUTO_REPLY_DRY_RUN = false, run processNewSubmissions() once to send
 *      for real (approve permissions), then run installTrigger().
 *   To stop: run removeTrigger().
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const AUTO_REPLY_DRY_RUN = true; // true = log only, send nothing, label nothing

// Which emails count as Web3Forms submissions. Adjust if your emails come from
// a different sender / subject (the form sets the subject to "[Speedup] <topic> — <name>").
const WEB3FORMS_QUERY =
  'from:web3forms.com subject:Speedup newer_than:3d ' +
  '-label:speedup-replied -label:speedup-skipped';

const REPLIED_LABEL = 'speedup-replied';
const SKIPPED_LABEL = 'speedup-skipped';
const MAX_PER_RUN = 15; // safety cap per trigger run
const ONE_REPLY_PER_ADDRESS_HOURS = 24;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** "Request Type" / "request_type" / "REQUEST TYPE" -> "requesttype" */
function canonKey_(key) {
  return String(key).toLowerCase().replace(/[^a-z]/g, '');
}

const KEY_TO_FIELD_ = {
  name: 'name',
  fullname: 'name',
  email: 'email',
  emailaddress: 'email',
  requesttype: 'request_type',
  topic: 'request_type',
  contactmethod: 'contact_method',
  contact: 'contact',
  contactvalue: 'contact',
};

function stripTags_(html) {
  return String(html)
    .replace(/<(br|\/p|\/div|\/tr|\/h\d|\/li)\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\n') // key and value cells become separate lines
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Read the submitted fields out of a Web3Forms notification body.
 * Tolerates "Key: value" lines and "Key" on one line / value on the next.
 * Also falls back to the subject ("[Speedup] <topic> — <name>").
 * Returns { name, email, request_type, contact_method, contact }.
 */
function parseSubmission_(body, subject) {
  const out = {};
  const lines = String(body)
    .split(/\r?\n/)
    .map(function (l) {
      return l.replace(/\s+/g, ' ').trim();
    })
    .filter(function (l) {
      return l.length > 0;
    });

  for (let i = 0; i < lines.length; i++) {
    let m = lines[i].match(/^\**([A-Za-z][A-Za-z _-]{1,30}?)\**\s*:\s*(.*)$/);
    let key, val;
    if (m) {
      key = canonKey_(m[1]);
      val = m[2];
      if (!val && i + 1 < lines.length) val = lines[++i]; // value on next line
    } else if (KEY_TO_FIELD_[canonKey_(lines[i])] && i + 1 < lines.length) {
      key = canonKey_(lines[i]); // bare "Name" line, value below
      val = lines[++i];
    } else {
      continue;
    }
    const field = KEY_TO_FIELD_[key];
    if (field && !out[field]) out[field] = val.replace(/^\*+|\*+$/g, '').trim();
  }

  // The email field may be wrapped, e.g. "Alex <alex@x.com>" or mailto text.
  if (out.email) {
    const e = out.email.match(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[^\s<>"'(),;:]+/);
    out.email = e ? e[0] : '';
  }

  // Fallback: subject "[Speedup] <topic> — <name>"
  const s = String(subject || '').match(/^\s*\[Speedup\]\s*(.+?)\s+[—–-]\s+(.+)$/);
  if (s) {
    if (!out.request_type) out.request_type = s[1].trim();
    if (!out.name) out.name = s[2].trim();
  }
  return out;
}

function getBodyText_(message) {
  const plain = message.getPlainBody();
  return plain && plain.trim() ? plain : stripTags_(message.getBody());
}

// ---------------------------------------------------------------------------
// Main job
// ---------------------------------------------------------------------------

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function processNewSubmissions() {
  const threads = GmailApp.search(WEB3FORMS_QUERY, 0, MAX_PER_RUN);
  if (!threads.length) {
    Logger.log('No new Web3Forms submissions.');
    return;
  }

  const me = Session.getActiveUser().getEmail().toLowerCase();
  const props = PropertiesService.getScriptProperties();
  const template = fetchTemplate_();
  const replied = getOrCreateLabel_(REPLIED_LABEL);
  const skipped = getOrCreateLabel_(SKIPPED_LABEL);
  const now = Date.now();
  let sent = 0;

  threads.forEach(function (thread) {
    const msg = thread.getMessages()[0];

    // Only trust mail that really came from Web3Forms (the search can match loosely).
    if (!/web3forms/i.test(msg.getFrom())) return;

    const fields = parseSubmission_(getBodyText_(msg), msg.getSubject());
    if (!fields.email) {
      const rt = String(msg.getReplyTo() || '').match(/[^\s<>"']+@[^\s<>"']+/);
      fields.email = rt ? rt[0] : '';
    }
    const email = String(fields.email || '').trim().toLowerCase();

    const skip = function (why) {
      Logger.log('SKIP (%s): "%s"', why, msg.getSubject());
      if (!AUTO_REPLY_DRY_RUN) thread.addLabel(skipped);
    };

    if (!isEmail_(email)) return skip('no valid email found');
    if (email === me) return skip('submitter is this account');

    const key = 'last:' + email;
    const last = Number(props.getProperty(key) || 0);
    if (now - last < ONE_REPLY_PER_ADDRESS_HOURS * 3600 * 1000) {
      return skip('already replied to ' + email + ' recently');
    }

    const reply = buildEmail_(template, fields);

    if (AUTO_REPLY_DRY_RUN) {
      Logger.log(
        'DRY RUN - would reply to %s (%s) | %s | %s: %s | subject: %s',
        email, fields.name || '?', fields.request_type || '?',
        fields.contact_method || '?', fields.contact || '?', reply.subject
      );
      return;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      Logger.log('Daily Gmail quota reached - will continue next run.');
      return;
    }

    GmailApp.sendEmail(email, reply.subject, reply.text, {
      htmlBody: reply.html,
      name: FROM_NAME,
    });
    thread.addLabel(replied);
    props.setProperty(key, String(now));
    sent++;
    Utilities.sleep(1200);
  });

  Logger.log('Done. Replies sent: %s%s', sent, AUTO_REPLY_DRY_RUN ? ' (dry run)' : '');
}

// ---------------------------------------------------------------------------
// Helpers to set up / debug
// ---------------------------------------------------------------------------

/** Step 1 of setup: shows what the parser reads from your most recent submission. */
function debugLatestSubmission() {
  const threads = GmailApp.search('from:web3forms.com subject:Speedup', 0, 1);
  if (!threads.length) {
    Logger.log('No Web3Forms email found. Submit the form once, then run this again.');
    return;
  }
  const msg = threads[0].getMessages()[0];
  Logger.log('FROM: %s', msg.getFrom());
  Logger.log('SUBJECT: %s', msg.getSubject());
  Logger.log('REPLY-TO: %s', msg.getReplyTo());
  Logger.log('PARSED: %s', JSON.stringify(parseSubmission_(getBodyText_(msg), msg.getSubject())));
  Logger.log('BODY (first 600 chars): %s', getBodyText_(msg).slice(0, 600));
}

/** Run once to check for new submissions every 5 minutes. */
function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('processNewSubmissions').timeBased().everyMinutes(5).create();
  Logger.log('Trigger installed: processNewSubmissions every 5 minutes.');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processNewSubmissions') ScriptApp.deleteTrigger(t);
  });
}
