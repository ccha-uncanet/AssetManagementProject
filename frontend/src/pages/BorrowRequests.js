import React, { useState, useEffect, useCallback } from 'react';
import { borrowAPI } from '../services/api';
import { Loader2, Search, X, RefreshCw, Package, Printer, ArrowUpFromLine } from 'lucide-react';

const STATUS_CFG = {
  pending:  { label: 'รอดำเนินการ',  color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  approved: { label: 'อนุมัติแล้ว',  color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500'   },
  returned: { label: 'คืนแล้ว',      color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500'  },
  rejected: { label: 'ปฏิเสธ',       color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500'    },
};

const TRANSITIONS = {
  pending:  ['approved', 'rejected'],
  approved: ['returned', 'rejected'],
  returned: [],
  rejected: [],
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.color} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {c.label}
    </span>
  );
};

// ── พิมพ์ใบยืม ────────────────────────────────────────────────────────────────
const printSlip = (r) => {
  const assetRows = r.assets.map(a =>
    `<tr><td>${a.code || '-'}</td><td>${a.name || '-'}</td></tr>`
  ).join('');

  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>ใบยืมทรัพย์สิน #${String(r.id).padStart(5,'0')}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Sarabun',sans-serif;padding:32px;color:#1a1a1a;font-size:14px}
      .header{text-align:center;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:24px}
      .header h1{font-size:22px;font-weight:700}
      .header p{font-size:12px;color:#555;margin-top:4px}
      .section{margin-bottom:20px}
      .section-title{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
      .field label{font-size:11px;color:#aaa}
      .field p{font-size:14px;font-weight:500;margin-top:2px}
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:12px;font-weight:700;border-bottom:2px solid #e2e8f0}
      td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:48px}
      .sig{text-align:center;font-size:12px;color:#555;border-top:1px solid #555;padding-top:8px}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="header">
      <h1>ใบยืมทรัพย์สิน</h1>
      <p>เลขที่ #${String(r.id).padStart(5,'0')} · วันที่ออก: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</p>
    </div>
    <div class="section">
      <div class="section-title">ข้อมูลการยืม</div>
      <div class="grid2">
        <div class="field"><label>ผู้ยืม</label><p>${r.borrower_name}</p></div>
        <div class="field"><label>วันกำหนดคืน</label><p>${r.expected_return ? new Date(r.expected_return).toLocaleDateString('th-TH') : '-'}</p></div>
        <div class="field"><label>ผู้แจ้ง</label><p>${r.requested_by_name || '-'}</p></div>
        <div class="field"><label>วันที่ยืม</label><p>${new Date(r.created_at).toLocaleDateString('th-TH')}</p></div>
      </div>
    </div>
    ${r.note ? `<div class="section"><div class="section-title">หมายเหตุ</div><p>${r.note}</p></div>` : ''}
    <div class="section">
      <div class="section-title">รายการทรัพย์สิน (${r.assets.length} รายการ)</div>
      <table><thead><tr><th>รหัส InvNo</th><th>ชื่อทรัพย์สิน</th></tr></thead>
      <tbody>${assetRows}</tbody></table>
    </div>
    <div class="sigs">
      <div class="sig">ผู้ยืม<br/><br/>…………………………</div>
      <div class="sig">ผู้อนุมัติ<br/><br/>…………………………</div>
      <div class="sig">ผู้จ่ายทรัพย์สิน<br/><br/>…………………………</div>
    </div>
    </body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
};

// ── Detail Modal ──────────────────────────────────────────────────────────────
const DetailModal = ({ request, onClose, onUpdate }) => {
  const [nextStatus, setNextStatus] = useState(request.status);
  const [adminNote, setAdminNote]   = useState('');
  const [saving, setSaving]         = useState(false);
  const transitions = TRANSITIONS[request.status] || [];

  const handleSave = async () => {
    if (nextStatus === request.status) return;
    setSaving(true);
    try {
      await borrowAPI.updateStatus(request.id, { status: nextStatus, admin_note: adminNote });
      onUpdate();
      onClose();
    } catch {
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">#{String(request.id).padStart(5,'0')}</p>
            <h2 className="text-base font-bold text-gray-900">คำขอยืมทรัพย์สิน</h2>
            <p className="text-xs text-gray-400">{request.borrower_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => printSlip(request)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              <Printer size={14}/> พิมพ์ใบยืม
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <StatusBadge status={request.status}/>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
            <div><p className="text-xs text-gray-400">ผู้ยืม</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{request.borrower_name}</p></div>
            <div><p className="text-xs text-gray-400">กำหนดคืน</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {request.expected_return ? new Date(request.expected_return).toLocaleDateString('th-TH') : '-'}
              </p></div>
            <div><p className="text-xs text-gray-400">ผู้แจ้ง</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{request.requested_by_name || '-'}</p></div>
            <div><p className="text-xs text-gray-400">วันที่แจ้ง</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {new Date(request.created_at).toLocaleDateString('th-TH',{month:'short',day:'numeric',year:'numeric'})}
              </p></div>
          </div>

          {request.note && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">หมายเหตุ</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">{request.note}</div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              รายการทรัพย์สิน ({request.assets?.length || 0})
            </p>
            <div className="space-y-2">
              {(request.assets || []).map((a, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Package size={14} className="text-gray-400 flex-shrink-0"/>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.code || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {request.admin_note && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">บันทึกจาก Admin</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">{request.admin_note}</div>
            </div>
          )}

          {transitions.length > 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">อัปเดตสถานะ</p>
              <div className="flex flex-wrap gap-2">
                {transitions.map(s => {
                  const c = STATUS_CFG[s];
                  return (
                    <button key={s} onClick={() => setNextStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                        nextStatus === s ? `${c.bg} ${c.color} border-current` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                placeholder="บันทึกเพิ่มเติม (ไม่บังคับ)" rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
              <button onClick={handleSave} disabled={saving || nextStatus === request.status}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการอัปเดต'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main BorrowRequests ───────────────────────────────────────────────────────
// วางที่: frontend/src/pages/BorrowRequests.js
const BorrowRequests = () => {
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await borrowAPI.getAll();
      setRequests(res.data?.data || res.data || []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = requests.filter(r => {
    const ms = filterStatus === 'all' || r.status === filterStatus;
    const kw = !search || [r.borrower_name, r.requested_by_name, ...(r.assets||[]).map(a=>a.name)]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return ms && kw;
  });

  const counts = requests.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status]||0)+1 }), {});

  return (
    <div className="space-y-5">
      {/* summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CFG).map(([key, c]) => (
          <button key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-sm font-medium transition-all ${
              filterStatus === key ? `${c.bg} ${c.color} border-current` : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
            {c.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus===key?'bg-white/60':'bg-gray-100'}`}>
              {counts[key]||0}
            </span>
          </button>
        ))}
        <button onClick={fetchData} disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={13} className={loading?'animate-spin':''}/> รีเฟรช
        </button>
      </div>

      {/* search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาผู้ยืม, ผู้แจ้ง, ชื่อทรัพย์สิน..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14}/></button>}
      </div>

      {/* table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-3"/> กำลังโหลด...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ArrowUpFromLine size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="font-medium">ไม่พบคำขอยืม</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {['เลขที่','ผู้ยืม','รายการ','กำหนดคืน','ผู้แจ้ง','สถานะ','วันที่แจ้ง',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">#{String(r.id).padStart(5,'0')}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.borrower_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {r.assets?.length || 0} รายการ
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {r.expected_return ? new Date(r.expected_return).toLocaleDateString('th-TH',{month:'short',day:'numeric'}) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.requested_by_name || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status}/></td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('th-TH',{month:'short',day:'numeric'})}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-blue-600 font-medium">ดูรายละเอียด →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailModal request={selected} onClose={() => setSelected(null)}
          onUpdate={() => { fetchData(); setSelected(null); }}/>
      )}
    </div>
  );
};

export default BorrowRequests;