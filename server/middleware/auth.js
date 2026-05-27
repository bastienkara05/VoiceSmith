const { auth } = require('express-oauth2-jwt-bearer');
const pool = require('../db/pool');

// Validate the Auth0 JWT
const validateToken = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
});

// Attach or create the user record in our DB
const attachUser = async (req, res, next) => {
  try {
    const auth0Id = req.auth.payload.sub;
    const email = req.auth.payload[`${process.env.AUTH0_AUDIENCE}/email`]
      || req.auth.payload.email
      || '';

    console.log('[Auth] Token payload keys:', Object.keys(req.auth.payload));
    console.log('[Auth] Extracted email:', email, 'Auth0 ID:', auth0Id);

    let result = await pool.query(
      'SELECT * FROM users WHERE auth0_id = $1',
      [auth0Id]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO users (auth0_id, email)
         VALUES ($1, $2)
         ON CONFLICT (auth0_id) DO UPDATE SET email = $2
         RETURNING *`,
        [auth0Id, email]
      );
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('attachUser error:', err);
    res.status(500).json({ error: 'Auth error' });
  }
};

module.exports = { validateToken, attachUser };
