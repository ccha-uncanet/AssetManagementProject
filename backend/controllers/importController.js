const { sql } = require('../config/db');
const xlsx = require('xlsx');

const importAssets = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาแนบไฟล์ Excel' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            return res.status(400).json({ error: 'ไม่พบข้อมูลในไฟล์' });
        }

        const results = { success: 0, failed: 0, errors: [] };

        for (const row of rows) {
            try {
                const request = new sql.Request();
                request.input('Name', sql.NVarChar, row['Name'] || row['ชื่อ'] || '');
                request.input('InvNo', sql.NVarChar, row['InvNo'] || row['รหัสทรัพย์สิน'] || '');
                request.input('Category', sql.NVarChar, row['Category'] || row['หมวดหมู่'] || '');
                request.input('Location', sql.NVarChar, row['Location'] || row['สถานที่'] || '');
                request.input('SerialNumber', sql.NVarChar, row['SerialNumber'] || row['Serial Number'] || '');
                request.input('Description', sql.NVarChar, row['Description'] || row['รายละเอียด'] || '');
                request.input('PurchasePrice', sql.Decimal(18, 2), parseFloat(row['PurchasePrice'] || row['ราคา'] || 0));
                request.input('HasRfid', sql.Bit, row['HasRfid'] == 1 ? 1 : 0);
                request.input('RfidTag', sql.NVarChar, row['RfidTag'] || '');
                request.input('Status', sql.Int, 1);

                // จัดการ PurchaseDate
                let purchaseDate = new Date();
                if (row['PurchaseDate'] || row['วันที่ซื้อ']) {
                    const dateVal = row['PurchaseDate'] || row['วันที่ซื้อ'];
                    if (typeof dateVal === 'number') {
                        // Excel date serial number
                        purchaseDate = new Date((dateVal - 25569) * 86400 * 1000);
                    } else {
                        purchaseDate = new Date(dateVal);
                    }
                }
                request.input('PurchaseDate', sql.DateTime, purchaseDate);

                await request.query(`
                    INSERT INTO Assets 
                    (Id, Name, InvNo, Category, Location, SerialNumber, Description, 
                     PurchaseDate, PurchasePrice, Status, HasRfid, RfidTag)
                    VALUES 
                    (NEWID(), @Name, @InvNo, @Category, @Location, @SerialNumber, @Description,
                     @PurchaseDate, @PurchasePrice, @Status, @HasRfid, @RfidTag)
                `);
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`แถว ${row['InvNo'] || '?'}: ${err.message}`);
            }
        }

        res.json({
            message: `นำเข้าสำเร็จ ${results.success} รายการ, ล้มเหลว ${results.failed} รายการ`,
            ...results
        });
    } catch (err) {
        console.error('Import Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Download Template
const downloadTemplate = (req, res) => {
    const xlsx = require('xlsx');
    const template = [
        {
            'InvNo': 'IT-001',
            'Name': 'คอมพิวเตอร์',
            'Category': 'IT Equipment',
            'Location': 'ห้อง 101',
            'SerialNumber': 'SN-12345',
            'PurchaseDate': '2024-01-01',
            'PurchasePrice': 35000,
            'Description': 'รายละเอียดเพิ่มเติม',
            'HasRfid': 0,
            'RfidTag': ''
        },
        {
            'InvNo': 'IT-002',
            'Name': 'โปรเจคเตอร์เพดาน',
            'Category': 'IT Equipment',
            'Location': 'ห้อง 102',
            'SerialNumber': 'SN-12346',
            'PurchaseDate': '2024-01-01',
            'PurchasePrice': 45000,
            'Description': 'ติดเพดานห้องประชุม',
            'HasRfid': 1,
            'RfidTag': 'E2003411B802011819750075'
        }
    ];

    const ws = xlsx.utils.json_to_sheet(template);
    const wb = xlsx.utils.book_new();

    // ปรับความกว้าง column
    ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
        { wch: 8 }, { wch: 25 }
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Assets Template');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=asset_import_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
};

module.exports = { importAssets, downloadTemplate };