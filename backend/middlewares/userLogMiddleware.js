const { sql } = require('../config/db');

// ── สร้างตาราง UserLogs ถ้ายังไม่มี ────────────────────────────────────────
const ensureUserLogsTable = async () => {
    try {
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserLogs' AND xtype='U')
            CREATE TABLE UserLogs (
                Id            INT IDENTITY(1,1) PRIMARY KEY,
                UserId        INT,
                Username      NVARCHAR(100),
                FullName      NVARCHAR(200),
                Action        NVARCHAR(50)  NOT NULL,
                TargetUserId  INT           NULL,
                TargetUsername NVARCHAR(100) NULL,
                Detail        NVARCHAR(500) NULL,
                IpAddress     NVARCHAR(50)  NULL,
                CreatedAt     DATETIME      DEFAULT GETDATE()
            )
        `);
    } catch (err) {
        console.error('ensureUserLogsTable error:', err.message);
    }
};

// หมายเหตุ: เรียก ensureUserLogsTable() ใน server.js หลัง connectDB() แทน

// ── Helper: บันทึก log ────────────────────────────────────────────────────────
const writeUserLog = async ({ userId, username, fullName, action, targetUserId, targetUsername, detail, ip }) => {
    try {
        const req = new sql.Request();
        req.input('UserId',         sql.Int,        userId        || null);
        req.input('Username',       sql.NVarChar,   username      || null);
        req.input('FullName',       sql.NVarChar,   fullName      || null);
        req.input('Action',         sql.NVarChar,   action);
        req.input('TargetUserId',   sql.Int,        targetUserId  || null);
        req.input('TargetUsername', sql.NVarChar,   targetUsername|| null);
        req.input('Detail',         sql.NVarChar,   detail        || null);
        req.input('IpAddress',      sql.NVarChar,   ip            || null);
        await req.query(`
            INSERT INTO UserLogs (UserId, Username, FullName, Action, TargetUserId, TargetUsername, Detail, IpAddress)
            VALUES (@UserId, @Username, @FullName, @Action, @TargetUserId, @TargetUsername, @Detail, @IpAddress)
        `);
    } catch (err) {
        console.error('writeUserLog error:', err.message);
    }
};

// ── Action map: route → action label ─────────────────────────────────────────
const ROUTE_ACTION_MAP = [
    // Auth
    { method: 'POST', path: /^\/api\/auth\/login$/,    action: 'LOGIN'       },
    { method: 'POST', path: /^\/api\/auth\/register$/, action: 'REGISTER'    },
    // User CRUD
    { method: 'PUT',    path: /^\/api\/users\/\d+$/,          action: 'UPDATE_USER'  },
    { method: 'DELETE', path: /^\/api\/users\/\d+$/,          action: 'DELETE_USER'  },
    { method: 'PUT',    path: /^\/api\/superadmin\/users\/\d+\/role$/, action: 'CHANGE_ROLE' },
    { method: 'DELETE', path: /^\/api\/superadmin\/users\/\d+$/, action: 'DELETE_USER' },
    // Asset transactions (ยืม/คืน/ซ่อม) — log แยกตาม user ด้วย
    { method: 'POST', path: /^\/api\/borrow/,   action: 'BORROW'    },
    { method: 'POST', path: /^\/api\/repair/,   action: 'REPAIR'    },
    { method: 'POST', path: /^\/api\/inventory/,action: 'INVENTORY' },
];

// ── Middleware หลัก ───────────────────────────────────────────────────────────
const userLogMiddleware = (req, res, next) => {
    const matched = ROUTE_ACTION_MAP.find(
        r => r.method === req.method && r.path.test(req.path)
    );
    if (!matched) return next();

    // intercept res.json เพื่อ log หลัง response สำเร็จ
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        originalJson(body);

        // log เฉพาะ success (2xx)
        if (res.statusCode < 200 || res.statusCode >= 300) return;

        const user = req.user || {};
        const ip   = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;

        // ดึง target user จาก params
        const targetId = req.params?.id ? parseInt(req.params.id) : null;

        // สร้าง detail message
        let detail = null;
        if (matched.action === 'LOGIN')       detail = `เข้าสู่ระบบ`;
        else if (matched.action === 'REGISTER')    detail = `สมัครสมาชิก username: ${req.body?.username}`;
        else if (matched.action === 'UPDATE_USER') detail = `แก้ไขข้อมูล user id: ${targetId}`;
        else if (matched.action === 'DELETE_USER') detail = `ลบ user id: ${targetId}`;
        else if (matched.action === 'CHANGE_ROLE') detail = `เปลี่ยน role ของ user id: ${targetId} เป็น roleId: ${req.body?.roleId}`;
        else if (matched.action === 'BORROW')      detail = `ยืมทรัพย์สิน`;
        else if (matched.action === 'REPAIR')      detail = `ส่งซ่อมทรัพย์สิน`;
        else if (matched.action === 'INVENTORY')   detail = `ตรวจนับทรัพย์สิน`;

        // LOGIN ใช้ข้อมูลจาก response body แทน (ยังไม่มี token)
        let logUserId   = user.id       || null;
        let logUsername = user.username || null;
        let logFullName = user.fullName || null;

        if (matched.action === 'LOGIN' && body?.user) {
            logUserId   = body.user.id;
            logUsername = body.user.username;
            logFullName = body.user.fullName;
        }

        writeUserLog({
            userId:   logUserId,
            username: logUsername,
            fullName: logFullName,
            action:   matched.action,
            targetUserId: targetId,
            detail,
            ip,
        });
    };

    next();
};

module.exports = { userLogMiddleware, writeUserLog, ensureUserLogsTable };