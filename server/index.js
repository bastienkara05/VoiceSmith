require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/scenes',   require('./routes/scenes'));
app.use('/api/voice',    require('./routes/voice'));
app.use('/api/export',   require('./routes/export'));
app.use('/api/import',   require('./routes/import'));
app.use('/api/batch',    require('./routes/batch'));
app.use('/api/account',  require('./routes/account'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🔨 VoiceSmith API running at http://localhost:${PORT}`);
  console.log(`   Auth0 domain:  ${process.env.AUTH0_DOMAIN || '⚠️  not set'}`);
  console.log(`   ElevenLabs:    ${process.env.ELEVENLABS_API_KEY ? '✅ key loaded' : '⚠️  not set'}`);
  console.log(`   Database:      ${process.env.DATABASE_URL ? '✅ connected' : '⚠️  not set'}\n`);
});
