const nodemailer = require('nodemailer');
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
