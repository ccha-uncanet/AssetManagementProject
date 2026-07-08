const { sql } = require('../config/db');

const getSystemStats = async (req, res) => {
    try {
        const users        = await sql.query('SELECT COUNT(Id) AS Total FROM Users');
        const assets       = await sql.query('SELECT COUNT(Id) AS Total FROM Assets');
        const roles        = await sql.query('SELECT COUNT(Id) AS Total FROM Roles');
        const transactions = await sql.query('SELECT COUNT(Id) AS Total FROM AssetTransactions');
        const borrowed     = await sql.query('SELECT COUNT(Id) AS Total FROM Assets WHERE Status = 2');
        const repairing    = await sql.query('SELECT COUNT(Id) AS Total FROM Assets WHERE Status = 3');

        res.json({
            totalUsers:        users.recordset[0].Total,
            totalAssets:       assets.recordset[0].Total,
            totalRoles:        roles.recordset[0].Total,
            totalTransactions: transactions.recordset[0].Total,
            totalBorrowed:     borrowed.recordset[0].Total,
            totalRepairing:    repairing.recordset[0].Total,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT u.Id, u.Username, u.FullName, u.Email, u.CreatedAt,
                r.Id AS RoleId, r.Name AS RoleName, r.DisplayName AS RoleDisplayName
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId_New = r.Id
            ORDER BY u.CreatedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const changeUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleId } = req.body;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'ไม่สามารถเปลี่ยน Role ของตัวเองได้' });
        }
        const request = new sql.Request();
        request.input('Id',     sql.Int, id);
        request.input('RoleId', sql.Int, roleId);
        await request.query('UPDATE Users SET RoleId_New = @RoleId, RoleId = @RoleId WHERE Id = @Id');
        res.json({ message: 'เปลี่ยน Role สำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' });
        }
        const request = new sql.Request();
        request.input('Id', sql.Int, id);
        await request.query('DELETE FROM Users WHERE Id = @Id');
        res.json({ message: 'ลบ User สำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getRoles = async (req, res) => {
    try {
        const roles       = await sql.query('SELECT * FROM Roles ORDER BY Id');
        const permissions = await sql.query('SELECT * FROM Permissions ORDER BY Module, Name');
        const rolePerms   = await sql.query('SELECT * FROM RolePermissions');
        res.json({
            roles:           roles.recordset,
            permissions:     permissions.recordset,
            rolePermissions: rolePerms.recordset,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissionIds } = req.body;

        const delReq = new sql.Request();
        delReq.input('RoleId', sql.Int, roleId);
        await delReq.query('DELETE FROM RolePermissions WHERE RoleId = @RoleId');

        for (const permId of permissionIds) {
            const insReq = new sql.Request();
            insReq.input('RoleId',       sql.Int, roleId);
            insReq.input('PermissionId', sql.Int, permId);
            await insReq.query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@RoleId, @PermissionId)');
        }
        res.json({ message: 'อัปเดต Permission สำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── getLogs (ประวัติทรัพย์สิน) ────────────────────────────────────────────────
const getLogs = async (req, res) => {
    try {
        const { limit = 200, action, dateFrom, dateTo } = req.query;

        let where = 'WHERE 1=1';
        const request = new sql.Request();

        if (action) {
            where += ' AND t.Action = @Action';
            request.input('Action', sql.Int, parseInt(action));
        }
        if (dateFrom) {
            where += ' AND t.TransactionDate >= @DateFrom';
            request.input('DateFrom', sql.DateTime, new Date(dateFrom));
        }
        if (dateTo) {
            where += ' AND t.TransactionDate <= @DateTo';
            request.input('DateTo', sql.DateTime, new Date(dateTo + 'T23:59:59'));
        }

        request.input('Limit', sql.Int, Math.min(parseInt(limit) || 200, 1000));

        const result = await request.query(`
            SELECT TOP (@Limit)
                t.Id,
                t.Action,
                t.TransactionDate,
                t.Notes,
                t.UserId,
                a.Name  AS AssetName,
                a.InvNo AS InvNo,
                ISNULL(u.FullName, '') AS UserName,
                ISNULL(u.Username, CAST(t.UserId AS NVARCHAR)) AS Username
            FROM AssetTransactions t
            LEFT JOIN Assets a ON t.AssetId = a.Id
            LEFT JOIN Users u ON u.Id = CASE
                WHEN ISNUMERIC(t.UserId) = 1 THEN CAST(t.UserId AS INT)
                ELSE NULL
            END
            ${where}
            ORDER BY t.TransactionDate DESC
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error('getLogs error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── getUserLogs (ประวัติผู้ใช้) ────────────────────────────────────────────────
const getUserLogs = async (req, res) => {
    try {
        // ตรวจสอบว่าตาราง UserLogs มีหรือยัง
        const tableCheck = await sql.query(`
            SELECT COUNT(*) AS cnt FROM sysobjects WHERE name='UserLogs' AND xtype='U'
        `);
        if (tableCheck.recordset[0].cnt === 0) {
            // ยังไม่มีตาราง — คืน array ว่าง พร้อม flag
            return res.json({ logs: [], tableExists: false });
        }

        const { limit = 200, action, userId, dateFrom, dateTo } = req.query;

        let where = 'WHERE 1=1';
        const request = new sql.Request();

        if (action) {
            where += ' AND l.Action = @Action';
            request.input('Action', sql.NVarChar, action);
        }
        if (userId) {
            where += ' AND l.UserId = @UserId';
            request.input('UserId', sql.Int, parseInt(userId));
        }
        if (dateFrom) {
            where += ' AND l.CreatedAt >= @DateFrom';
            request.input('DateFrom', sql.DateTime, new Date(dateFrom));
        }
        if (dateTo) {
            where += ' AND l.CreatedAt <= @DateTo';
            request.input('DateTo', sql.DateTime, new Date(dateTo + 'T23:59:59'));
        }

        request.input('Limit', sql.Int, Math.min(parseInt(limit) || 200, 1000));

        const result = await request.query(`
            SELECT TOP (@Limit)
                l.Id,
                l.UserId,
                l.Username,
                l.FullName,
                l.Action,
                l.TargetUserId,
                l.TargetUsername,
                l.Detail,
                l.IpAddress,
                l.CreatedAt
            FROM UserLogs l
            ${where}
            ORDER BY l.CreatedAt DESC
        `);

        res.json({ logs: result.recordset, tableExists: true });
    } catch (err) {
        console.error('getUserLogs error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── DB Settings ───────────────────────────────────────────────────────────────
const fs      = require('fs');
const path    = require('path');
const dotenv  = require('dotenv');
const mssql   = require('mssql');
const { connectDB } = require('../config/db');

const ENV_PATH = path.resolve(__dirname, '../.env');

function readEnv() {
    return dotenv.parse(fs.readFileSync(ENV_PATH, 'utf8'));
}

function writeEnv(updates) {
    const merged  = { ...readEnv(), ...updates };
    const content = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(ENV_PATH, content + '\n', 'utf8');
    Object.entries(updates).forEach(([k, v]) => { process.env[k] = v; });
}

const getDbSettings = (req, res) => {
    try {
        const env = readEnv();
        res.json({
            server:   env.DB_SERVER   || '',
            port:     env.DB_PORT     || '1433',
            instance: env.DB_INSTANCE || '',
            database: env.DB_NAME     || '',
            user:     env.DB_USER     || '',
            password: env.DB_PASSWORD ? '••••••' : '',
            hasPassword: !!env.DB_PASSWORD,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const testDbConnection = async (req, res) => {
    let { server, port, instance, database, user, password } = req.body;
    if (!password || password === '__KEEP__') {
        password = readEnv().DB_PASSWORD || '';
    }
    let testPool;
    try {
        testPool = new mssql.ConnectionPool({
            user, password, server, database,
            port: parseInt(port) || 1433,
            connectionTimeout: 8000,
            options: { encrypt: false, trustServerCertificate: true, instanceName: instance || '' },
        });
        await testPool.connect();
        await testPool.close();
        res.json({ ok: true, message: 'เชื่อมต่อสำเร็จ' });
    } catch (err) {
        if (testPool) testPool.close().catch(() => {});
        res.json({ ok: false, message: err.message });
    }
};

const updateDbSettings = async (req, res) => {
    const { server, port, instance, database, user, password, keepPassword } = req.body;
    try {
        const updates = {
            DB_SERVER:   server,
            DB_PORT:     port || '1433',
            DB_INSTANCE: instance || '',
            DB_NAME:     database,
            DB_USER:     user,
        };
        // Only overwrite password if a new one was provided
        if (!keepPassword && password && !password.startsWith('••')) {
            updates.DB_PASSWORD = password;
        }
        writeEnv(updates);
        await connectDB();
        res.json({ ok: true, message: 'บันทึกและเชื่อมต่อใหม่สำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getSystemStats, getAllUsers, changeUserRole,
    deleteUser, getRoles, updateRolePermissions,
    getLogs, getUserLogs,
    getDbSettings, testDbConnection, updateDbSettings,
};