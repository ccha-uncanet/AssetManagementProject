import React, { useState, useEffect, useCallback } from 'react';
import { repairAPI } from '../services/api';
import {
  Loader2, AlertTriangle, Search, X, ChevronDown,
  Printer, CheckCircle2, Clock, Wrench, Package,
  XCircle, RefreshCw,
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { label: 'รอดำเนินการ',          color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500', border: 'border-yellow-200' },
  approved:  { label: 'อนุมัติ / กำลังซ่อม',  color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500',   border: 'border-blue-200'   },
  completed: { label: 'ซ่อมเสร็จ / รอรับคืน', color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500',  border: 'border-green-200'  },
  returned:  { label: 'คืนแล้ว',               color: 'text-gray-500',   bg: 'bg-gray-100',   dot: 'bg-gray-400',   border: 'border-gray-200'   },
  rejected:  { label: 'ปฏิเสธ',                color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500',    border: 'border-red-200'    },
};

// Status ที่กด transition ต่อได้
const TRANSITIONS = {
  pending:   ['approved', 'rejected'],
  approved:  ['completed', 'rejected'],
  completed: ['returned'],
  returned:  [],
  rejected:  [],
};

const URGENCY_CFG = {
  urgent: { label: '⚡ เร่งด่วน', color: 'text-red-600',  bg: 'bg-red-50  border-red-200'  },
  normal: { label: 'ปกติ',        color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
};

// ── Sub components ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.color} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const UrgencyBadge = ({ urgency }) => {
  const c = URGENCY_CFG[urgency] || URGENCY_CFG.normal;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c.color} ${c.bg}`}>
      {c.label}
    </span>
  );
};

// ── Print slip ────────────────────────────────────────────────────────────────
const printSlip = (r) => {
  const w = window.open('', '_blank');
  const images = r.images || [];
  w.document.write(`
    <html>
    <head>
      <title>ใบส่งซ่อม #${String(r.id).padStart(5,'0')}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Sarabun',sans-serif;padding:32px;color:#1a1a1a;font-size:14px}
        .header{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px}
        .header h1{font-size:22px;font-weight:700}
        .header p{font-size:13px;color:#555;margin-top:4px}
        .section{margin-bottom:20px}
        .section-title{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
        .field label{font-size:11px;color:#aaa}
        .field p{font-size:14px;font-weight:500;margin-top:2px}
        .box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;line-height:1.7;white-space:pre-wrap}
        .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid}
        .badge-urgent{background:#fee2e2;color:#b91c1c;border-color:#fca5a5}
        .badge-normal{background:#dbeafe;color:#1d4ed8;border-color:#93c5fd}
        .imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
        .imgs img{width:120px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb}
        .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:48px}
        .sig{text-align:center;font-size:12px;color:#555;border-top:1px solid #555;padding-top:8px}
        @media print{body{padding:20px}}
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ใบส่งซ่อมทรัพย์สิน</h1>
        <p>เลขที่ #${String(r.id).padStart(5,'0')} · วันที่ออก: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <div class="section">
        <div class="section-title">ข้อมูลทรัพย์สิน</div>
        <div class="grid2">
          <div class="field"><label>รหัสทรัพย์สิน</label><p>${r.asset_code||'-'}</p></div>
          <div class="field"><label>ชื่อทรัพย์สิน</label><p>${r.asset_name||'-'}</p></div>
          <div class="field"><label>ความเร่งด่วน</label><p><span class="badge badge-${r.urgency}">${r.urgency==='urgent'?'⚡ เร่งด่วน':'ปกติ'}</span></p></div>
          <div class="field"><label>วันที่แจ้ง</label><p>${new Date(r.created_at).toLocaleDateString('th-TH')}</p></div>
          <div class="field"><label>ผู้แจ้งซ่อม</label><p>${r.requested_by_name||'-'}</p></div>
          <div class="field"><label>สถานะ</label><p>${STATUS_CFG[r.status]?.label||'-'}</p></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">อาการเสีย / รายละเอียดปัญหา</div>
        <div class="box">${r.symptom||'-'}</div>
      </div>
      ${r.note?`<div class="section"><div class="section-title">หมายเหตุ</div><div class="box">${r.note}</div></div>`:''}
      ${images.length?`<div class="section"><div class="section-title">รูปภาพความเสียหาย</div><div class="imgs">${images.map(img=>`<img src="${img}"/>`).join('')}</div></div>`:''}
      <div class="sigs">
        <div class="sig">ผู้แจ้งซ่อม<br/><br/>…………………………</div>
        <div class="sig">ผู้อนุมัติ<br/><br/>…………………………</div>
        <div class="sig">ช่างผู้รับงาน<br/><br/>…………………………</div>
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
  const [imgIdx, setImgIdx]         = useState(0);
  const transitions = TRANSITIONS[request.status] || [];

  const handleSave = async () => {
    if (nextStatus === request.status) return;
    setSaving(true);
    try {
      await repairAPI.updateStatus(request.id, { status: nextStatus, admin_note: adminNote });
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">#{String(request.id).padStart(5,'0')}</p>
            <h2 className="text-lg font-bold text-gray-900">{request.asset_name}</h2>
            <p className="text-xs text-gray-400">{request.asset_code}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => printSlip(request)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Printer size={15}/> พิมพ์ใบส่งซ่อม
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={request.status}/>
            <UrgencyBadge urgency={request.urgency}/>
          </div>

          {/* info */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-400">ผู้แจ้งซ่อม</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{request.requested_by_name||'-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">วันที่แจ้ง</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {new Date(request.created_at).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'})}
              </p>
            </div>
          </div>

          {/* symptom */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">อาการเสีย / รายละเอียดปัญหา</p>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {request.symptom}
            </div>
          </div>

          {/* note */}
          {request.note && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">หมายเหตุ</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {request.note}
              </div>
            </div>
          )}

          {/* images */}
          {request.images?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                รูปภาพความเสียหาย ({request.images.length})
              </p>
              <div className="flex gap-2 flex-wrap mb-2">
                {request.images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i===imgIdx?'border-orange-400':'border-gray-200'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <img src={request.images[imgIdx]} alt="" className="w-full max-h-56 object-contain bg-gray-100"/>
              </div>
            </div>
          )}

          {/* admin note from previous update */}
          {request.admin_note && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">บันทึกจาก Admin</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
                {request.admin_note}
              </div>
            </div>
          )}

          {/* status update panel */}
          {transitions.length > 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">อัปเดตสถานะ</p>
              <div className="flex flex-wrap gap-2">
                {transitions.map(s => {
                  const c = STATUS_CFG[s];
                  return (
                    <button key={s} onClick={() => setNextStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                        nextStatus===s ? `${c.bg} ${c.color} border-current` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="บันทึกเพิ่มเติม (ไม่บังคับ)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <button onClick={handleSave}
                disabled={saving || nextStatus === request.status}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={14} className="animate-spin"/> กำลังบันทึก...</> : 'บันทึกการอัปเดต'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main RepairRequests ───────────────────────────────────────────────────────
// วางไฟล์นี้ที่: frontend/src/pages/RepairRequests.js
const RepairRequests = () => {
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await repairAPI.getAll();
      setRequests(res.data?.data || res.data || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = requests.filter(r => {
    const ms = filterStatus === 'all' || r.status === filterStatus;
    const mu = filterUrgency === 'all' || r.urgency === filterUrgency;
    const kw = !search || [r.asset_name, r.asset_code, r.requested_by_name]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return ms && mu && kw;
  });

  const counts = requests.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status]||0)+1 }), {});

  return (
    <div className="space-y-5">

      {/* summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CFG).map(([key, c]) => (
          <button key={key}
            onClick={() => setFilterStatus(filterStatus===key?'all':key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-sm font-medium transition-all ${
              filterStatus===key ? `${c.bg} ${c.color} border-current` : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
            {c.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus===key?'bg-white/60':'bg-gray-100'}`}>
              {counts[key]||0}
            </span>
          </button>
        ))}
        <button onClick={fetchData} disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading?'animate-spin':''}/> รีเฟรช
        </button>
      </div>

      {/* search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, รหัส, ผู้แจ้ง..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14}/>
            </button>
          )}
        </div>
        <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="all">ทุกระดับ</option>
          <option value="urgent">⚡ เร่งด่วน</option>
          <option value="normal">ปกติ</option>
        </select>
      </div>

      {/* table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-3"/>
            กำลังโหลดข้อมูล...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Package size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="font-medium">ไม่พบคำขอซ่อม</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {['เลขที่','ทรัพย์สิน','ผู้แจ้ง','ความเร่งด่วน','สถานะ','วันที่แจ้ง',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id}
                    onClick={() => setSelected(r)}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      #{String(r.id).padStart(5,'0')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{r.asset_name}</p>
                      <p className="text-xs text-gray-400">{r.asset_code}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.requested_by_name||'-'}</td>
                    <td className="px-4 py-3"><UrgencyBadge urgency={r.urgency}/></td>
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

      {/* detail modal */}
      {selected && (
        <DetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => { fetchData(); setSelected(null); }}
        />
      )}
    </div>
  );
};

export default RepairRequests;