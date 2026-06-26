const express = require('express');
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
