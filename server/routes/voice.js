const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');
const { VOICE_PRESETS, EMOTION_MODIFIERS, PLAN_LIMITS } = require('../lib/presets');

const router = express.Router();

// Public preview endpoint (no auth required)
router.get('/preview/:presetKey', async (req, res) => {
  const { presetKey } = req.params;
  const preset = VOICE_PRESETS[presetKey];

  if (!preset) {
    return res.status(404).json({ error: 'Preset not found' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Voice preview not available' });
  }

  try {
    const demoText = preset.demo_line || 'Hello! This is a preview of my voice.';
    console.log(`[Preview] Generating demo for: ${presetKey}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${preset.elevenlabs_voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: demoText,
          model_id: 'eleven_turbo_v2_5',
          language_code: 'en',
          voice_settings: {
            stability: preset.default_settings.stability,
            similarity_boost: preset.default_settings.similarity_boost,
            style: preset.default_settings.style,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Preview] ElevenLabs error:', err);
      return res.status(response.status).json({ error: 'Voice preview failed' });
    }

    // Handle both node-fetch v2 (buffer) and v3+ (arrayBuffer)
    let audioBuffer;
    if (typeof response.buffer === 'function') {
      audioBuffer = await response.buffer();
    } else {
      audioBuffer = await response.arrayBuffer();
      audioBuffer = Buffer.from(audioBuffer);
    }

    res.type('audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[Preview] Error:', err.message);
    res.status(500).json({ error: 'Preview failed: ' + err.message });
  }
});

// Public export endpoint (no auth required)
router.get('/export/scene/:scene_id', async (req, res) => {
  const { scene_id } = req.params;

  try {
    console.log(`[Export] Exporting scene ${scene_id}`);

    // Verify scene exists
    const sceneCheck = await pool.query(
      `SELECT s.id, s.name FROM scenes s
       WHERE s.id = $1`,
      [scene_id]
    );
    if (!sceneCheck.rows.length) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const sceneName = sceneCheck.rows[0].name;

    // Get all lines from this scene with character info
    const linesResult = await pool.query(
      `SELECT
         l.id, l.text, l.emotion, l.position,
         l.audio_url,
         c.name as character_name,
         s.name as scene_name
       FROM lines l
       JOIN characters c ON l.character_id = c.id
       JOIN scenes s ON l.scene_id = s.id
       WHERE s.id = $1
       ORDER BY l.position ASC`,
      [scene_id]
    );

    console.log(`[Export] Found ${linesResult.rows.length} lines for scene`);

    if (!linesResult.rows.length) {
      return res.status(400).json({ error: 'No audio to export' });
    }

    // Build manifest and prepare MP3 data
    const manifest = {
      exported_at: new Date().toISOString(),
      scene: sceneName,
      scene_id: scene_id,
      total_lines: linesResult.rows.length,
      lines: []
    };

    const lines = linesResult.rows;
    const sanitizedScene = sceneName.toLowerCase().replace(/\s+/g, '_');

    // Create archive
    const archive = archiver('zip', { zlib: { level: 6 } });

    res.attachment(`${sanitizedScene}-export-${Date.now()}.zip`);
    res.type('application/zip');

    archive.on('error', (err) => {
      console.error('[Export] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create export' });
      }
    });

    archive.pipe(res);

    // Add each audio file to the ZIP
    let addedCount = 0;
    lines.forEach((line, idx) => {
      const { scene_name, character_name, emotion, audio_url } = line;

      if (!audio_url) {
        console.log(`[Export] Skipping line ${idx + 1} - no audio_url`);
        return;
      }

      // Generate filename: {scene}_{character}_{emotion}_{index}.mp3
      const sanitizedChar = character_name.toLowerCase().replace(/\s+/g, '_');
      const filename = `${sanitizedScene}_${sanitizedChar}_${emotion}_${String(idx + 1).padStart(3, '0')}.mp3`;

      // Decode base64 audio
      if (audio_url.startsWith('data:audio/mpeg;base64,')) {
        try {
          const base64Data = audio_url.replace('data:audio/mpeg;base64,', '');
          const buffer = Buffer.from(base64Data, 'base64');
          archive.append(buffer, { name: filename });
          addedCount++;

          // Add to manifest
          manifest.lines.push({
            index: idx + 1,
            filename: filename,
            scene: scene_name,
            character: character_name,
            emotion: emotion,
            text: line.text,
          });
        } catch (bufErr) {
          console.error(`[Export] Error adding file ${filename}:`, bufErr.message);
        }
      }
    });

    // Add manifest.json to the ZIP
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    console.log(`[Export] Added ${addedCount} files to scene "${sceneName}" (${scene_id})`);
    archive.finalize();

  } catch (err) {
    console.error('[Export] Fatal error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed: ' + err.message });
    }
  }
});

// Protected routes below
router.use(validateToken, attachUser);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests — slow down.' },
});

// GET /api/voice/presets
router.get('/presets', (req, res) => {
  res.json(VOICE_PRESETS);
});

// GET /api/voice/usage
router.get('/usage', async (req, res) => {
  const limit = PLAN_LIMITS[req.user.plan]?.generations ?? 20;
  res.json({
    plan: req.user.plan,
    used: req.user.generations_used,
    limit: limit === Infinity ? null : limit,
    reset_at: req.user.generations_reset_at,
  });
});

// POST /api/voice/generate
router.post('/generate', limiter, async (req, res) => {
  const { line_id, scene_id, character_id, text, emotion = 'neutral' } = req.body;

  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  if (text.length > 5000) return res.status(400).json({ error: 'text too long (max 5000 chars)' });

  // Check generation limit
  const limit = PLAN_LIMITS[req.user.plan]?.generations ?? 20;
  if (limit !== Infinity && req.user.generations_used >= limit) {
    return res.status(403).json({
      error: 'Generation limit reached',
      code: 'LIMIT_REACHED',
      plan: req.user.plan,
    });
  }

  // Get character and its preset
  let voiceId, settings;
  if (character_id) {
    const charResult = await pool.query(
      `SELECT c.* FROM characters c
       JOIN projects p ON p.id = c.project_id
       WHERE c.id = $1 AND p.user_id = $2`,
      [character_id, req.user.id]
    );
    if (!charResult.rows.length) return res.status(404).json({ error: 'Character not found' });
    const char = charResult.rows[0];
    const preset = VOICE_PRESETS[char.preset_key];
    voiceId = char.elevenlabs_voice_id;
    settings = { ...preset.default_settings };
  } else {
    // Fallback to narrator if no character
    const preset = VOICE_PRESETS.narrator;
    voiceId = preset.elevenlabs_voice_id;
    settings = { ...preset.default_settings };
  }

  // Apply emotion modifiers
  const emotionMod = EMOTION_MODIFIERS[emotion] || EMOTION_MODIFIERS.neutral;
  settings.stability = Math.max(0, Math.min(1, settings.stability + emotionMod.stability));
  settings.style = Math.max(0, Math.min(1, settings.style + emotionMod.style));

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ElevenLabs API key not configured' });

  try {
    console.log(`[Voice] Generating: voice=${voiceId} emotion=${emotion} text="${text.slice(0, 50)}..."`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          language_code: 'en',
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Voice] ElevenLabs error:', err);
      return res.status(response.status).json({ error: 'Voice generation failed' });
    }

    // ElevenLabs returns standards-compliant MP3 (ID3v2 header + Xing/Info
    // frame + audio frames). Browsers decode this natively — do NOT strip
    // headers or frames here. Previous versions tried to remove the Xing/Info
    // frame manually by scanning for the next `0xFF Ex` sync byte, but that
    // pattern hits false positives inside the Info frame itself and slices
    // the buffer mid-frame, producing the "gibberish, then the real line"
    // playback bug. Send the bytes through unchanged.
    const audioBuffer = await response.buffer();

    console.log('[Voice] Audio buffer size:', audioBuffer.length);

    const audioBase64 = audioBuffer.toString('base64');

    // Increment usage counter
    await pool.query(
      'UPDATE users SET generations_used = generations_used + 1 WHERE id = $1',
      [req.user.id]
    );

    // If a line_id was passed, update the line record
    if (line_id) {
      await pool.query(
        `UPDATE lines SET audio_url = $1 WHERE id = $2
         AND scene_id IN (
           SELECT s.id FROM scenes s
           JOIN projects p ON p.id = s.project_id
           WHERE p.user_id = $3
         )`,
        [`data:audio/mpeg;base64,${audioBase64}`, line_id, req.user.id]
      );
    }

    res.json({
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      generations_used: req.user.generations_used + 1,
    });

  } catch (err) {
    console.error('[Voice] Error:', err.message);
    res.status(500).json({ error: 'Voice generation failed: ' + err.message });
  }
});

// POST /api/voice/characters — save a character to a project
router.post('/characters', async (req, res) => {
  const { project_id, name, preset_key } = req.body;
  if (!project_id || !name?.trim() || !preset_key) {
    return res.status(400).json({ error: 'project_id, name, preset_key are required' });
  }
  if (!VOICE_PRESETS[preset_key]) {
    return res.status(400).json({ error: `Invalid preset_key. Must be one of: ${Object.keys(VOICE_PRESETS).join(', ')}` });
  }

  try {
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [project_id, req.user.id]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const preset = VOICE_PRESETS[preset_key];
    const result = await pool.query(
      `INSERT INTO characters (project_id, name, preset_key, elevenlabs_voice_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [project_id, name.trim(), preset_key, preset.elevenlabs_voice_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// PATCH /api/voice/characters/:id — update character preset and/or name
router.patch('/characters/:id', async (req, res) => {
  const { preset_key, name } = req.body;

  if (!preset_key && !name) {
    return res.status(400).json({ error: 'preset_key or name is required' });
  }

  if (preset_key && !VOICE_PRESETS[preset_key]) {
    return res.status(400).json({ error: `Invalid preset_key. Must be one of: ${Object.keys(VOICE_PRESETS).join(', ')}` });
  }

  try {
    const preset = VOICE_PRESETS[preset_key];

    // Build dynamic update query
    let updateClause = '';
    let values = [];
    let paramCount = 1;

    if (preset_key) {
      updateClause += `preset_key = $${paramCount}, elevenlabs_voice_id = $${paramCount + 1}`;
      values.push(preset_key, preset.elevenlabs_voice_id);
      paramCount += 2;
    }

    if (name?.trim()) {
      if (updateClause) updateClause += ', ';
      updateClause += `name = $${paramCount}`;
      values.push(name.trim());
      paramCount += 1;
    }

    values.push(req.params.id, req.user.id);

    const result = await pool.query(
      `UPDATE characters
       SET ${updateClause}
       WHERE id = $${paramCount} AND project_id IN (
         SELECT id FROM projects WHERE user_id = $${paramCount + 1}
       )
       RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Character not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// DELETE /api/voice/characters/:id — delete a character
router.delete('/characters/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM characters
       WHERE id = $1 AND project_id IN (
         SELECT id FROM projects WHERE user_id = $2
       )
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Character not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// POST /api/voice/lines — save a line to a scene
router.post('/lines', async (req, res) => {
  const { scene_id, character_id, text, emotion = 'neutral' } = req.body;
  if (!scene_id || !character_id || !text?.trim()) {
    return res.status(400).json({ error: 'scene_id, character_id, text are required' });
  }

  try {
    const pos = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM lines WHERE scene_id = $1',
      [scene_id]
    );
    const result = await pool.query(
      `INSERT INTO lines (scene_id, character_id, text, emotion, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [scene_id, character_id, text.trim(), emotion, pos.rows[0].next]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save line' });
  }
});

// PATCH /api/voice/lines/:id — update line text and emotion
router.patch('/lines/:id', async (req, res) => {
  const { text, emotion } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'text too long (max 5000 chars)' });
  }

  try {
    const result = await pool.query(
      `UPDATE lines
       SET text = $1, emotion = $2
       WHERE id = $3 AND scene_id IN (
         SELECT s.id FROM scenes s
         JOIN projects p ON p.id = s.project_id
         WHERE p.user_id = $4
       )
       RETURNING *`,
      [text.trim(), emotion || 'neutral', req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Line not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update line' });
  }
});

// DELETE /api/voice/lines/:id
router.delete('/lines/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM lines WHERE id = $1
       AND scene_id IN (
         SELECT s.id FROM scenes s
         JOIN projects p ON p.id = s.project_id
         WHERE p.user_id = $2
       )`,
      [req.params.id, req.user.id]
    );
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete line' });
  }
});

module.exports = router;
