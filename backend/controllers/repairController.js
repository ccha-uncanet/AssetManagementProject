// controllers/repairController.js
const { sql } = require('../config/db');

// ── Helper: สร้างตาราง RepairRequests ถ้ายังไม่มี ────────────────────────────
const ensureTable = async () => {
    try {
        const request = new sql.Request();
        request.timeout = 30000;
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RepairRequests' AND xtype='U')
            CREATE TABLE RepairRequests (
                Id              INT IDENTITY(1,1) PRIMARY KEY,
                AssetId         UNIQUEIDENTIFIER  NOT NULL,
                AssetCode       NVARCHAR(100)     NOT NULL DEFAULT '',
                AssetName       NVARCHAR(255)     NOT NULL DEFAULT '',
                RequestedBy     INT               NULL,
                RequestedByName NVARCHAR(255)     NOT NULL DEFAULT '',
                Urgency         NVARCHAR(20)      NOT NULL DEFAULT 'normal',
                Symptom         NVARCHAR(MAX)     NOT NULL DEFAULT '',
                Note            NVARCHAR(MAX)     NOT NULL DEFAULT '',
                Status          NVARCHAR(30)      NOT NULL DEFAULT 'pending',
                AdminNote       NVARCHAR(MAX)     NOT NULL DEFAULT '',
                Images          NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
                CreatedAt       DATETIME          NOT NULL DEFAULT GETDATE(),
                UpdatedAt       DATETIME          NOT NULL DEFAULT GETDATE()
            )
        `);
        console.log('✅ RepairRequests table ready');
    } catch (err) {
        console.error('❌ ensureTable RepairRequests:', err.message);
    }
};

// ── Helper: บันทึก AssetTransaction ──────────────────────────────────────────
// action: 1=คืนคลัง, 2=ยืม, 3=ส่งซ่อม, 4=รอดำเนินการ, 5=ปฏิเสธ, 6=ซ่อมเสร็จ
const logAssetTransaction = async (assetId, userId, action, notes, location = '') => {
    try {
        const logReq = new sql.Request();
        logReq.input('AssetId',  sql.UniqueIdentifier, assetId);
        logReq.input('UserId',   sql.NVarChar,         String(userId || ''));
        logReq.input('Action',   sql.Int,              action);
        logReq.input('Notes',    sql.NVarChar,         notes    || '');
        logReq.input('Location', sql.NVarChar,         location || '');
        await logReq.query(`
            INSERT INTO AssetTransactions (Id, AssetId, UserId, Action, TransactionDate, Location, Notes)
            VALUES (NEWID(), @AssetId, @UserId, @Action, GETDATE(), @Location, @Notes)
        `);
    } catch (err) {
        console.error('logAssetTransaction error:', err.message);
    }
};

// ── mapRow ────────────────────────────────────────────────────────────────────
const mapRow = (r) => ({
    id:                r.Id,
    asset_id:          r.AssetId,
    asset_code:        r.AssetCode,
    asset_name:        r.AssetName,
    requested_by:      r.RequestedBy,
    requested_by_name: r.RequestedByName,
    urgency:           r.Urgency,
    symptom:           r.Symptom,
    note:              r.Note,
    status:            r.Status,
    admin_note:        r.AdminNote,
    images:            (() => { try { return JSON.parse(r.Images || '[]'); } catch { return []; } })(),
    created_at:        r.CreatedAt,
    updated_at:        r.UpdatedAt,
});

// ── POST /api/repair-requests ─────────────────────────────────────────────────
const createRepairRequest = async (req, res) => {
    try {
        const { asset_id, asset_code, asset_name, urgency, symptom, note } = req.body;

        if (!asset_id || !symptom?.trim()) {
            return res.status(400).json({ message: 'asset_id และ symptom จำเป็นต้องมี' });
        }

        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                imageUrls.push(`/uploads/repairs/${file.filename}`);
            });
        }

        const requestedBy     = req.user?.id     || req.user?.userId || null;
        const requestedByName = req.user?.fullName || req.user?.username || '';

        const request = new sql.Request();
        request.input('AssetId',         sql.UniqueIdentifier, asset_id);
        request.input('AssetCode',       sql.NVarChar, asset_code     || '');
        request.input('AssetName',       sql.NVarChar, asset_name     || '');
        request.input('RequestedBy',     sql.Int,      requestedBy);
        request.input('RequestedByName', sql.NVarChar, requestedByName);
        request.input('Urgency',         sql.NVarChar, urgency        || 'normal');
        request.input('Symptom',         sql.NVarChar, symptom.trim());
        request.input('Note',            sql.NVarChar, note?.trim()   || '');
        request.input('Images',          sql.NVarChar, JSON.stringify(imageUrls));

        const result = await request.query(`
            INSERT INTO RepairRequests
                (AssetId, AssetCode, AssetName, RequestedBy, RequestedByName,
                 Urgency, Symptom, Note, Status, Images)
            OUTPUT INSERTED.*
            VALUES
                (@AssetId, @AssetCode, @AssetName, @RequestedBy, @RequestedByName,
                 @Urgency, @Symptom, @Note, 'pending', @Images)
        `);

        const newRequest = result.recordset[0];

        // ── บันทึก log: ส่งซ่อม pending (action=4 รอดำเนินการ) ──
        await logAssetTransaction(
            asset_id, requestedBy, 4,
            `รอซ่อม | ${asset_name || asset_code} | อาการ: ${symptom.trim()} | คำขอ #${newRequest.Id}`
        );

        res.status(201).json({
            message: 'ส่งคำขอซ่อมสำเร็จ',
            data: mapRow(newRequest),
        });
    } catch (err) {
        console.error('createRepairRequest error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างคำขอซ่อม' });
    }
};

// ── GET /api/repair-requests ──────────────────────────────────────────────────
const getRepairRequests = async (req, res) => {
    try {
        const { status, urgency, asset_id } = req.query;

        let where = 'WHERE 1=1';
        const request = new sql.Request();

        if (status) {
            where += ' AND Status = @Status';
            request.input('Status', sql.NVarChar, status);
        }
        if (urgency) {
            where += ' AND Urgency = @Urgency';
            request.input('Urgency', sql.NVarChar, urgency);
        }
        if (asset_id) {
            where += ' AND AssetId = @AssetId';
            request.input('AssetId', sql.UniqueIdentifier, asset_id);
        }

        const result = await request.query(
            `SELECT * FROM RepairRequests ${where} ORDER BY CreatedAt DESC`
        );

        res.json({ data: result.recordset.map(mapRow) });
    } catch (err) {
        console.error('getRepairRequests error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ── GET /api/repair-requests/my ───────────────────────────────────────────────
const getMyRepairRequests = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const request = new sql.Request();
        request.input('UserId', sql.Int, userId);

        const result = await request.query(
            `SELECT * FROM RepairRequests WHERE RequestedBy = @UserId ORDER BY CreatedAt DESC`
        );

        res.json({ data: result.recordset.map(mapRow) });
    } catch (err) {
        console.error('getMyRepairRequests error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── GET /api/repair-requests/counts ──────────────────────────────────────────
const getRepairCounts = async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT
                SUM(CASE WHEN Status = 'pending'   THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN Status = 'approved'  THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN Status = 'returned'  THEN 1 ELSE 0 END) AS returned,
                SUM(CASE WHEN Status = 'rejected'  THEN 1 ELSE 0 END) AS rejected
            FROM RepairRequests
        `);
        const row = result.recordset[0] || {};
        res.json({
            pending:   row.pending   || 0,
            approved:  row.approved  || 0,
            completed: row.completed || 0,
            returned:  row.returned  || 0,
            rejected:  row.rejected  || 0,
        });
    } catch (err) {
        console.error('getRepairCounts error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── GET /api/repair-requests/:id ─────────────────────────────────────────────
const getRepairRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.Int, id);
        const result = await request.query('SELECT * FROM RepairRequests WHERE Id = @Id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'ไม่พบคำขอซ่อม' });
        }
        res.json(mapRow(result.recordset[0]));
    } catch (err) {
        console.error('getRepairRequestById error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── PATCH /api/repair-requests/:id/status ────────────────────────────────────
const updateRepairStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_note } = req.body;

        const validStatuses = ['approved', 'completed', 'returned', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `status ไม่ถูกต้อง ต้องเป็น ${validStatuses.join(' | ')}` });
        }

        // ดึงข้อมูลคำขอเดิม
        const fetchReq = new sql.Request();
        fetchReq.input('Id', sql.Int, id);
        const fetchResult = await fetchReq.query('SELECT * FROM RepairRequests WHERE Id = @Id');

        if (fetchResult.recordset.length === 0) {
            return res.status(404).json({ message: 'ไม่พบคำขอซ่อม' });
        }

        const repairRequest = fetchResult.recordset[0];
        const adminId = req.user?.id || req.user?.userId || repairRequest.RequestedBy;

        const request = new sql.Request();
        request.input('Id',        sql.Int,      id);
        request.input('Status',    sql.NVarChar, status);
        request.input('AdminNote', sql.NVarChar, admin_note || '');

        const result = await request.query(`
            UPDATE RepairRequests
            SET Status    = @Status,
                AdminNote = @AdminNote,
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.*
            WHERE Id = @Id
        `);

        // ── บันทึก log ตาม status ──
        if (status === 'approved') {
            // อนุมัติซ่อม → asset เป็นส่งซ่อม (3)
            const assetReq = new sql.Request();
            assetReq.input('Id',     sql.UniqueIdentifier, repairRequest.AssetId);
            assetReq.input('Status', sql.Int,              3);
            await assetReq.query('UPDATE Assets SET Status = @Status WHERE Id = @Id').catch(() => {});

            await logAssetTransaction(
                repairRequest.AssetId, adminId, 3,
                `อนุมัติส่งซ่อม | ${repairRequest.AssetName} | คำขอ #${id}`
            );
        } else if (status === 'completed') {
            // ซ่อมเสร็จ (action=6)
            await logAssetTransaction(
                repairRequest.AssetId, adminId, 6,
                `ซ่อมเสร็จ | ${repairRequest.AssetName} | คำขอ #${id}`
            );
        } else if (status === 'returned') {
            // คืนหลังซ่อม → asset กลับเป็นว่าง (1)
            const assetReq = new sql.Request();
            assetReq.input('Id',     sql.UniqueIdentifier, repairRequest.AssetId);
            assetReq.input('Status', sql.Int,              1);
            await assetReq.query('UPDATE Assets SET Status = @Status WHERE Id = @Id').catch(() => {});

            await logAssetTransaction(
                repairRequest.AssetId, adminId, 1,
                `คืนหลังซ่อม | ${repairRequest.AssetName} | คำขอ #${id}`
            );
        } else if (status === 'rejected') {
            // ปฏิเสธ (action=5)
            await logAssetTransaction(
                repairRequest.AssetId, adminId, 5,
                `ปฏิเสธคำขอซ่อม | ${repairRequest.AssetName} | คำขอ #${id}${admin_note ? ' | เหตุผล: ' + admin_note : ''}`
            );
        }

        res.json({
            message: 'อัปเดตสถานะสำเร็จ',
            data: mapRow(result.recordset[0]),
        });
    } catch (err) {
        console.error('updateRepairStatus error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
};

module.exports = {
    ensureTable,
    createRepairRequest,
    getRepairRequests,
    getMyRepairRequests,
    getRepairCounts,
    getRepairRequestById,
    updateRepairStatus,
};