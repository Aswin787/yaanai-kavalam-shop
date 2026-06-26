const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  phone: String,
  googleId: String,
  avatar: String,
  role: { type: String, enum: ['customer','admin'], default: 'customer' },
  isVerified: { type: Boolean, default: false },
  addresses: [{ name:String, phone:String, address:String, city:String, state:String, pincode:String, country:{ type:String, default:'India' }, isDefault:{ type:Boolean, default:false } }],
  otp: { code: String, expiry: Date }
}, { timestamps: true });
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12); next();
});
userSchema.methods.comparePassword = function(p) { return bcrypt.compare(p, this.password); };
module.exports = mongoose.model('User', userSchema);
