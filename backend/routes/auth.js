const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const router = express.Router();

// ── HELPERS ───────────────────────────────────────────────
function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

async function sendEmail(to, subject, html) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"யாளை கவளம் | Yaanai Kavalam" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html
  });
}

function otpEmailHTML(name, otp, purpose) {
  const titles = {
    register: '✅ Verify Your Account',
    reset: '🔑 Reset Your Password'
  };
  return `
  <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#FFF8F0;padding:30px;border-radius:16px;">
    <div style="background:#1B4332;padding:20px;border-radius:12px;text-align:center;margin-bottom:25px;">
      <h2 style="color:#C9A84C;margin:0;font-size:24px;">🐘 யாளை கவளம்</h2>
      <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;font-size:13px;">Yaanai Kavalam — Rajabaron Signature Health Food</p>
    </div>
    <h3 style="color:#1B4332;">${titles[purpose] || 'OTP Verification'}</h3>
    <p style="color:#555;">Hello <strong>${name}</strong>,<br>Your One-Time Password is:</p>
    <div style="background:#1B4332;border-radius:12px;padding:22px;text-align:center;margin:20px 0;">
      <span style="font-size:44px;font-weight:bold;color:#C9A84C;letter-spacing:12px;">${otp}</span>
    </div>
    <p style="color:#888;font-size:13px;">⏰ This OTP expires in <strong>10 minutes</strong>.</p>
    <p style="color:#888;font-size:13px;">🔒 Do not share this OTP with anyone.</p>
    <div style="border-top:1px solid #ddd;margin-top:20px;padding-top:15px;text-align:center;color:#aaa;font-size:11px;">
      © 2024 Yuazhini Foods | Only Added Food Ingredients
    </div>
  </div>`;
}

// Global OTP store (in-memory, keyed by email+purpose)
global.otpStore = global.otpStore || {};

function storeOTP(email, purpose, otp, extra = {}) {
  const key = email.toLowerCase() + ':' + purpose;
  global.otpStore[key] = {
    otp,
    expiry: new Date(Date.now() + 10 * 60 * 1000),
    ...extra
  };
}

function verifyOTP(email, purpose, otp) {
  const key = email.toLowerCase() + ':' + purpose;
  const stored = global.otpStore[key];
  if (!stored) return { valid: false, message: 'OTP expired. Please request a new one.' };
  if (stored.otp !== otp) return { valid: false, message: 'Incorrect OTP. Please try again.' };
  if (new Date() > stored.expiry) return { valid: false, message: 'OTP has expired. Please request a new one.' };
  delete global.otpStore[key];
  return { valid: true, data: stored };
}

// ── SEND REGISTER OTP ─────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, message: 'Email and name required' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered. Please login.' });

    const otp = generateOTP();
    storeOTP(email, 'register', otp, { name });
    await sendEmail(email, '🔐 Your OTP for Yaanai Kavalam Account', otpEmailHTML(name, otp, 'register'));

    res.json({ success: true, message: 'OTP sent to ' + email });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Check Gmail credentials in .env' });
  }
});

// ── REGISTER ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, otp } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    // Verify OTP
    const result = verifyOTP(email, 'register', otp);
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });

    const user = new User({ name: name.trim(), email: email.toLowerCase(), password, phone, isVerified: true });
    await user.save();

    // Send welcome email
    sendEmail(email, '🎉 Welcome to Yaanai Kavalam!', `
      <div style="font-family:Arial;max-width:500px;margin:0 auto;padding:30px;background:#FFF8F0;border-radius:16px;">
        <div style="background:#1B4332;padding:20px;border-radius:12px;text-align:center;margin-bottom:20px;">
          <h2 style="color:#C9A84C;margin:0;">🐘 யாளை கவளம்</h2>
        </div>
        <h3 style="color:#1B4332;">Welcome, ${name}! 🎉</h3>
        <p>Your account has been created successfully.</p>
        <p>You can now shop for our traditional health foods at <a href="${process.env.FRONTEND_URL}" style="color:#1B4332;">Yaanai Kavalam</a>.</p>
        <p style="color:#888;font-size:13px;">Thank you for joining us!</p>
      </div>`
    ).catch(() => {});

    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Registration failed: ' + err.message });
  }
});

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ success: false, message: 'No account found with this email' });
    if (!user.password) return res.status(401).json({ success: false, message: 'This account uses Google login. Use Google Sign In.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password' });

    const token = generateToken(user._id);
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed: ' + err.message });
  }
});

// ── FORGOT PASSWORD — Send OTP ────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });
    if (!user.password) return res.status(400).json({ success: false, message: 'This account uses Google login. No password to reset.' });

    const otp = generateOTP();
    storeOTP(email, 'reset', otp, { userId: user._id.toString() });
    await sendEmail(email, '🔑 Reset Your Yaanai Kavalam Password', otpEmailHTML(user.name, otp, 'reset'));

    res.json({ success: true, message: 'Password reset OTP sent to ' + email });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP: ' + err.message });
  }
});

// ── RESET PASSWORD — Verify OTP + Set new password ────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Email, OTP and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const result = verifyOTP(email, 'reset', otp);
    if (!result.valid) return res.status(400).json({ success: false, message: result.message });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    // Send confirmation email
    sendEmail(email, '✅ Password Changed — Yaanai Kavalam', `
      <div style="font-family:Arial;max-width:500px;margin:0 auto;padding:30px;background:#FFF8F0;border-radius:16px;">
        <div style="background:#1B4332;padding:20px;border-radius:12px;text-align:center;margin-bottom:20px;">
          <h2 style="color:#C9A84C;margin:0;">🐘 யாளை கவளம்</h2>
        </div>
        <h3 style="color:#1B4332;">Password Changed Successfully ✅</h3>
        <p>Hello ${user.name}, your password has been reset successfully.</p>
        <p style="color:#888;font-size:13px;">If you did not make this change, contact us immediately at ${process.env.ADMIN_EMAIL}</p>
      </div>`
    ).catch(() => {});

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password reset failed: ' + err.message });
  }
});

// ── ADMIN LOGIN ───────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
  try {
    const { secret } = req.body;
    if (!secret || secret !== process.env.ADMIN_SECRET) return res.status(401).json({ success: false, message: 'Invalid admin key' });
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({ name: 'Admin', email: process.env.ADMIN_EMAIL, role: 'admin', isVerified: true });
      await admin.save();
    }
    const token = generateToken(admin._id);
    res.json({ success: true, token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Admin login failed: ' + err.message });
  }
});

// ── GET ME ────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

router.get('/google', (req, res) => {
  res.redirect('/?msg=google-oauth-coming-soon');
});

module.exports = router;