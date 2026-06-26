const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

function generateToken(id) { return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn:'7d'}); }

router.post('/register', async (req,res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (await User.findOne({email})) return res.status(400).json({success:false,message:'Email already exists'});
    const user = await User.create({name,email,password,phone});
    res.json({success:true, token:generateToken(user._id), user:{id:user._id,name,email,role:user.role}});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.post('/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({email});
    if (!user || !await user.comparePassword(password)) return res.status(401).json({success:false,message:'Invalid credentials'});
    res.json({success:true, token:generateToken(user._id), user:{id:user._id,name:user.name,email,role:user.role}});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.post('/admin-login', async (req,res) => {
  try {
    const { secret } = req.body;
    if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({success:false,message:'Invalid admin secret'});
    let admin = await User.findOne({role:'admin'});
    if (!admin) admin = await User.create({name:'Admin',email:process.env.ADMIN_EMAIL,role:'admin',isVerified:true});
    res.json({success:true, token:generateToken(admin._id), user:{id:admin._id,name:admin.name,email:admin.email,role:'admin'}});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

module.exports = router;
