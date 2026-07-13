const { hasCapability } = require('../_lib/auth');
const { readDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (!hasCapability(req, 'view_security_log')) return res.status(403).json({ error: 'You do not have permission to view the security log.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const db = await readDb();
    // Reads from the permanent, append-only ipLog — not from `applications`,
    // so entries survive even if the application itself is later deleted.
    const entries = [...db.ipLog].sort((a, b) => b.ts - a.ts);
    res.status(200).json({ entries });
  } catch (err) {
    console.error('iplog error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
