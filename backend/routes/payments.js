const express = require('express');
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
