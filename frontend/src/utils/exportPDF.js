/**
 * exportPDF — เปิด print window รองรับภาษาไทยสมบูรณ์
 * กด "Save as PDF" ใน print dialog เพื่อบันทึกเป็น PDF
 */
export const exportPDF = ({ title, columns, rows, filename }) => {
  const tableHead = columns.map(col =>
    `<th>${col}</th>`
  ).join('');

  const tableRows = rows.map(row =>
    `<tr>${row.map((cell, i) =>
      `<td style="text-align:${i === 0 ? 'center' : 'left'}">${cell ?? '-'}</td>`
    ).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Sarabun','Noto Sans Thai',Arial,sans-serif; padding:20px; background:#fff; font-size:13px; }
    h2 { font-size:16px; margin-bottom:4px; color:#222; }
    .meta { font-size:11px; color:#888; margin-bottom:14px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:#2980b9; color:#fff; padding:8px 6px; border:1px solid #aaa; text-align:center; }
    td { padding:6px; border:1px solid #ddd; }
    tr:nth-child(even) td { background:#f5f5f5; }
    .actions { margin-bottom:14px; display:flex; gap:10px; align-items:center; }
    .btn-print { padding:8px 22px; background:#2980b9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-family:inherit; }
    .btn-close  { padding:8px 18px; background:#eee; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-family:inherit; }
    .hint { font-size:11px; color:#888; }
    @media print {
      @page { size:A4 landscape; margin:10mm; }
      .actions { display:none; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
    <button class="btn-close" onclick="window.close()">❌ ปิด</button>
    <span class="hint">💡 เลือก "Save as PDF" ใน dialog เพื่อบันทึก</span>
  </div>
  <h2>${title}</h2>
  <p class="meta">วันที่พิมพ์: ${new Date().toLocaleString('th-TH')} &nbsp;|&nbsp; ทั้งหมด ${rows.length} รายการ</p>
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1100,height=700');
  w.document.write(html);
  w.document.close();
};