const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,              // false สำหรับ local SQL Server
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: process.env.DB_INSTANCE || '', // สำหรับ SQL Express เช่น 'SQLEXPRESS'
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
};

const connectDB = async () => {
    try {
        await sql.close();
        const pool = await sql.connect(config);
        console.log('✅ SQL Server Connected Successfully!');
        return pool;
    } catch (err) {
        console.error('❌ SQL Server Connection Failed:', err.message);

        // แสดงสาเหตุที่เป็นไปได้
        if (err.message.includes('Login failed')) {
            console.log('🔑 สาเหตุ: รหัสผ่านผิด หรือ sa ถูก disable หรือ Mixed Mode ยังไม่เปิด');
            console.log('   → SSMS: Server Properties → Security → SQL Server and Windows Authentication mode');
            console.log('   → SSMS: รันคำสั่ง ALTER LOGIN sa ENABLE;');
        } else if (err.message.includes('connect ECONNREFUSED') || err.message.includes('Failed to connect')) {
            console.log('🔌 สาเหตุ: SQL Server ไม่ได้รัน หรือ TCP/IP ยังไม่เปิด หรือ Port ผิด');
            console.log('   → เปิด SQL Server Configuration Manager → Enable TCP/IP → Port 1433');
        } else if (err.message.includes('TLS') || err.message.includes('SSL')) {
            console.log('🔒 สาเหตุ: TLS/SSL ขัดแย้ง → ตั้ง encrypt: false ใน config');
        }

        process.exit(1); // หยุด server ถ้า DB ต่อไม่ได้
    }
};

module.exports = { sql, connectDB };