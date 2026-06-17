const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        // req.user ถูกส่งต่อมาจาก authMiddleware.js
        if (!req.user || !allowedRoles.includes(req.user.roleId)) {
            return res.status(403).json({ message: 'ปฏิเสธการเข้าถึง: คุณไม่มีสิทธิ์ใช้งานในส่วนนี้' });
        }
        next(); // ผ่านการตรวจสอบ ให้ไปต่อได้
    };
};

module.exports = { checkRole };