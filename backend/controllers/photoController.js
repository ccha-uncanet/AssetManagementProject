const { sql } = require('../config/db');
const path = require('path');
const fs = require('fs');

const getAssetPhotos = async (req, res) => {
    try {
        const { assetId } = req.params;
        const request = new sql.Request();
        request.input('AssetId', sql.UniqueIdentifier, assetId);
        const result = await request.query(`
            SELECT Id, AssetId, FileName, FilePath, FileSize,
                   IsPrimary, UploadDate, MimeType, OriginalName
            FROM AssetPhotos
            WHERE AssetId = @AssetId
            ORDER BY UploadDate ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('getAssetPhotos error:', err); // ✅ log ชัดขึ้น
        res.status(500).json({ error: err.message });
    }
};

const uploadPhoto = async (req, res) => {
    try {
        const { assetId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });
        }

        const request = new sql.Request();
        request.input('AssetId',     sql.UniqueIdentifier, assetId);
        request.input('FileName',    sql.NVarChar,         req.file.originalname);
        request.input('FilePath',    sql.NVarChar,         `/uploads/assets/${req.file.filename}`);
        request.input('FileSize',    sql.BigInt,           req.file.size);
        request.input('IsPrimary',   sql.Bit,              false);
        request.input('UploadDate',  sql.DateTime,         new Date());
        request.input('MimeType',    sql.NVarChar,         req.file.mimetype);
        request.input('OriginalName',sql.NVarChar,         req.file.originalname);

        await request.query(`
            INSERT INTO AssetPhotos 
                (Id, AssetId, FileName, FilePath, FileSize, IsPrimary, UploadDate, MimeType, OriginalName)
            VALUES 
                (NEWID(), @AssetId, @FileName, @FilePath, @FileSize, @IsPrimary, @UploadDate, @MimeType, @OriginalName)
        `);

        res.status(201).json({ message: 'อัปโหลดรูปสำเร็จ' });
    } catch (err) {
        console.error('uploadPhoto error:', err); // ✅ log ชัดขึ้น
        res.status(500).json({ error: err.message });
    }
};

const deletePhoto = async (req, res) => {
    try {
        const { photoId } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, photoId);

        const result = await request.query('SELECT FilePath FROM AssetPhotos WHERE Id = @Id');
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'ไม่พบรูปภาพ' });
        }

        const fullPath = path.join(__dirname, '..', result.recordset[0].FilePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

        const delRequest = new sql.Request();
        delRequest.input('Id', sql.UniqueIdentifier, photoId);
        await delRequest.query('DELETE FROM AssetPhotos WHERE Id = @Id');

        res.json({ message: 'ลบรูปสำเร็จ' });
    } catch (err) {
        console.error('deletePhoto error:', err); // ✅ log ชัดขึ้น
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAssetPhotos, uploadPhoto, deletePhoto };