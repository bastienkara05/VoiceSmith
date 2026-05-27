const express = require('express');
const fetch = require('node-fetch');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');
const { VOICE_PRESETS, EMOTION_MODIFIERS, PLAN_LIMITS } = require('../lib/presets');

const router = express.Router();
router.use(validateToken, attachUser);

// POST /api/batch/generate-project — generate all lines in a project
router.post('/generate-project/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    // Verify project exists
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    if (!project.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all lines in project that don't have audio yet
    const lines = await pool.query(
      `SELECT l.*, c.elevenlabs_voice_id, c.preset_key
       FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       JOIN characters c ON c.id = l.character_id
       WHERE s.project_id = $1 AND l.audio_url IS NULL
       ORDER BY s.position, l.position`,
      [projectId]
    );

    if (lines.rows.length === 0) {
      return res.json({
        success: true,
        generated: 0,
        skipped: 0,
        message: 'All lines already have audio'
      });
    }

    // Check generation limit
    const limit = PLAN_LIMITS[req.user.plan]?.generations ?? 20;
    const available = Math.max(0, (limit === Infinity ? Infinity : limit - req.user.generations_used));

    if (available === 0) {
      return res.status(403).json({
        error: 'Generation limit reached',
        code: 'LIMIT_REACHED',
        plan: req.user.plan,
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ElevenLabs API key not configured' });
    }

    // Generate audio for each line
    let generated = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];

    for (const line of lines.rows) {
      // Stop if we hit generation limit
      if (available !== Infinity && generated >= available) {
        skipped += lines.rows.length - generated - failed;
        break;
      }

      try {
        // Get emotion modifiers
        const emotionMod = EMOTION_MODIFIERS[line.emotion] || EMOTION_MODIFIERS.neutral;
        const preset = VOICE_PRESETS[line.preset_key] || {};
        const settings = { ...preset.default_settings };
        settings.stability = Math.max(0, Math.min(1, settings.stability + emotionMod.stability));
        settings.style = Math.max(0, Math.min(1, settings.style + emotionMod.style));

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${line.elevenlabs_voice_id}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text: line.text.trim(),
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
          failed++;
          const err = await response.text();
          errors.push(`Line ${line.id}: ${err}`);
          continue;
        }

        const audioBuffer = await response.buffer();
        const audioBase64 = audioBuffer.toString('base64');

        // Save audio to database
        await pool.query(
          'UPDATE lines SET audio_url = $1 WHERE id = $2',
          [`data:audio/mpeg;base64,${audioBase64}`, line.id]
        );

        generated++;
      } catch (err) {
        failed++;
        errors.push(`Line ${line.id}: ${err.message}`);
      }
    }

    // Update usage
    await pool.query(
      'UPDATE users SET generations_used = generations_used + $1 WHERE id = $2',
      [generated, req.user.id]
    );

    res.json({
      success: true,
      generated,
      failed,
      skipped,
      message: `Generated ${generated} lines${failed > 0 ? `, ${failed} failed` : ''}${skipped > 0 ? `, ${skipped} skipped (limit)` : ''}`,
      errors: errors.slice(0, 5), // Return first 5 errors
    });

  } catch (err) {
    console.error('[Batch] Error:', err);
    res.status(500).json({ error: 'Batch generation failed: ' + err.message });
  }
});

// POST /api/batch/generate-scene — generate all lines in a scene
router.post('/generate-scene/:sceneId', async (req, res) => {
  const { sceneId } = req.params;

  try {
    // Verify scene exists and belongs to user
    const scene = await pool.query(
      `SELECT s.id FROM scenes s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1 AND p.user_id = $2`,
      [sceneId, req.user.id]
    );
    if (!scene.rows.length) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    // Get all lines in scene without audio
    const lines = await pool.query(
      `SELECT l.*, c.elevenlabs_voice_id, c.preset_key
       FROM lines l
       JOIN characters c ON c.id = l.character_id
       WHERE l.scene_id = $1 AND l.audio_url IS NULL
       ORDER BY l.position`,
      [sceneId]
    );

    if (lines.rows.length === 0) {
      return res.json({
        success: true,
        generated: 0,
        message: 'All lines already have audio'
      });
    }

    // Check generation limit
    const limit = PLAN_LIMITS[req.user.plan]?.generations ?? 20;
    const available = Math.max(0, (limit === Infinity ? Infinity : limit - req.user.generations_used));

    if (available === 0) {
      return res.status(403).json({
        error: 'Generation limit reached',
        code: 'LIMIT_REACHED',
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ElevenLabs API key not configured' });
    }

    // Generate audio (same logic as project batch)
    let generated = 0;
    let failed = 0;

    for (const line of lines.rows) {
      if (available !== Infinity && generated >= available) break;

      try {
        const emotionMod = EMOTION_MODIFIERS[line.emotion] || EMOTION_MODIFIERS.neutral;
        const preset = VOICE_PRESETS[line.preset_key] || {};
        const settings = { ...preset.default_settings };
        settings.stability = Math.max(0, Math.min(1, settings.stability + emotionMod.stability));
        settings.style = Math.max(0, Math.min(1, settings.style + emotionMod.style));

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${line.elevenlabs_voice_id}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text: line.text.trim(),
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
          failed++;
          continue;
        }

        const audioBuffer = await response.buffer();
        const audioBase64 = audioBuffer.toString('base64');

        await pool.query(
          'UPDATE lines SET audio_url = $1 WHERE id = $2',
          [`data:audio/mpeg;base64,${audioBase64}`, line.id]
        );

        generated++;
      } catch (err) {
        failed++;
      }
    }

    await pool.query(
      'UPDATE users SET generations_used = generations_used + $1 WHERE id = $2',
      [generated, req.user.id]
    );

    res.json({
      success: true,
      generated,
      failed,
      message: `Generated ${generated} lines in scene${failed > 0 ? `, ${failed} failed` : ''}`
    });

  } catch (err) {
    console.error('[Batch Scene] Error:', err);
    res.status(500).json({ error: 'Scene generation failed: ' + err.message });
  }
});

module.exports = router;
