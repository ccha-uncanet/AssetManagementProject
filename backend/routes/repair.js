// routes/repair.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { verifyToken, hasRole } = require('../middlewares/authMiddleware');
const {
    createRepairRequest,
    getRepairRequests,
    getMyRepairRequests,
    getRepairCounts,
    getRepairRequestById,
    updateRepairStatus,
} = require('../controllers/repairController');

// ── Multer config — เก็บรูปใน uploads/repairs/ ───────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/repairs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const ext  = path.extname(file.originalname);
        const name = `repair_${Date.now()}_${Math.random().toString(36).slice(2,7)}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB ต่อรูป
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น'));
    },
});

// ── Routes ────────────────────────────────────────────────────────────────────
// หมายเหตุ: /counts และ /my ต้องอยู่ก่อน /:id เสมอ

// GET  /api/repair-requests/counts — จำนวนแยกตามสถานะ (admin/superadmin)
router.get('/counts', verifyToken, hasRole('admin', 'superadmin'), getRepairCounts);

// GET  /api/repair-requests/my — คำขอของตัวเอง (ทุก role)
router.get('/my', verifyToken, getMyRepairRequests);

// GET  /api/repair-requests — รายการทั้งหมด (admin/superadmin)
router.get('/', verifyToken, hasRole('admin', 'superadmin'), getRepairRequests);

// POST /api/repair-requests — สร้างคำขอซ่อม (ทุก role ที่ login แล้ว)
// รับไฟล์ได้สูงสุด 5 รูป ชื่อ field: image_0, image_1, ... image_4
router.post('/', verifyToken, upload.any(), createRepairRequest);

// GET  /api/repair-requests/:id — ดูรายละเอียด
router.get('/:id', verifyToken, getRepairRequestById);

// PATCH /api/repair-requests/:id/status — อัปเดตสถานะ (admin/superadmin)
router.patch('/:id/status', verifyToken, hasRole('admin', 'superadmin'), updateRepairStatus);

module.exports = router;