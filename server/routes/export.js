const express = require('express');
const fetch = require('node-fetch');
const pool = require('../db/pool');
const { validateToken, attachUser } = require('../middleware/auth');
const archiver = require('archiver');

const router = express.Router();

// Public export endpoints (no auth required)

// GET /api/export/scene/:id — export all lines in a scene as JSON manifest
// (Client handles the actual download — we just return the data)
router.get('/scene/:id', async (req, res) => {
  try {
    const scene = await pool.query(
      `SELECT s.* FROM scenes s WHERE s.id = $1`,
      [req.params.id]
    );
    if (!scene.rows.length) return res.status(404).json({ error: 'Scene not found' });

    const lines = await pool.query(
      `SELECT l.*, c.name AS character_name, c.preset_key
       FROM lines l
       JOIN characters c ON c.id = l.character_id
       WHERE l.scene_id = $1
       ORDER BY l.position ASC`,
      [req.params.id]
    );

    const manifest = {
      scene: scene.rows[0].name,
      exported_at: new Date().toISOString(),
      lines: lines.rows.map((l, i) => ({
        index: i + 1,
        filename: `${String(i + 1).padStart(3, '0')}_${l.character_name.toLowerCase().replace(/\s+/g, '_')}_${l.text.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '_')}.mp3`,
        character: l.character_name,
        preset: l.preset_key,
        emotion: l.emotion,
        text: l.text,
        audio_url: l.audio_url,
      })),
    };

    res.json(manifest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/project/:id — export entire project manifest (public)
router.get('/project/:id', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const scenes = await pool.query(
      'SELECT * FROM scenes WHERE project_id = $1 ORDER BY position ASC',
      [req.params.id]
    );

    const lines = await pool.query(
      `SELECT l.*, s.name AS scene_name, c.name AS character_name, c.preset_key
       FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       JOIN characters c ON c.id = l.character_id
       WHERE s.project_id = $1
       ORDER BY s.position ASC, l.position ASC`,
      [req.params.id]
    );

    const manifest = {
      project: project.rows[0].name,
      exported_at: new Date().toISOString(),
      unity_note: 'Place audio files in Assets/Audio/VoiceLines/ in your Unity project.',
      scenes: scenes.rows.map(scene => ({
        scene: scene.name,
        lines: lines.rows
          .filter(l => l.scene_id === scene.id)
          .map((l, i) => ({
            index: i + 1,
            filename: `${scene.name.replace(/\s+/g, '_')}/${String(i + 1).padStart(3, '0')}_${l.character_name.toLowerCase().replace(/\s+/g, '_')}.mp3`,
            character: l.character_name,
            preset: l.preset_key,
            emotion: l.emotion,
            text: l.text,
            audio_url: l.audio_url,
          })),
      })),
    };

    res.json(manifest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/unity/:projectId — export project as ZIP for Unity (public)
router.get('/unity/:projectId', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.projectId]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const lines = await pool.query(
      `SELECT l.*, s.name AS scene_name, s.id AS scene_id, c.name AS character_name
       FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       JOIN characters c ON c.id = l.character_id
       WHERE s.project_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY s.position ASC, l.position ASC`,
      [req.params.projectId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.rows[0].name.replace(/\s+/g, '_')}_VoiceSmith_Export.zip"`);

    // Pipe archive to response
    archive.pipe(res);

    // Track added files to avoid duplicates
    const addedFiles = new Set();
    const metadata = [];

    // Add audio files organized by scene
    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      // Extract base64 audio and decode
      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          // If it's a URL, skip (shouldn't happen but handle gracefully)
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${line.scene_name.replace(/\s+/g, '_')}/${String(metadata.filter(m => m.scene === line.scene_name).length + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.mp3`;

      if (!addedFiles.has(filename)) {
        archive.append(audioBuffer, { name: `Audio/${filename}` });
        addedFiles.add(filename);

        metadata.push({
          scene: line.scene_name,
          character: line.character_name,
          emotion: line.emotion,
          text: line.text,
          filename: filename,
        });
      }
    }

    // Add metadata JSON
    const metadataJson = {
      project: project.rows[0].name,
      exported_at: new Date().toISOString(),
      voicesmith_version: '1.0',
      unity_setup: {
        import_path: 'Assets/Audio/VoiceLines/',
        note: 'Place the Audio folder contents into your Unity project at the import path above.',
      },
      lines: metadata,
    };

    archive.append(JSON.stringify(metadataJson, null, 2), { name: 'voicesmith_metadata.json' });

    // Add README
    const readme = `# VoiceSmith Export for ${project.rows[0].name}

## Setup Instructions

1. Extract this ZIP file
2. Copy the \`Audio\` folder contents to \`Assets/Audio/VoiceLines/\` in your Unity project
3. Import \`voicesmith_metadata.json\` to map audio files to your dialogue system

## Audio Files

The audio files are organized by scene:
${metadata
  .reduce((acc, line) => {
    if (!acc.scenes.includes(line.scene)) {
      acc.scenes.push(line.scene);
    }
    return acc;
  }, { scenes: [] })
  .scenes.map(
    scene =>
      `\n### ${scene}\n${metadata
        .filter(m => m.scene === scene)
        .map(m => `- ${m.character}: "${m.text.slice(0, 50)}..."`)
        .join('\n')}`
  )
  .join('\n')}

## Metadata

See \`voicesmith_metadata.json\` for complete line mappings and metadata.

Generated with VoiceSmith - ${new Date().toLocaleDateString()}
`;

    archive.append(readme, { name: 'README.md' });

    // Finalize archive
    await archive.finalize();

  } catch (err) {
    console.error('[Export Unity] Error:', err);
    res.status(500).json({ error: 'Unity export failed: ' + err.message });
  }
});

// GET /api/export/unreal/:projectId — export project as ZIP for Unreal Engine (public)
router.get('/unreal/:projectId', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.projectId]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const lines = await pool.query(
      `SELECT l.*, s.name AS scene_name, s.id AS scene_id, c.name AS character_name
       FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       JOIN characters c ON c.id = l.character_id
       WHERE s.project_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY s.position ASC, l.position ASC`,
      [req.params.projectId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.rows[0].name.replace(/\s+/g, '_')}_Unreal_Export.zip"`);
    archive.pipe(res);

    const addedFiles = new Set();
    const metadata = [];

    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${line.scene_name.replace(/\s+/g, '_')}/${String(metadata.filter(m => m.scene === line.scene_name).length + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.wav`;

      if (!addedFiles.has(filename)) {
        archive.append(audioBuffer, { name: `Audio/${filename}` });
        addedFiles.add(filename);
        metadata.push({
          scene: line.scene_name,
          character: line.character_name,
          emotion: line.emotion,
          text: line.text,
          filename: filename,
        });
      }
    }

    const metadataJson = {
      project: project.rows[0].name,
      exported_at: new Date().toISOString(),
      voicesmith_version: '1.0',
      unreal_setup: {
        import_path: '/Game/Audio/VoiceLines/',
        note: 'Place the Audio folder contents into your Unreal project at the import path above. Configure Sound Waves to load the .wav files.',
      },
      lines: metadata,
    };

    archive.append(JSON.stringify(metadataJson, null, 2), { name: 'voicesmith_metadata.json' });

    const readme = `# VoiceSmith Export for ${project.rows[0].name} (Unreal Engine)

## Setup Instructions

1. Extract this ZIP file
2. Copy the \`Audio\` folder contents to \`/Game/Audio/VoiceLines/\` in your Unreal project
3. In Unreal Editor:
   - Navigate to the Audio folder in Content Browser
   - Right-click and select "Import"
   - Select all .wav files from the export
   - Configure Sound Wave settings as needed
4. Use \`voicesmith_metadata.json\` to map audio files to your dialogue system

## Audio Files

The audio files are organized by scene:
${metadata
  .reduce((acc, line) => {
    if (!acc.scenes.includes(line.scene)) {
      acc.scenes.push(line.scene);
    }
    return acc;
  }, { scenes: [] })
  .scenes.map(
    scene =>
      `\n### ${scene}\n${metadata
        .filter(m => m.scene === scene)
        .map(m => `- ${m.character}: "${m.text.slice(0, 50)}..."`)
        .join('\n')}`
  )
  .join('\n')}

## Metadata

See \`voicesmith_metadata.json\` for complete line mappings and metadata.

Generated with VoiceSmith - ${new Date().toLocaleDateString()}
`;

    archive.append(readme, { name: 'README_UNREAL.md' });
    await archive.finalize();

  } catch (err) {
    console.error('[Export Unreal] Error:', err);
    res.status(500).json({ error: 'Unreal export failed: ' + err.message });
  }
});

// GET /api/export/godot/:projectId — export project as ZIP for Godot (public)
router.get('/godot/:projectId', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.projectId]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const lines = await pool.query(
      `SELECT l.*, s.name AS scene_name, s.id AS scene_id, c.name AS character_name
       FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       JOIN characters c ON c.id = l.character_id
       WHERE s.project_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY s.position ASC, l.position ASC`,
      [req.params.projectId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.rows[0].name.replace(/\s+/g, '_')}_Godot_Export.zip"`);
    archive.pipe(res);

    const addedFiles = new Set();
    const metadata = [];

    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${line.scene_name.replace(/\s+/g, '_')}/${String(metadata.filter(m => m.scene === line.scene_name).length + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.ogg`;

      if (!addedFiles.has(filename)) {
        archive.append(audioBuffer, { name: `Audio/${filename}` });
        addedFiles.add(filename);
        metadata.push({
          scene: line.scene_name,
          character: line.character_name,
          emotion: line.emotion,
          text: line.text,
          filename: filename,
        });
      }
    }

    const metadataJson = {
      project: project.rows[0].name,
      exported_at: new Date().toISOString(),
      voicesmith_version: '1.0',
      godot_setup: {
        import_path: 'res://assets/audio/voice_lines/',
        note: 'Place the Audio folder contents into your Godot project at the import path above. Configure AudioStreamOGGVorbis resources to load the .ogg files.',
      },
      lines: metadata,
    };

    archive.append(JSON.stringify(metadataJson, null, 2), { name: 'voicesmith_metadata.json' });

    const readme = `# VoiceSmith Export for ${project.rows[0].name} (Godot)

## Setup Instructions

1. Extract this ZIP file
2. Copy the \`Audio\` folder contents to \`res://assets/audio/voice_lines/\` in your Godot project
3. In Godot:
   - Navigate to the audio folder in the FileSystem panel
   - Select all .ogg files
   - Configure AudioStreamOGGVorbis settings in the Inspector
4. Use \`voicesmith_metadata.json\` to map audio files to your dialogue system

## Audio Files

The audio files are organized by scene:
${metadata
  .reduce((acc, line) => {
    if (!acc.scenes.includes(line.scene)) {
      acc.scenes.push(line.scene);
    }
    return acc;
  }, { scenes: [] })
  .scenes.map(
    scene =>
      `\n### ${scene}\n${metadata
        .filter(m => m.scene === scene)
        .map(m => `- ${m.character}: "${m.text.slice(0, 50)}..."`)
        .join('\n')}`
  )
  .join('\n')}

## Metadata

See \`voicesmith_metadata.json\` for complete line mappings and metadata.

Generated with VoiceSmith - ${new Date().toLocaleDateString()}
`;

    archive.append(readme, { name: 'README_GODOT.md' });
    await archive.finalize();

  } catch (err) {
    console.error('[Export Godot] Error:', err);
    res.status(500).json({ error: 'Godot export failed: ' + err.message });
  }
});

// GET /api/export/audio/:projectId — export all audio files only (public)
router.get('/audio/:projectId', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.projectId]
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Project not found' });

    const lines = await pool.query(
      `SELECT l.*, s.name AS scene_name, s.id AS scene_id, c.name AS character_name
       FROM lines l
       JOIN scenes s ON s.id = l.scene_id
       JOIN characters c ON c.id = l.character_id
       WHERE s.project_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY s.position ASC, l.position ASC`,
      [req.params.projectId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.rows[0].name.replace(/\s+/g, '_')}_Audio.zip"`);
    archive.pipe(res);

    const addedFiles = new Set();

    // Add audio files organized by scene
    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${line.scene_name.replace(/\s+/g, '_')}/${String(addedFiles.size + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.mp3`;

      if (!addedFiles.has(filename)) {
        archive.append(audioBuffer, { name: filename });
        addedFiles.add(filename);
      }
    }

    // Finalize archive
    await archive.finalize();

  } catch (err) {
    console.error('[Export Audio] Error:', err);
    res.status(500).json({ error: 'Audio export failed: ' + err.message });
  }
});

// Scene-level exports (Unity, Unreal, Godot, Audio)

// GET /api/export/scene-unity/:sceneId — export scene as ZIP for Unity (public)
router.get('/scene-unity/:sceneId', async (req, res) => {
  try {
    const scene = await pool.query(
      'SELECT * FROM scenes WHERE id = $1',
      [req.params.sceneId]
    );
    if (!scene.rows.length) return res.status(404).json({ error: 'Scene not found' });

    const lines = await pool.query(
      `SELECT l.*, c.name AS character_name
       FROM lines l
       JOIN characters c ON c.id = l.character_id
       WHERE l.scene_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY l.position ASC`,
      [req.params.sceneId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${scene.rows[0].name.replace(/\s+/g, '_')}_VoiceSmith_Export.zip"`);
    archive.pipe(res);

    const addedFiles = new Set();
    const metadata = [];

    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${String(metadata.length + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.mp3`;

      if (!addedFiles.has(filename)) {
        archive.append(audioBuffer, { name: `Audio/${filename}` });
        addedFiles.add(filename);
        metadata.push({
          character: line.character_name,
          emotion: line.emotion,
          text: line.text,
          filename: filename,
        });
      }
    }

    archive.append(JSON.stringify({ scene: scene.rows[0].name, lines: metadata }, null, 2), { name: 'voicesmith_metadata.json' });

    const readme = `# VoiceSmith Scene Export for ${scene.rows[0].name} (Unity)

Place audio files in Assets/Audio/VoiceLines/ in your Unity project.`;

    archive.append(readme, { name: 'README.md' });
    await archive.finalize();

  } catch (err) {
    console.error('[Export Scene Unity] Error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// GET /api/export/scene-unreal/:sceneId — export scene as ZIP for Unreal Engine (public)
router.get('/scene-unreal/:sceneId', async (req, res) => {
  try {
    const scene = await pool.query(
      'SELECT * FROM scenes WHERE id = $1',
      [req.params.sceneId]
    );
    if (!scene.rows.length) return res.status(404).json({ error: 'Scene not found' });

    const lines = await pool.query(
      `SELECT l.*, c.name AS character_name
       FROM lines l
       JOIN characters c ON c.id = l.character_id
       WHERE l.scene_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY l.position ASC`,
      [req.params.sceneId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${scene.rows[0].name.replace(/\s+/g, '_')}_Unreal_Export.zip"`);
    archive.pipe(res);

    const metadata = [];

    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${String(metadata.length + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.wav`;
      archive.append(audioBuffer, { name: `Audio/${filename}` });
      metadata.push({ character: line.character_name, emotion: line.emotion, text: line.text, filename });
    }

    archive.append(JSON.stringify({ scene: scene.rows[0].name, lines: metadata }, null, 2), { name: 'voicesmith_metadata.json' });
    archive.append(`# VoiceSmith Scene Export for ${scene.rows[0].name} (Unreal)\n\nPlace audio files in /Game/Audio/VoiceLines/ in your Unreal project.`, { name: 'README_UNREAL.md' });
    await archive.finalize();

  } catch (err) {
    console.error('[Export Scene Unreal] Error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// GET /api/export/scene-godot/:sceneId — export scene as ZIP for Godot (public)
router.get('/scene-godot/:sceneId', async (req, res) => {
  try {
    const scene = await pool.query(
      'SELECT * FROM scenes WHERE id = $1',
      [req.params.sceneId]
    );
    if (!scene.rows.length) return res.status(404).json({ error: 'Scene not found' });

    const lines = await pool.query(
      `SELECT l.*, c.name AS character_name
       FROM lines l
       JOIN characters c ON c.id = l.character_id
       WHERE l.scene_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY l.position ASC`,
      [req.params.sceneId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${scene.rows[0].name.replace(/\s+/g, '_')}_Godot_Export.zip"`);
    archive.pipe(res);

    const metadata = [];

    for (const line of lines.rows) {
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${String(metadata.length + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.ogg`;
      archive.append(audioBuffer, { name: `Audio/${filename}` });
      metadata.push({ character: line.character_name, emotion: line.emotion, text: line.text, filename });
    }

    archive.append(JSON.stringify({ scene: scene.rows[0].name, lines: metadata }, null, 2), { name: 'voicesmith_metadata.json' });
    archive.append(`# VoiceSmith Scene Export for ${scene.rows[0].name} (Godot)\n\nPlace audio files in res://assets/audio/voice_lines/ in your Godot project.`, { name: 'README_GODOT.md' });
    await archive.finalize();

  } catch (err) {
    console.error('[Export Scene Godot] Error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// GET /api/export/scene-audio/:sceneId — export scene audio files only (public)
router.get('/scene-audio/:sceneId', async (req, res) => {
  try {
    const scene = await pool.query(
      'SELECT * FROM scenes WHERE id = $1',
      [req.params.sceneId]
    );
    if (!scene.rows.length) return res.status(404).json({ error: 'Scene not found' });

    const lines = await pool.query(
      `SELECT l.*, c.name AS character_name
       FROM lines l
       JOIN characters c ON c.id = l.character_id
       WHERE l.scene_id = $1 AND l.audio_url IS NOT NULL
       ORDER BY l.position ASC`,
      [req.params.sceneId]
    );

    if (lines.rows.length === 0) {
      return res.status(400).json({ error: 'No audio files to export. Generate voice lines first.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${scene.rows[0].name.replace(/\s+/g, '_')}_Audio.zip"`);
    archive.pipe(res);

    for (let i = 0; i < lines.rows.length; i++) {
      const line = lines.rows[i];
      if (!line.audio_url) continue;

      let audioBuffer;
      try {
        if (line.audio_url.startsWith('data:audio')) {
          const base64 = line.audio_url.split(',')[1];
          audioBuffer = Buffer.from(base64, 'base64');
        } else {
          continue;
        }
      } catch (err) {
        console.error(`Failed to decode audio for line ${line.id}:`, err);
        continue;
      }

      const filename = `${String(i + 1).padStart(3, '0')}_${line.character_name.toLowerCase().replace(/\s+/g, '_')}.mp3`;
      archive.append(audioBuffer, { name: filename });
    }

    await archive.finalize();

  } catch (err) {
    console.error('[Export Scene Audio] Error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

module.exports = router;
