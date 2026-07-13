const { hasCapability, getSession } = require('../_lib/auth');
const { readDb, writeDb } = require('../_lib/db');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (!hasCapability(req, 'decide_applications')) return res.status(403).json({ error: 'You do not have permission to accept/reject applications.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const id = req.query.id;
  const { action } = parseBody(req);

  if (!id) return res.status(400).json({ error: 'Missing application id.' });
  if (!['accepted', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  try {
    const db = await readDb();
    const application = db.applications.find((a) => a.id === id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    const session = getSession(req);

    application.status = action;
    application.reviewedBy = (session && session.username) || 'unknown';
    application.reviewedAt = new Date().toLocaleString();

    if (action === 'rejected' && application.inviteId) {
      const invite = db.invites.find((i) => i.id === application.inviteId);
      if (invite) {
        invite.used = false;
        invite.usedAt = null;
        invite.applicationId = null;
      }
    }

    await writeDb(db);

    const sheetUrl = db.config.sheetWebhookUrl;
    if (sheetUrl) {
      try {
        // Never send the applicant's IP to the sheet — that spreadsheet may
        // be visible to people who shouldn't see it at all.
        const { ip, ...sheetPayload } = application;
        await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(sheetPayload)
        });
      } catch (err) {
        // Don't fail the accept/reject action just because the sheet is unreachable.
        console.error('Google Sheet webhook failed:', err.message);
      }
    }

    const { ip, ...responseApplication } = application;

    res.status(200).json({ ok: true, application: responseApplication });
  } catch (err) {
    console.error('decide error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
