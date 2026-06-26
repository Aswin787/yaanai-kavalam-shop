const { google } = require('googleapis');
const path = require('path');
const Order = require('../models/Order');
const ErrorLog = require('../models/ErrorLog');
const { sendBackupConfirmationEmail } = require('./emailService');

const HEADERS = ['Order ID','Date','Customer Name','Phone','Email','Address','City','State','Pincode','Country','Products','Qty','Total','Payment','Pay Status','Order Status','Delivery Date'];

async function exportToSheets(fromDate=null) {
  try {
    const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname,'../config/google-service-account.json'), scopes:['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version:'v4', auth });
    const start = fromDate || new Date(Date.now() - 7*24*60*60*1000);
    const orders = await Order.find({ createdAt:{ $gte:start } }).lean();

    const check = await sheets.spreadsheets.values.get({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:'Orders!A1:Q1' });
    if (!check.data.values?.length) {
      await sheets.spreadsheets.values.update({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:'Orders!A1', valueInputOption:'RAW', requestBody:{ values:[HEADERS] } });
    }

    const rows = [['=== Week of '+new Date().toLocaleDateString('en-IN')+' ===','','','','','','','','','','','','','','','','']];
    orders.forEach(o => rows.push([o.orderId, new Date(o.createdAt).toLocaleDateString('en-IN'), o.customer.name, o.customer.phone, o.customer.email, o.address.line1, o.address.city, o.address.state, o.address.pincode, o.address.country, o.items.map(i=>i.name).join(', '), o.items.map(i=>i.quantity).join(', '), o.pricing.total, o.payment.method, o.payment.status, o.status, o.expectedDelivery ? new Date(o.expectedDelivery).toLocaleDateString('en-IN') : 'TBD']));

    await sheets.spreadsheets.values.append({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:'Orders!A1', valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{ values:rows } });

    const url = 'https://docs.google.com/spreadsheets/d/'+process.env.GOOGLE_SHEET_ID;
    await sendBackupConfirmationEmail(orders.length, url).catch(()=>{});
    return { count:orders.length, sheetUrl:url };
  } catch(err) {
    await ErrorLog.create({type:'sheets',message:err.message}).catch(()=>{});
    throw err;
  }
}

module.exports = { exportToSheets };
