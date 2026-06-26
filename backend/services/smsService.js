const axios = require('axios');
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
  const mobile = phone.replace('+','').replace(/\s/g,'');
  await axios.post('https://api.msg91.com/api/v5/flow/', {
    flow_id: process.env.MSG91_TEMPLATE_ID, sender: process.env.MSG91_SENDER_ID,
    mobiles: mobile, orderId: order.orderId, customerName: order.customer.name,
    amount: String(order.pricing.total), city: order.address.city
  }, { headers:{ authkey: process.env.MSG91_AUTH_KEY, 'Content-Type':'application/json' }, timeout:5000 });
}

async function sendOrderWhatsApp(order) {
  const phone = await getAdminPhone();
  const mobile = phone.replace('+','').replace(/\s/g,'');
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
