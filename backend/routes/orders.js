const express = require('express');
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
