const express = require('express');
const cors    = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db');
const app  = express();
const path = require('path');
const PORT = process.env.PORT || 5000;

// ── Core middleware ──
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── User log middleware ──
const { userLogMiddleware, ensureUserLogsTable } = require('./middlewares/userLogMiddleware');
app.use(userLogMiddleware);

// ── Routes ──
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/assets',          require('./routes/assets'));
app.use('/api/users',           require('./routes/userRoutes'));
app.use('/api/print',           require('./routes/print'));
app.use('/api/locations',       require('./routes/locations'));
app.use('/api/inventory',       require('./routes/inventory'));
app.use('/api/import',          require('./routes/import'));
app.use('/api/superadmin',      require('./routes/superadmin'));
app.use('/api/photos',          require('./routes/photos'));
app.use('/api/repair-requests', require('./routes/repair'));
app.use('/api/borrow-requests', require('./routes/borrow'));

app.get('/', (req, res) => res.send('Asset Management API is running...'));

const { sql } = require('./config/db');

const ensureAssetRfidColumns = async () => {
    try {
        await sql.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Assets') AND name = 'RfidTag')
                ALTER TABLE Assets ADD RfidTag NVARCHAR(100) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Assets') AND name = 'HasRfid')
                ALTER TABLE Assets ADD HasRfid BIT NOT NULL DEFAULT 0;
        `);
        console.log('✅ Assets.RfidTag / HasRfid columns ready');
    } catch (err) {
        console.error('ensureAssetRfidColumns error:', err.message);
    }
};

const startServer = async () => {
    await connectDB();
    await ensureUserLogsTable();
    await ensureAssetRfidColumns();
    app.listen(PORT, () => console.log('🚀 Server is running on port ' + PORT));
};

startServer().catch(err => {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1);
});