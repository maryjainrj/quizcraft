// routes/authRoutes.js
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const router = express.Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// CRITICAL: 'postmessage' redirect for JS code flow
const oauth2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'postmessage');

router.post('/auth/google/code', async (req, res) => {
  try {
    console.log('[google/code] body:', req.body);               // <-- keep for debug
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Missing authorization code' });

    const { tokens } = await oauth2.getToken(code);             // exchange single-use code
    console.log('[google/code] tokens keys:', Object.keys(tokens));

    const ticket = await oauth2.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });
    const profile = ticket.getPayload();
    console.log('[google/code] profile:', { email: profile.email, sub: profile.sub });

    const appToken = jwt.sign({ sub: profile.sub, email: profile.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token: appToken, user: { email: profile.email, name: profile.name } });
  } catch (err) {
    console.error('Google code exchange error:', err?.response?.data || err.message || err);
    return res.status(401).json({ message: 'Google code exchange failed' });
  }
});

module.exports = router;
