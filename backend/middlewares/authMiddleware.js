const jwt = require('jsonwebtoken');

// 1. ตรวจสอบ Token
const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'ปฏิเสธการเข้าถึง: ไม่พบ Token' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified.user;
        next();
    } catch (err) {
        // แยก error ให้ชัด — TokenExpiredError vs อื่นๆ
        if (err.name === 'TokenExpiredError') {
            // 401 → Frontend interceptor จับได้ → redirect /login อัตโนมัติ
            return res.status(401).json({ message: 'Token หมดอายุ กรุณา Login ใหม่' });
        }
        // token ปลอม/แก้ไข → 403
        return res.status(403).json({ message: 'Token ไม่ถูกต้อง' });
    }
};

// 2. เช็ค Role
const hasRole = (...roles) => (req, res, next) => {
    console.log('hasRole check:', req.user?.roleName, 'allowed:', roles);
    if (!req.user || !roles.includes(req.user.roleName)) {
        return res.status(403).json({ message: `เฉพาะ ${roles.join('/')} เท่านั้นที่มีสิทธิ์ใช้งาน` });
    }
    next();
};

// 3. เช็ค Permission
const hasPermission = (permission) => (req, res, next) => {
    if (!req.user?.permissions?.includes(permission)) {
        return res.status(403).json({ message: `ไม่มีสิทธิ์: ${permission}` });
    }
    next();
};

// 4. เช็ค Admin (backward compatible)
const isAdmin = (req, res, next) => {
    if (!req.user || !['superadmin', 'admin'].includes(req.user.roleName)) {
        return res.status(403).json({ message: 'เฉพาะ Admin เท่านั้นที่มีสิทธิ์ใช้งาน' });
    }
    next();
};

module.exports = { verifyToken, hasRole, hasPermission, isAdmin };