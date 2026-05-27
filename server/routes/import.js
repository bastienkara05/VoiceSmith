const express = require('express');
const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');
const { VOICE_PRESETS } = require('../lib/presets');

const router = express.Router();
router.use(validateToken, attachUser);

// POST /api/import/dialogue — import dialogue from CSV or JSON
router.post('/dialogue', async (req, res) => {
  const { project_id, file_content, file_type } = req.body;

  if (!project_id || !file_content) {
    return res.status(400).json({ error: 'project_id and file_content are required' });
  }

  // Verify project exists and belongs to user
  try {
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [project_id, req.user.id]
    );
    if (!project.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify project' });
  }

  let dialogueData = [];

  try {
    // Parse file based on type
    if (file_type === 'json') {
      dialogueData = JSON.parse(file_content);
      if (!Array.isArray(dialogueData)) {
        dialogueData = dialogueData.dialogue || dialogueData.lines || [];
      }
    } else if (file_type === 'csv') {
      const records = parse(file_content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      dialogueData = records;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use CSV or JSON.' });
    }

    if (!Array.isArray(dialogueData) || dialogueData.length === 0) {
      return res.status(400).json({ error: 'No dialogue data found in file' });
    }

    // Validate structure
    const requiredFields = ['character', 'text'];
    const hasMissingFields = dialogueData.some(row =>
      requiredFields.some(field => !row[field]?.toString().trim())
    );

    if (hasMissingFields) {
      return res.status(400).json({
        error: 'CSV/JSON must have "character" and "text" columns/fields. Optional: "scene", "emotion"'
      });
    }

    // Start transaction-like operation
    const characterMap = {}; // Store created/existing character IDs by name
    const createdScenes = {}; // Store created scene IDs by name
    let lineCount = 0;

    // Process each row
    for (const row of dialogueData) {
      const characterName = row.character?.toString().trim();
      const lineText = row.text?.toString().trim();
      const sceneName = (row.scene || 'Imported scene').toString().trim();
      const emotion = (row.emotion || 'neutral').toString().trim();

      if (!characterName || !lineText) continue;

      // Get or create scene
      let sceneId;
      if (!createdScenes[sceneName]) {
        const scenePos = await pool.query(
          'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM scenes WHERE project_id = $1',
          [project_id]
        );
        const sceneResult = await pool.query(
          'INSERT INTO scenes (project_id, name, position) VALUES ($1, $2, $3) RETURNING id',
          [project_id, sceneName, scenePos.rows[0].next]
        );
        createdScenes[sceneName] = sceneResult.rows[0].id;
      }
      sceneId = createdScenes[sceneName];

      // Get or create character
      let characterId;
      if (!characterMap[characterName]) {
        // Check if character already exists in project
        const existing = await pool.query(
          'SELECT id FROM characters WHERE project_id = $1 AND name = $2',
          [project_id, characterName]
        );

        if (existing.rows.length) {
          characterMap[characterName] = existing.rows[0].id;
        } else {
          // Create new character with default preset (narrator)
          const preset = VOICE_PRESETS.narrator;
          const charResult = await pool.query(
            'INSERT INTO characters (project_id, name, preset_key, elevenlabs_voice_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [project_id, characterName, 'narrator', preset.elevenlabs_voice_id]
          );
          characterMap[characterName] = charResult.rows[0].id;
        }
      }
      characterId = characterMap[characterName];

      // Create line
      const linePos = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM lines WHERE scene_id = $1',
        [sceneId]
      );
      await pool.query(
        'INSERT INTO lines (scene_id, character_id, text, emotion, position) VALUES ($1, $2, $3, $4, $5)',
        [sceneId, characterId, lineText, emotion, linePos.rows[0].next]
      );
      lineCount++;
    }

    res.json({
      success: true,
      lines_imported: lineCount,
      scenes_created: Object.keys(createdScenes).length,
      characters_created: Object.keys(characterMap).length,
      message: `Successfully imported ${lineCount} lines into ${Object.keys(createdScenes).length} scenes with ${Object.keys(characterMap).length} characters`
    });

  } catch (err) {
    console.error('[Import] Error:', err);
    res.status(500).json({ error: 'Failed to import dialogue: ' + err.message });
  }
});

module.exports = router;
