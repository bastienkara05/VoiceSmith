const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');

const router = express.Router();
router.use(validateToken, attachUser);

// GET /api/projects — list all projects for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
        COUNT(DISTINCT s.id) AS scene_count,
        COUNT(DISTINCT l.id) AS line_count
       FROM projects p
       LEFT JOIN scenes s ON s.project_id = p.id
       LEFT JOIN lines l ON l.scene_id = s.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects — create project
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, name.trim(), description?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id — get single project with scenes + lines
router.get('/:id', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const scenes = await pool.query(
      'SELECT * FROM scenes WHERE project_id = $1 ORDER BY position ASC',
      [req.params.id]
    );

    const characters = await pool.query(
      'SELECT * FROM characters WHERE project_id = $1',
      [req.params.id]
    );

    const lines = await pool.query(
      `SELECT l.* FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       WHERE s.project_id = $1
       ORDER BY l.position ASC`,
      [req.params.id]
    );

    res.json({
      ...project.rows[0],
      scenes: scenes.rows,
      characters: characters.rows,
      lines: lines.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// PATCH /api/projects/:id — update project name/description
router.patch('/:id', async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = NOW()
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [name?.trim(), description?.trim(), req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
