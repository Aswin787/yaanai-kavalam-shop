const fs = require('fs');

function write(filePath, content) {
  const parts = filePath.split('/');
  for (let i = 1; i < parts.length; i++) {
    const dir = parts.slice(0, i).join('/');
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir);
  }
  fs.writeFileSync(filePath, content);
  console.log('✅ Created: ' + filePath);
}

// Backend .env
write('backend/.env', `PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/yaanai-kavalam
JWT_SECRET=yaanai_kavalam_super_secret_key_2024
JWT_REFRESH_SECRET=yaanai_kavalam_refresh_secret_2024
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_SENDER_ID=YNKFLM
MSG91_TEMPLATE_ID=your_template_id
MSG91_WHATSAPP_NUMBER=your_whatsapp_number
ADMIN_PHONE=+918925253862
ADMIN_EMAIL=your@gmail.com
ADMIN_SECRET=yaanai_admin_2024
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable
GOOGLE_SHEET_ID=your_sheet_id
FRONTEND_URL=http://localhost:5000`);

// server.js
write('backend/server.js', `const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const responseTime = require('response-time');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
require('./services/cronJobs');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(responseTime());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend'), { maxAge: '7d' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 5000, () => console.log('Server running on port ' + (process.env.PORT || 5000)));
  })
  .catch(err => { console.error('MongoDB error:', err.message); process.exit(1); });
`);

// Models
write('backend/models/User.js', `const mongoose = require('mongoose');
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
`);

write('backend/models/Product.js', `const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameTamil: { type: String, default: 'யாளை கவளம்' },
  description: { type: String, required: true },
  descriptionTamil: String,
  price: { type: Number, required: true },
  priceUSD: Number,
  images: [String],
  ingredients: [{ name:String, nameTamil:String, image:String, benefit:String }],
  benefits: [{ title:String, titleTamil:String, icon:String }],
  stock: { type: Number, default: 100 },
  weight: { type: String, default: '250g' },
  category: { type: String, default: 'health-food' },
  ratings: { average: { type:Number, default:0 }, count: { type:Number, default:0 } },
  reviews: [{ user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, name:String, rating:Number, comment:String, date:{ type:Date, default:Date.now } }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('Product', productSchema);
`);

write('backend/models/Order.js', `const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customer: { userId:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, name:{ type:String, required:true }, email:{ type:String, required:true }, phone:{ type:String, required:true } },
  items: [{ productId:{ type:mongoose.Schema.Types.ObjectId, ref:'Product' }, name:String, price:Number, quantity:Number, image:String }],
  address: { line1:String, line2:String, city:String, state:String, pincode:String, country:String },
  pricing: { subtotal:Number, gst:Number, shipping:{ type:Number, default:0 }, discount:{ type:Number, default:0 }, total:Number },
  payment: { method:{ type:String, enum:['razorpay','stripe','cod'] }, status:{ type:String, enum:['pending','paid','failed'], default:'pending' }, transactionId:String },
  status: { type:String, enum:['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'], default:'placed' },
  statusHistory: [{ status:String, timestamp:{ type:Date, default:Date.now }, note:String }],
  expectedDelivery: Date,
  currency: { type:String, default:'INR' }
}, { timestamps: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.pre('save', function(next) {
  if (!this.orderId) this.orderId = 'YK' + Date.now() + Math.random().toString(36).substr(2,4).toUpperCase();
  next();
});
module.exports = mongoose.model('Order', orderSchema);
`);

write('backend/models/Settings.js', `const mongoose = require('mongoose');
const settingsSchema = new mongoose.Schema({ key:{ type:String, required:true, unique:true }, value:{ type:mongoose.Schema.Types.Mixed, required:true }, updatedAt:{ type:Date, default:Date.now } });
settingsSchema.statics.get = async function(key, def=null) { const s = await this.findOne({key}); return s ? s.value : def; };
settingsSchema.statics.set = async function(key, value) { return this.findOneAndUpdate({key},{key,value,updatedAt:new Date()},{upsert:true,new:true}); };
module.exports = mongoose.model('Settings', settingsSchema);
`);

write('backend/models/ErrorLog.js', `const mongoose = require('mongoose');
const s = new mongoose.Schema({ type:{type:String,enum:['sms','email','whatsapp','sheets','payment','general']}, message:String, details:mongoose.Schema.Types.Mixed, orderId:String, resolved:{type:Boolean,default:false} },{timestamps:true});
module.exports = mongoose.model('ErrorLog', s);
`);

// Middleware
write('backend/middleware/auth.js', `const jwt = require('jsonwebtoken');
const User = require('../models/User');
module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (!token) return res.status(401).json({ success:false, message:'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success:false, message:'User not found' });
    next();
  } catch(err) { res.status(401).json({ success:false, message:'Invalid token' }); }
};
`);

write('backend/middleware/adminOnly.js', `module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ success:false, message:'Admin only' });
  next();
};
`);

// Services
write('backend/services/emailService.js', `const nodemailer = require('nodemailer');
const ErrorLog = require('../models/ErrorLog');
const transporter = nodemailer.createTransport({ service:'gmail', auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_APP_PASSWORD } });

async function sendAdminOrderEmail(order) {
  const items = order.items.map(i => '<tr><td>'+i.name+'</td><td>'+i.quantity+'</td><td>Rs.'+i.price+'</td></tr>').join('');
  await transporter.sendMail({ from:'"Yaanai Kavalam" <'+process.env.GMAIL_USER+'>', to:process.env.ADMIN_EMAIL,
    subject:'New Order #'+order.orderId+' - Rs.'+order.pricing.total,
    html:'<h2>New Order Received</h2><p>Customer: '+order.customer.name+'</p><p>Phone: '+order.customer.phone+'</p><p>Address: '+order.address.line1+', '+order.address.city+', '+order.address.state+'</p><table border=1>'+items+'</table><p><b>Total: Rs.'+order.pricing.total+'</b></p><p>Payment: '+order.payment.method+'</p>'
  });
}

async function sendCustomerConfirmationEmail(order) {
  await transporter.sendMail({ from:'"Yaanai Kavalam" <'+process.env.GMAIL_USER+'>', to:order.customer.email,
    subject:'Order Confirmed #'+order.orderId+' - Yaanai Kavalam',
    html:'<h2>Thank you '+order.customer.name+'!</h2><p>Your order <b>#'+order.orderId+'</b> is confirmed.</p><p>Total: Rs.'+order.pricing.total+'</p><p>We will deliver within 5 business days.</p>'
  });
}

async function sendStatusUpdateEmail(order) {
  await transporter.sendMail({ from:'"Yaanai Kavalam" <'+process.env.GMAIL_USER+'>', to:order.customer.email,
    subject:'Order #'+order.orderId+' is now '+order.status.toUpperCase(),
    html:'<h2>Order Update</h2><p>Your order #'+order.orderId+' status: <b>'+order.status+'</b></p>'
  });
}

async function sendBackupConfirmationEmail(count, url) {
  await transporter.sendMail({ from:'"Yaanai Kavalam System" <'+process.env.GMAIL_USER+'>', to:process.env.ADMIN_EMAIL,
    subject:'Weekly Backup Complete - '+count+' orders',
    html:'<p>'+count+' orders exported. <a href="'+url+'">View Sheet</a></p>'
  });
}

async function safeEmail(fn, type, orderId) {
  try { await fn(); } catch(err) { await ErrorLog.create({type:'email',message:err.message,orderId}).catch(()=>{}); }
}

module.exports = { sendAdminOrderEmail, sendCustomerConfirmationEmail, sendStatusUpdateEmail, sendBackupConfirmationEmail, safeEmail };
`);

write('backend/services/smsService.js', `const axios = require('axios');
const NodeCache = require('node-cache');
const Settings = require('../models/Settings');
const ErrorLog = require('../models/ErrorLog');
const phoneCache = new NodeCache({ stdTTL: 60 });

async function getAdminPhone() {
  const cached = phoneCache.get('adminPhone');
  if (cached) return cached;
  const phone = await Settings.get('adminPhone', process.env.ADMIN_PHONE);
  phoneCache.set('adminPhone', phone);
  return phone;
}

function invalidatePhoneCache() { phoneCache.del('adminPhone'); }

async function sendOrderSMS(order) {
  const phone = await getAdminPhone();
  const mobile = phone.replace('+','').replace(/\\s/g,'');
  await axios.post('https://api.msg91.com/api/v5/flow/', {
    flow_id: process.env.MSG91_TEMPLATE_ID, sender: process.env.MSG91_SENDER_ID,
    mobiles: mobile, orderId: order.orderId, customerName: order.customer.name,
    amount: String(order.pricing.total), city: order.address.city
  }, { headers:{ authkey: process.env.MSG91_AUTH_KEY, 'Content-Type':'application/json' }, timeout:5000 });
}

async function sendOrderWhatsApp(order) {
  const phone = await getAdminPhone();
  const mobile = phone.replace('+','').replace(/\\s/g,'');
  const msg = 'New Order #'+order.orderId+' | '+order.customer.name+' | Rs.'+order.pricing.total+' | '+order.address.city;
  await axios.post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
    integrated_number: process.env.MSG91_WHATSAPP_NUMBER, content_type:'template',
    payload:{ to:mobile, type:'template', template:{ name:'new_order_alert', language:{code:'en'} } }
  }, { headers:{ authkey: process.env.MSG91_AUTH_KEY, 'Content-Type':'application/json' }, timeout:5000 });
}

function fireOrderAlerts(order) {
  setImmediate(async () => {
    await sendOrderSMS(order).catch(async err => { await ErrorLog.create({type:'sms',message:err.message,orderId:order.orderId}).catch(()=>{}); });
    await sendOrderWhatsApp(order).catch(async err => { await ErrorLog.create({type:'whatsapp',message:err.message,orderId:order.orderId}).catch(()=>{}); });
  });
}

module.exports = { sendOrderSMS, sendOrderWhatsApp, fireOrderAlerts, invalidatePhoneCache, getAdminPhone };
`);

write('backend/services/sheetsService.js', `const { google } = require('googleapis');
const path = require('path');
const Order = require('../models/Order');
const ErrorLog = require('../models/ErrorLog');
const { sendBackupConfirmationEmail } = require('./emailService');

const HEADERS = ['Order ID','Date','Customer Name','Phone','Email','Address','City','State','Pincode','Country','Products','Qty','Total','Payment','Pay Status','Order Status','Delivery Date'];

async function exportToSheets(fromDate=null) {
  try {
    const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname,'../config/google-service-account.json'), scopes:['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version:'v4', auth });
    const start = fromDate || new Date(Date.now() - 7*24*60*60*1000);
    const orders = await Order.find({ createdAt:{ $gte:start } }).lean();

    const check = await sheets.spreadsheets.values.get({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:'Orders!A1:Q1' });
    if (!check.data.values?.length) {
      await sheets.spreadsheets.values.update({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:'Orders!A1', valueInputOption:'RAW', requestBody:{ values:[HEADERS] } });
    }

    const rows = [['=== Week of '+new Date().toLocaleDateString('en-IN')+' ===','','','','','','','','','','','','','','','','']];
    orders.forEach(o => rows.push([o.orderId, new Date(o.createdAt).toLocaleDateString('en-IN'), o.customer.name, o.customer.phone, o.customer.email, o.address.line1, o.address.city, o.address.state, o.address.pincode, o.address.country, o.items.map(i=>i.name).join(', '), o.items.map(i=>i.quantity).join(', '), o.pricing.total, o.payment.method, o.payment.status, o.status, o.expectedDelivery ? new Date(o.expectedDelivery).toLocaleDateString('en-IN') : 'TBD']));

    await sheets.spreadsheets.values.append({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:'Orders!A1', valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{ values:rows } });

    const url = 'https://docs.google.com/spreadsheets/d/'+process.env.GOOGLE_SHEET_ID;
    await sendBackupConfirmationEmail(orders.length, url).catch(()=>{});
    return { count:orders.length, sheetUrl:url };
  } catch(err) {
    await ErrorLog.create({type:'sheets',message:err.message}).catch(()=>{});
    throw err;
  }
}

module.exports = { exportToSheets };
`);

write('backend/services/cronJobs.js', `const cron = require('node-cron');
const { exportToSheets } = require('./sheetsService');
cron.schedule('59 23 * * 0', async () => {
  console.log('Running weekly backup...');
  try { const r = await exportToSheets(); console.log('Backup done:', r.count, 'orders'); }
  catch(err) { console.error('Backup failed:', err.message); }
}, { timezone: 'Asia/Kolkata' });
console.log('Cron jobs started');
`);

// Routes
write('backend/routes/auth.js', `const express = require('express');
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
`);

write('backend/routes/products.js', `const express = require('express');
const NodeCache = require('node-cache');
const Product = require('../models/Product');
const router = express.Router();
const cache = new NodeCache({ stdTTL: 300 });

router.get('/', async (req,res) => {
  try {
    const cached = cache.get('products');
    if (cached) return res.json({success:true, products:cached});
    const products = await Product.find({isActive:true}).select('-reviews');
    cache.set('products', products);
    res.json({success:true, products});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.get('/:id', async (req,res) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.user','name avatar');
    if (!product) return res.status(404).json({success:false,message:'Product not found'});
    res.json({success:true, product});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

module.exports = router;
module.exports.clearCache = () => cache.flushAll();
`);

write('backend/routes/orders.js', `const express = require('express');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { sendAdminOrderEmail, sendCustomerConfirmationEmail, safeEmail } = require('../services/emailService');
const { fireOrderAlerts } = require('../services/smsService');
const router = express.Router();

router.post('/', async (req,res) => {
  try {
    const order = await Order.create(req.body);
    order.expectedDelivery = new Date(Date.now() + 5*24*60*60*1000);
    await order.save();

    // Send all notifications in background - never block customer response
    setImmediate(async () => {
      await safeEmail(() => sendAdminOrderEmail(order), 'admin', order.orderId);
      await safeEmail(() => sendCustomerConfirmationEmail(order), 'customer', order.orderId);
      fireOrderAlerts(order);
    });

    res.json({success:true, orderId:order.orderId, message:'Order placed successfully'});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.get('/track/:orderId', async (req,res) => {
  try {
    const order = await Order.findOne({ $or:[{orderId:req.params.orderId},{'customer.phone':req.params.orderId}] });
    if (!order) return res.status(404).json({success:false,message:'Order not found'});
    res.json({success:true, order:{orderId:order.orderId,status:order.status,statusHistory:order.statusHistory,expectedDelivery:order.expectedDelivery,items:order.items,pricing:order.pricing}});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.get('/my-orders', auth, async (req,res) => {
  try {
    const orders = await Order.find({'customer.userId':req.user._id}).sort({createdAt:-1});
    res.json({success:true, orders});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

module.exports = router;
`);

write('backend/routes/payments.js', `const express = require('express');
const Razorpay = require('razorpay');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

const razorpay = new Razorpay({ key_id:process.env.RAZORPAY_KEY_ID, key_secret:process.env.RAZORPAY_KEY_SECRET });

router.post('/razorpay/create-order', async (req,res) => {
  try {
    const { amount } = req.body;
    const order = await razorpay.orders.create({ amount:amount*100, currency:'INR', receipt:'receipt_'+Date.now() });
    res.json({success:true, order});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.post('/stripe/create-intent', async (req,res) => {
  try {
    const { amount, currency='usd' } = req.body;
    const intent = await stripe.paymentIntents.create({ amount:amount*100, currency });
    res.json({success:true, clientSecret:intent.client_secret});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

module.exports = router;
`);

write('backend/routes/admin.js', `const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const ErrorLog = require('../models/ErrorLog');
const { exportToSheets } = require('../services/sheetsService');
const { invalidatePhoneCache } = require('../services/smsService');
const { clearCache } = require('./products');
const ExcelJS = require('exceljs');
const router = express.Router();

router.use(auth, adminOnly);

// Get all orders
router.get('/orders', async (req,res) => {
  try {
    const { status, page=1, limit=20 } = req.query;
    const filter = status && status !== 'all' ? {status} : {};
    const orders = await Order.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(Number(limit));
    const total = await Order.countDocuments(filter);
    res.json({success:true, orders, total, pages:Math.ceil(total/limit)});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

// Update order status
router.put('/orders/:id/status', async (req,res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id,
      { status, $push:{statusHistory:{status,timestamp:new Date()}} }, {new:true});
    res.json({success:true, order});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

// Update admin phone
router.put('/settings/phone', async (req,res) => {
  try {
    const { phone } = req.body;
    await Settings.set('adminPhone', phone);
    invalidatePhoneCache();
    res.json({success:true, message:'Phone updated to '+phone});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

// Export to Google Sheets
router.post('/export-sheets', async (req,res) => {
  try {
    const result = await exportToSheets();
    res.json({success:true, ...result});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

// Export to Excel
router.get('/export-excel', async (req,res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) { filter.createdAt = {}; if(from) filter.createdAt.$gte=new Date(from); if(to) filter.createdAt.$lte=new Date(to); }
    const orders = await Order.find(filter).sort({createdAt:-1});
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Orders');
    ws.columns = [{header:'Order ID',key:'orderId',width:20},{header:'Date',key:'date',width:15},{header:'Customer',key:'customer',width:20},{header:'Phone',key:'phone',width:15},{header:'Email',key:'email',width:25},{header:'City',key:'city',width:15},{header:'State',key:'state',width:15},{header:'Country',key:'country',width:15},{header:'Products',key:'products',width:30},{header:'Total',key:'total',width:12},{header:'Payment',key:'payment',width:12},{header:'Status',key:'status',width:15}];
    ws.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1B4332'} };
    ws.getRow(1).font = { color:{argb:'FFC9A84C'}, bold:true };
    orders.forEach(o => ws.addRow({ orderId:o.orderId, date:new Date(o.createdAt).toLocaleDateString('en-IN'), customer:o.customer.name, phone:o.customer.phone, email:o.customer.email, city:o.address.city, state:o.address.state, country:o.address.country, products:o.items.map(i=>i.name+'x'+i.quantity).join(', '), total:o.pricing.total, payment:o.payment.method, status:o.status }));
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=Yaanai-Kavalam-Orders.xlsx');
    await wb.xlsx.write(res); res.end();
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

// Product CRUD
router.get('/products', async (req,res) => { const p = await Product.find(); res.json({success:true,products:p}); });
router.post('/products', async (req,res) => { try { const p = await Product.create(req.body); clearCache(); res.json({success:true,product:p}); } catch(err){res.status(500).json({success:false,message:err.message});} });
router.put('/products/:id', async (req,res) => { try { const p = await Product.findByIdAndUpdate(req.params.id,req.body,{new:true}); clearCache(); res.json({success:true,product:p}); } catch(err){res.status(500).json({success:false,message:err.message});} });
router.delete('/products/:id', async (req,res) => { try { await Product.findByIdAndDelete(req.params.id); clearCache(); res.json({success:true}); } catch(err){res.status(500).json({success:false,message:err.message});} });

// Error logs
router.get('/errors', async (req,res) => { const e = await ErrorLog.find().sort({createdAt:-1}).limit(50); res.json({success:true,errors:e}); });

// Dashboard stats
router.get('/stats', async (req,res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalOrders,todayOrders,totalRevenue] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({createdAt:{$gte:today}}),
      Order.aggregate([{$match:{status:{$ne:'cancelled'}}},{$group:{_id:null,total:{$sum:'$pricing.total'}}}])
    ]);
    res.json({success:true,stats:{totalOrders,todayOrders,totalRevenue:totalRevenue[0]?.total||0}});
  } catch(err){res.status(500).json({success:false,message:err.message});}
});

module.exports = router;
`);

// Google service account placeholder
write('backend/config/google-service-account.json', JSON.stringify({
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "REPLACE_WITH_YOUR_KEY_ID",
  "private_key": "REPLACE_WITH_YOUR_PRIVATE_KEY",
  "client_email": "REPLACE_WITH_YOUR_SERVICE_ACCOUNT_EMAIL",
  "client_id": "REPLACE_WITH_YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "_README": "Download this file from Google Cloud Console > Service Accounts > Keys > Add Key > JSON"
}, null, 2));

console.log('\n✅ ALL BACKEND FILES CREATED SUCCESSFULLY!');
console.log('Next step: run  node backend/server.js');