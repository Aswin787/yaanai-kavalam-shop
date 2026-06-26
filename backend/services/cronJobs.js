const cron = require('node-cron');
const { exportToSheets } = require('./sheetsService');
cron.schedule('59 23 * * 0', async () => {
  console.log('Running weekly backup...');
  try { const r = await exportToSheets(); console.log('Backup done:', r.count, 'orders'); }
  catch(err) { console.error('Backup failed:', err.message); }
}, { timezone: 'Asia/Kolkata' });
console.log('Cron jobs started');
