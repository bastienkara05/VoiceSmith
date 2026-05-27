const express = require('express');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');

const router = express.Router();
router.use(validateToken, attachUser);

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
