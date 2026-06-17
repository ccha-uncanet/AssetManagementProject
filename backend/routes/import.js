const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middlewares/authMiddleware');
const { importAssets, downloadTemplate } = require('../controllers/importController');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('กรุณาอัปโหลดไฟล์ .xlsx เท่านั้น'));
        }
    }
});

router.post('/assets', verifyToken, upload.single('file'), importAssets);
router.get('/template', verifyToken, downloadTemplate);

module.exports = router;