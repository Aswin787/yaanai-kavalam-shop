const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const responseTime = require('response-time');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
require('./services/cronJobs');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(responseTime());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend'), { maxAge: '7d' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 5000, () => console.log('Server running on port ' + (process.env.PORT || 5000)));
  })
  .catch(err => { console.error('MongoDB error:', err.message); process.exit(1); });
