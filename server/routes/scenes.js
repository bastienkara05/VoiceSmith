const express = require('express');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');

const router = express.Router();
router.use(validateToken, attachUser);

// POST /api/scenes — create scene
router.post('/', async (req, res) => {
  const { project_id, name } = req.body;
  if (!project_id || !name?.trim()) {
    return res.status(400).json({ error: 'project_id and name are required' });
  }

  try {
    // Verify project belongs to user
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [project_id, req.user.id]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    // Get next position
    const pos = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM scenes WHERE project_id = $1',
      [project_id]
    );

    const result = await pool.query(
      `INSERT INTO scenes (project_id, name, position)
       VALUES ($1, $2, $3) RETURNING *`,
      [project_id, name.trim(), pos.rows[0].next]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create scene' });
  }
});

// PATCH /api/scenes/:id
router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      `UPDATE scenes SET name = $1
       WHERE id = $2
       AND project_id IN (SELECT id FROM projects WHERE user_id = $3)
       RETURNING *`,
      [name.trim(), req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Scene not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update scene' });
  }
});

// DELETE /api/scenes/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM scenes WHERE id = $1
       AND project_id IN (SELECT id FROM projects WHERE user_id = $2)
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Scene not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

module.exports = router;
