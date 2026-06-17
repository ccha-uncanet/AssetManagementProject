// controllers/borrowController.js
const { sql } = require('../config/db');

const mapRow = (r) => ({
    id:                r.Id,
    requested_by:      r.RequestedBy,
    requested_by_name: r.RequestedByName,
    borrower_name:     r.BorrowerName,
    expected_return:   r.ExpectedReturn,
    note:              r.Note,
    status:            r.Status,
    admin_note:        r.AdminNote,
    assets: (() => { try { return JSON.parse(r.Assets || '[]'); } catch { return []; } })(),
    created_at:        r.CreatedAt,
    updated_at:        r.UpdatedAt,
});

// ── Helper: บันทึก AssetTransaction ──────────────────────────────────────────
// action: 1=คืนคลัง, 2=ยืม, 3=ส่งซ่อม, 4=รอดำเนินการ, 5=ปฏิเสธ
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

// ── POST /api/borrow-requests ─────────────────────────────────────────────────
const createBorrowRequest = async (req, res) => {
    try {
        const { borrower_name, expected_return, note, assets } = req.body;

        if (!borrower_name?.trim()) {
            return res.status(400).json({ message: 'กรุณาระบุชื่อผู้ยืม' });
        }
        if (!assets?.length) {
            return res.status(400).json({ message: 'กรุณาเลือกทรัพย์สินอย่างน้อย 1 รายการ' });
        }

        const requestedBy     = req.user?.id     || req.user?.userId || null;
        const requestedByName = req.user?.fullName || req.user?.username || '';

        const request = new sql.Request();
        request.input('RequestedBy',     sql.Int,      requestedBy);
        request.input('RequestedByName', sql.NVarChar, requestedByName);
        request.input('BorrowerName',    sql.NVarChar, borrower_name.trim());
        request.input('ExpectedReturn',  sql.Date,     expected_return || null);
        request.input('Note',            sql.NVarChar, note?.trim() || '');
        request.input('Assets',          sql.NVarChar, JSON.stringify(assets));

        const result = await request.query(`
            INSERT INTO BorrowRequests
                (RequestedBy, RequestedByName, BorrowerName, ExpectedReturn, Note, Status, Assets)
            OUTPUT INSERTED.*
            VALUES
                (@RequestedBy, @RequestedByName, @BorrowerName, @ExpectedReturn, @Note, 'pending', @Assets)
        `);

        const newRequest = result.recordset[0];

        // ── บันทึก log: สร้างคำขอยืม (action=4 รอดำเนินการ) ──
        for (const asset of assets) {
            await logAssetTransaction(
                asset.id, requestedBy, 4,
                `รอดำเนินการ | ผู้ขอยืม: ${borrower_name.trim()} | คำขอ #${newRequest.Id}`
            );
        }

        res.status(201).json({
            message: 'ส่งคำขอยืมสำเร็จ',
            data: mapRow(newRequest),
        });
    } catch (err) {
        console.error('createBorrowRequest error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างคำขอยืม' });
    }
};

// ── GET /api/borrow-requests ──────────────────────────────────────────────────
const getBorrowRequests = async (req, res) => {
    try {
        const { status } = req.query;
        let where = 'WHERE 1=1';
        const request = new sql.Request();

        if (status) {
            where += ' AND Status = @Status';
            request.input('Status', sql.NVarChar, status);
        }

        const result = await request.query(
            `SELECT * FROM BorrowRequests ${where} ORDER BY CreatedAt DESC`
        );
        res.json({ data: result.recordset.map(mapRow) });
    } catch (err) {
        console.error('getBorrowRequests error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── GET /api/borrow-requests/my ───────────────────────────────────────────────
const getMyBorrowRequests = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const request = new sql.Request();
        request.input('UserId', sql.Int, userId);

        const result = await request.query(
            `SELECT * FROM BorrowRequests WHERE RequestedBy = @UserId ORDER BY CreatedAt DESC`
        );
        res.json({ data: result.recordset.map(mapRow) });
    } catch (err) {
        console.error('getMyBorrowRequests error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── GET /api/borrow-requests/counts ──────────────────────────────────────────
const getBorrowCounts = async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT
                SUM(CASE WHEN Status = 'pending'  THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN Status = 'returned' THEN 1 ELSE 0 END) AS returned,
                SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM BorrowRequests
        `);
        const row = result.recordset[0] || {};
        res.json({
            pending:  row.pending  || 0,
            approved: row.approved || 0,
            returned: row.returned || 0,
            rejected: row.rejected || 0,
        });
    } catch (err) {
        console.error('getBorrowCounts error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── GET /api/borrow-requests/:id ─────────────────────────────────────────────
const getBorrowRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.Int, id);
        const result = await request.query('SELECT * FROM BorrowRequests WHERE Id = @Id');

        if (!result.recordset.length) {
            return res.status(404).json({ message: 'ไม่พบคำขอยืม' });
        }
        res.json(mapRow(result.recordset[0]));
    } catch (err) {
        console.error('getBorrowRequestById error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// ── PATCH /api/borrow-requests/:id/status ────────────────────────────────────
const updateBorrowStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_note } = req.body;

        const validStatuses = ['approved', 'rejected', 'returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `status ต้องเป็น ${validStatuses.join(' | ')}` });
        }

        // ดึง request เดิม
        const fetchReq = new sql.Request();
        fetchReq.input('Id', sql.Int, id);
        const fetchResult = await fetchReq.query('SELECT * FROM BorrowRequests WHERE Id = @Id');

        if (!fetchResult.recordset.length) {
            return res.status(404).json({ message: 'ไม่พบคำขอยืม' });
        }

        const borrowRequest = fetchResult.recordset[0];
        const assets = (() => {
            try { return JSON.parse(borrowRequest.Assets || '[]'); } catch { return []; }
        })();
        const adminId = req.user?.id || req.user?.userId || borrowRequest.RequestedBy;

        // อัปเดตสถานะ
        const updateReq = new sql.Request();
        updateReq.input('Id',        sql.Int,      id);
        updateReq.input('Status',    sql.NVarChar, status);
        updateReq.input('AdminNote', sql.NVarChar, admin_note || '');

        const result = await updateReq.query(`
            UPDATE BorrowRequests
            SET Status    = @Status,
                AdminNote = @AdminNote,
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.*
            WHERE Id = @Id
        `);

        // ── บันทึก log ตาม status ──
        for (const asset of assets) {
            if (status === 'approved') {
                // เปลี่ยนสถานะ asset เป็นถูกยืม (2)
                const assetReq = new sql.Request();
                assetReq.input('Id',     sql.UniqueIdentifier, asset.id);
                assetReq.input('Status', sql.Int,              2);
                await assetReq.query('UPDATE Assets SET Status = @Status WHERE Id = @Id').catch(() => {});

                await logAssetTransaction(
                    asset.id, adminId, 2,
                    `อนุมัติการยืม | ผู้ยืม: ${borrowRequest.BorrowerName} | คำขอ #${id}`
                );
            } else if (status === 'returned') {
                // เปลี่ยนสถานะ asset กลับเป็นว่าง (1)
                const assetReq = new sql.Request();
                assetReq.input('Id',     sql.UniqueIdentifier, asset.id);
                assetReq.input('Status', sql.Int,              1);
                await assetReq.query('UPDATE Assets SET Status = @Status WHERE Id = @Id').catch(() => {});

                await logAssetTransaction(
                    asset.id, adminId, 1,
                    `คืนทรัพย์สิน | ผู้คืน: ${borrowRequest.BorrowerName} | คำขอ #${id}`
                );
            } else if (status === 'rejected') {
                // ปฏิเสธ (action=5)
                await logAssetTransaction(
                    asset.id, adminId, 5,
                    `ปฏิเสธคำขอยืม | ผู้ขอ: ${borrowRequest.BorrowerName} | คำขอ #${id}${admin_note ? ' | เหตุผล: ' + admin_note : ''}`
                );
            }
        }

        res.json({
            message: 'อัปเดตสถานะสำเร็จ',
            data: mapRow(result.recordset[0]),
        });
    } catch (err) {
        console.error('updateBorrowStatus error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
};

module.exports = {
    createBorrowRequest,
    getBorrowRequests,
    getMyBorrowRequests,
    getBorrowCounts,
    getBorrowRequestById,
    updateBorrowStatus,
};