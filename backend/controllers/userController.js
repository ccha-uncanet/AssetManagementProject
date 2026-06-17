const { sql } = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/users - ดึงรายชื่อ User ทั้งหมด (เฉพาะ Admin)
const getAllUsers = async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
    SELECT 
        u.Id, u.Username, u.FullName, u.Email,
        u.RoleId, u.RoleId_New, u.CreatedAt,
        r.Name AS RoleName,
        r.DisplayName AS RoleDisplayName
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId_New = r.Id
    ORDER BY u.CreatedAt DESC
`);
        res.json(result.recordset);
    } catch (err) {
        console.error('getAllUsers Error:', err.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน' });
    }
};

// PUT /api/users/:id - แก้ไขข้อมูล User (เฉพาะ Admin)
// แทนที่ updateUser ทั้งฟังก์ชันใน backend/controllers/userController.js

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, roleId, password } = req.body;

        const request = new sql.Request();
        request.input('Id', sql.Int, id);
        request.input('FullName', sql.NVarChar, fullName || null);
        request.input('Email', sql.NVarChar, email || null);
        request.input('RoleId', sql.Int, roleId);  // อัปเดตทั้ง 2 column

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            request.input('PasswordHash', sql.NVarChar, hashedPassword);
            await request.query(`
                UPDATE Users 
                SET FullName = @FullName, 
                    Email = @Email, 
                    RoleId = @RoleId, 
                    RoleId_New = @RoleId,
                    PasswordHash = @PasswordHash
                WHERE Id = @Id
            `);
        } else {
            await request.query(`
                UPDATE Users 
                SET FullName = @FullName, 
                    Email = @Email, 
                    RoleId = @RoleId,
                    RoleId_New = @RoleId
                WHERE Id = @Id
            `);
        }

        res.json({ message: 'อัปเดตข้อมูลผู้ใช้งานสำเร็จ' });
    } catch (err) {
        console.error('updateUser Error:', err.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
    }
};

// DELETE /api/users/:id - ลบ User (เฉพาะ Admin)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // ป้องกันการลบตัวเอง
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' });
        }

        const request = new sql.Request();
        request.input('Id', sql.Int, id);
        await request.query('DELETE FROM Users WHERE Id = @Id');

        res.json({ message: 'ลบผู้ใช้งานสำเร็จ' });
    } catch (err) {
        console.error('deleteUser Error:', err.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน' });
    }
};

module.exports = { getAllUsers, updateUser, deleteUser };