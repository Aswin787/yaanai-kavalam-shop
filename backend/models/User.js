const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  phone: { type: String, trim: true },
  googleId: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isVerified: { type: Boolean, default: false },
  otp: { code: String, expiry: Date },
  addresses: [{
    name: String, phone: String, address: String,
    city: String, state: String, pincode: String,
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false }
  }]
}, { timestamps: true });

// FIXED: no next() parameter — mongoose supports async pre hooks
userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);