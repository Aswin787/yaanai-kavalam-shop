const mongoose = require('mongoose');
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
