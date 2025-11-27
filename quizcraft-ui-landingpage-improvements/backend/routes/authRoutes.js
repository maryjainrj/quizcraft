// backend/routes/authRoutes.js
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// ===== New deps for OTP reset =====
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const User = require('../models/User');

const router = express.Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// postmessage
const oauth2 = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'postmessage');

/* GOOGLE CODE FLOW*/
router.post('/auth/google/code', async (req, res) => {
  try {
    console.log('[google/code] body:', req.body); // debug
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Missing authorization code' });

    const { tokens } = await oauth2.getToken(code); // exchange single-use code
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

/*  OTP PASSWORD RESET   */

// Reusable mail transporter 
async function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  const test = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: test.smtp.host,
    port: test.smtp.port,
    secure: test.smtp.secure,
    auth: { user: test.user, pass: test.pass },
  });
}

/**
 * POST /api/auth/request-password-otp
 
 */
router.post('/auth/request-password-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user) {
      // Don't reveal that the email doesn't exist.
      return res.json({ message: 'If that email exists, an OTP was sent.' });
    }

    // Create 6-digit OTP
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();

    // Store hash + expiry (15 min) + attempts counter
    user.passwordOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
    user.passwordOtpExpires = Date.now() + 15 * 60 * 1000;
    user.passwordOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });

    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || '"QuizCraft" <no-reply@quizcraft.local>',
      to: user.email,
      subject: 'Your QuizCraft password reset code',
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
          <p>Hello${user.name ? ' ' + user.name : ''},</p>
          <p>Your password reset OTP is:</p>
          <p style="font-size:20px;font-weight:bold;letter-spacing:2px">${otp}</p>
          <p>This code expires in <b>15 minutes</b>.</p>
          <p>If you didn’t request this, you can ignore this email.</p>
        </div>
      `,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('🔗 Ethereal preview:', preview);

    return res.json({ message: 'If that email exists, an OTP was sent.' });
  } catch (err) {
    console.error('request-password-otp failed:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
});

/**
 * POST /api/auth/reset-password-otp
 * body: { email, otp, password }
 */
router.post('/auth/reset-password-otp', async (req, res) => {
  try {
    const { email, otp, password } = req.body || {};
    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Email, OTP, and password are required' });
    }

    const user = await User.findOne({ email: (email || '').toLowerCase() })
      .select('+password +passwordOtpHash +passwordOtpAttempts');

    if (!user || !user.passwordOtpHash || !user.passwordOtpExpires) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Expired
    if (user.passwordOtpExpires < Date.now()) {
      user.passwordOtpHash = undefined;
      user.passwordOtpExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    user.passwordOtpAttempts = (user.passwordOtpAttempts || 0) + 1;
    if (user.passwordOtpAttempts > 5) {
      user.passwordOtpHash = undefined;
      user.passwordOtpExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'Too many attempts. Request a new OTP.' });
    }

    // Verify OTP
    const candidate = crypto.createHash('sha256').update(otp).digest('hex');
    if (candidate !== user.passwordOtpHash) {
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    // OTP ok → set new password 
    user.password = password;
    user.passwordOtpHash = undefined;
    user.passwordOtpExpires = undefined;
    user.passwordOtpAttempts = 0;
    await user.save();

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('reset-password-otp failed:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;
