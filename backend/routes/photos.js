const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middlewares/authMiddleware');
const { getAssetPhotos, uploadPhoto, deletePhoto } = require('../controllers/photoController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/assets'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp)'));
        }
    }
});

router.get('/:assetId', verifyToken, getAssetPhotos);
router.post('/:assetId', verifyToken, upload.single('photo'), uploadPhoto);
router.delete('/photo/:photoId', verifyToken, deletePhoto);

module.exports = router;