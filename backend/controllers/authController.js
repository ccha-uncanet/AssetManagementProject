const { sql } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// กำหนด redirect path ตาม role
const ROLE_REDIRECT = {
    'superadmin': '/superadmin/dashboard',
    'admin': '/admin/dashboard',
    'staff': '/staff/dashboard',
    'auditor': '/auditor/dashboard',
};

// API: สมัครสมาชิก (Register)
const register = async (req, res) => {
    try {
        const { username, password, email, fullName, roleId } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
        }

        const checkUser = new sql.Request();
        checkUser.input('Username', sql.NVarChar, username);
        const userExists = await checkUser.query('SELECT Username FROM Users WHERE Username = @Username');

        if (userExists.recordset.length > 0) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้งานนี้มีผู้อื่นใช้แล้ว' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const request = new sql.Request();
        request.input('Username', sql.NVarChar, username);
        request.input('PasswordHash', sql.NVarChar, hashedPassword);
        request.input('Email', sql.NVarChar, email || null);
        request.input('FullName', sql.NVarChar, fullName || null);
        request.input('RoleId_New', sql.Int, roleId || 3); // default = staff

        await request.query(`
            INSERT INTO Users (Username, PasswordHash, Email, FullName, RoleId, RoleId_New)
            VALUES (@Username, @PasswordHash, @Email, @FullName, @RoleId_New, @RoleId_New)
        `);

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (err) {
        console.error('Register Error:', err.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก: ' + err.message });
    }
};

// API: เข้าสู่ระบบ (Login)
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. ดึงข้อมูล User พร้อม Role name
        const request = new sql.Request();
        request.input('Username', sql.NVarChar, username);
        const result = await request.query(`
            SELECT u.*, r.Name AS RoleName, r.DisplayName AS RoleDisplayName
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId_New = r.Id
            WHERE u.Username = @Username
        `);

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
        }

        const user = result.recordset[0];
        const isMatch = await bcrypt.compare(password, user.PasswordHash);

        if (!isMatch) {
            return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // 2. ดึง Permissions ของ Role นี้
        const permRequest = new sql.Request();
        permRequest.input('RoleId', sql.Int, user.RoleId_New);
        const permResult = await permRequest.query(`
            SELECT p.Name
            FROM RolePermissions rp
            JOIN Permissions p ON rp.PermissionId = p.Id
            WHERE rp.RoleId = @RoleId
        `);
        const permissions = permResult.recordset.map(p => p.Name);

        // 3. สร้าง Token พร้อม role และ permissions
        const payload = {
            user: {
                id: user.Id,
                roleId: user.RoleId_New,
                roleName: user.RoleName,
                permissions,
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        // 4. กำหนด redirect path ตาม role
        const redirectTo = ROLE_REDIRECT[user.RoleName] || '/admin/dashboard';

        res.json({
            token,
            redirectTo,
            user: {
                id: user.Id,
                username: user.Username,
                fullName: user.FullName,
                roleId: user.RoleId_New,
                roleName: user.RoleName,
                roleDisplayName: user.RoleDisplayName,
                permissions,
            }
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ Server' });
    }
};

module.exports = { register, login };