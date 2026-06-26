const express = require('express');
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
