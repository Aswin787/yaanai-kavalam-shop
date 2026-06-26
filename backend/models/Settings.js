const mongoose = require('mongoose');
const settingsSchema = new mongoose.Schema({ key:{ type:String, required:true, unique:true }, value:{ type:mongoose.Schema.Types.Mixed, required:true }, updatedAt:{ type:Date, default:Date.now } });
settingsSchema.statics.get = async function(key, def=null) { const s = await this.findOne({key}); return s ? s.value : def; };
settingsSchema.statics.set = async function(key, value) { return this.findOneAndUpdate({key},{key,value,updatedAt:new Date()},{upsert:true,new:true}); };
module.exports = mongoose.model('Settings', settingsSchema);
