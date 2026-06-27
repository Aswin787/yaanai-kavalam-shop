const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

/** Generate JWT token */
function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ── REGISTER ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered. Please login instead.' });
    }

    const user = new User({ name, email: email.toLowerCase(), password, phone });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this email address' });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: 'This account uses Google login. Please use Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ── ADMIN LOGIN ───────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
  try {
    const { secret } = req.body;

    if (!secret) {
      return res.status(400).json({ success: false, message: 'Admin secret key is required' });
    }

    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ success: false, message: 'Invalid admin secret key' });
    }

    // Find or create admin user
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = await User.create({
        name: 'Admin',
        email: process.env.ADMIN_EMAIL || 'aswinjk787@gmail.com',
        role: 'admin',
        isVerified: true
      });
    }

    const token = generateToken(admin._id);
    res.json({
      success: true,
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ success: false, message: 'Admin login failed. Please try again.' });
  }
});

// ── GET CURRENT USER ──────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// ── GOOGLE OAUTH PLACEHOLDER ──────────────────────────────
router.get('/google', (req, res) => {
  res.redirect('/?msg=google-oauth-coming-soon');
});

module.exports = router;