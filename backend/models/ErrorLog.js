const mongoose = require('mongoose');
const s = new mongoose.Schema({ type:{type:String,enum:['sms','email','whatsapp','sheets','payment','general']}, message:String, details:mongoose.Schema.Types.Mixed, orderId:String, resolved:{type:Boolean,default:false} },{timestamps:true});
module.exports = mongoose.model('ErrorLog', s);
