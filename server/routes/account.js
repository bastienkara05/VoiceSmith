const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');
const { sendVerificationEmail } = require('../lib/email');

const router = express.Router();
router.use(validateToken, attachUser);

// POST /api/account/send-verification — send email verification
router.post('/send-verification', async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Save token to database
    await pool.query(
      'UPDATE users SET email_verification_token = $1 WHERE id = $2',
      [hashedToken, userId]
    );

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    await sendVerificationEmail(email, verificationUrl);

    console.log(`[Email] Sent verification email to ${email}`);
    res.json({ sent: true });
  } catch (err) {
    console.error('[Email] Error sending verification:', err);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// POST /api/account/verify-email — verify email with token
router.post('/verify-email', async (req, res) => {
  const { token, email } = req.body;

  if (!token || !email) {
    return res.status(400).json({ error: 'Token and email are required' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token and email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND email_verification_token = $2',
      [email, hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Mark email as verified
    await pool.query(
      'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE email = $1',
      [email]
    );

    console.log(`[Email] Verified email for ${email}`);
    res.json({ verified: true });
  } catch (err) {
    console.error('[Email] Error verifying email:', err);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// DELETE /api/account — delete user account and all associated data
router.delete('/', async (req, res) => {
  const userId = req.user.id;

  try {
    // Start transaction - delete in order due to constraints
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete all lines for user's projects
      await client.query(
        `DELETE FROM lines
         WHERE scene_id IN (
           SELECT s.id FROM scenes s
           JOIN projects p ON p.id = s.project_id
           WHERE p.user_id = $1
         )`,
        [userId]
      );

      // Delete all scenes for user's projects
      await client.query(
        `DELETE FROM scenes
         WHERE project_id IN (
           SELECT id FROM projects WHERE user_id = $1
         )`,
        [userId]
      );

      // Delete all characters for user's projects
      await client.query(
        `DELETE FROM characters
         WHERE project_id IN (
           SELECT id FROM projects WHERE user_id = $1
         )`,
        [userId]
      );

      // Delete all projects for user
      await client.query(
        'DELETE FROM projects WHERE user_id = $1',
        [userId]
      );

      // Delete user
      await client.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
      );

      await client.query('COMMIT');
      client.release();

      console.log(`[Account] Deleted account for user ${userId}`);
      res.json({ deleted: true });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
