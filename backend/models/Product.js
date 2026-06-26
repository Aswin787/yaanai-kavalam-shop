const mongoose = require('mongoose');
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
