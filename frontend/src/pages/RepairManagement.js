import React, { useState, useEffect, useCallback } from 'react';
import { repairAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RepairRequestModal from '../components/RepairRequestModal';
import {
  Wrench, Plus, Search, X, ChevronRight,
  Clock, CheckCircle2, XCircle, ArrowDownToLine, AlertTriangle,
  Package, Calendar, User, MessageSquare, RefreshCw, Zap, Image,
} from 'lucide-react';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { label: 'รอดำเนินการ', color: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-400', icon: Clock },
  approved:  { label: 'อนุมัติแล้ว', color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400',   icon: CheckCircle2 },
  completed: { label: 'ซ่อมเสร็จ',   color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400', icon: Wrench },
  returned:  { label: 'คืนคลังแล้ว', color: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  icon: ArrowDownToLine },
  rejected:  { label: 'ปฏิเสธ',      color: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    icon: XCircle },
};

const URGENCY = {
  urgent: { label: 'ด่วน',   color: 'bg-red-100 text-red-700' },
  normal: { label: 'ปกติ',   color: 'bg-gray-100 text-gray-600' },
};

const TABS = [
  { key: 'all',       label: 'ทั้งหมด' },
  { key: 'pending',   label: 'รอดำเนินการ' },
  { key: 'approved',  label: 'อนุมัติแล้ว' },
  { key: 'completed', label: 'ซ่อมเสร็จ' },
  { key: 'returned',  label: 'คืนคลังแล้ว' },
  { key: 'rejected',  label: 'ปฏิเสธ' },
];

const fmt = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {s.label}
    </span>
  );
};

// ── Action confirm modal ───────────────────────────────────────────────────────
const ActionModal = ({ type, request, onConfirm, onClose }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const config = {
    approve:  { title: 'อนุมัติคำขอซ่อม',  btn: 'อนุมัติ',     btnCls: 'bg-blue-600 hover:bg-blue-700',   noteLabel: 'หมายเหตุ (ไม่บังคับ)' },
    reject:   { title: 'ปฏิเสธคำขอซ่อม',   btn: 'ปฏิเสธ',      btnCls: 'bg-red-600 hover:bg-red-700',     noteLabel: 'เหตุผลที่ปฏิเสธ (ไม่บังคับ)' },
    complete: { title: 'บันทึกซ่อมเสร็จ',   btn: 'ซ่อมเสร็จแล้ว', btnCls: 'bg-purple-600 hover:bg-purple-700', noteLabel: 'หมายเหตุการซ่อม (ไม่บังคับ)' },
    return:   { title: 'คืนคลังทรัพย์สิน', btn: 'ยืนยันคืนคลัง', btnCls: 'bg-green-600 hover:bg-green-700', noteLabel: 'หมายเหตุ (ไม่บังคับ)' },
  }[type];

  const handle = async () => {
    setLoading(true);
    const statusMap = { approve: 'approved', reject: 'rejected', complete: 'completed', return: 'returned' };
    await onConfirm(request.id, statusMap[type], note.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 mb-1">{config.title}</h3>
        <p className="text-sm text-gray-500 mb-4">
          ทรัพย์สิน: <span className="font-medium text-gray-800">{request.asset_name}</span>
          {request.asset_code && <span className="text-gray-400"> · {request.asset_code}</span>}
        </p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">{config.noteLabel}</label>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="ระบุหมายเหตุ..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handle} disabled={loading}
            className={`flex-[2] py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${config.btnCls} disabled:opacity-50`}>
            {loading ? 'กำลังดำเนินการ...' : config.btn}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Detail Panel ───────────────────────────────────────────────────────────────
const DetailPanel = ({ request, isAdmin, onAction, onClose }) => {
  const s = STATUS[request.status] || STATUS.pending;
  const u = URGENCY[request.urgency] || URGENCY.normal;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">คำขอ #{request.id}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={18}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Status + Urgency */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={request.status}/>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${u.color}`}>
            <Zap size={10}/> {u.label}
          </span>
        </div>

        {/* Asset info */}
        <div className="bg-orange-50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-orange-500"/>
            <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">ทรัพย์สิน</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{request.asset_name}</p>
          {request.asset_code && <p className="text-xs text-gray-500 mt-0.5">{request.asset_code}</p>}
        </div>

        {/* Meta */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <User size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">ผู้แจ้งซ่อม</p>
              <p className="text-sm font-medium text-gray-800">{request.requested_by_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">วันที่แจ้ง</p>
              <p className="text-sm font-medium text-gray-800">{fmt(request.created_at)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">อาการ / ปัญหา</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.symptom || '—'}</p>
            </div>
          </div>
          {request.note && (
            <div className="flex items-start gap-3">
              <MessageSquare size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
              <div>
                <p className="text-xs text-gray-400">หมายเหตุเพิ่มเติม</p>
                <p className="text-sm text-gray-700">{request.note}</p>
              </div>
            </div>
          )}
          {request.admin_note && (
            <div className="flex items-start gap-3">
              <MessageSquare size={14} className="text-blue-400 mt-0.5 flex-shrink-0"/>
              <div>
                <p className="text-xs text-gray-400">หมายเหตุจากผู้ดูแล</p>
                <p className="text-sm text-gray-700">{request.admin_note}</p>
              </div>
            </div>
          )}
        </div>

        {/* Images */}
        {request.images?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Image size={13} className="text-gray-400"/>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">รูปภาพ ({request.images.length})</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {request.images.map((img, i) => (
                <a key={i} href={`/api${img}`} target="_blank" rel="noreferrer"
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 block">
                  <img src={`/api${img}`} alt={`repair-${i}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity"/>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons — admin only */}
      {isAdmin && (
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          {request.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => onAction('approve', request)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
                อนุมัติ
              </button>
              <button onClick={() => onAction('reject', request)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
                ปฏิเสธ
              </button>
            </div>
          )}
          {request.status === 'approved' && (
            <button onClick={() => onAction('complete', request)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors">
              บันทึกซ่อมเสร็จ
            </button>
          )}
          {request.status === 'completed' && (
            <button onClick={() => onAction('return', request)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">
              คืนคลังทรัพย์สิน
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RepairManagement() {
  const { user } = useAuth();
  const isAdmin = user?.roleName === 'admin' || user?.roleName === 'superadmin';

  const [requests, setRequests]     = useState([]);
  const [counts, setCounts]         = useState({ pending: 0, approved: 0, completed: 0, returned: 0, rejected: 0 });
  const [activeTab, setActiveTab]   = useState('all');
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = isAdmin
        ? await repairAPI.getAll(params)
        : await repairAPI.getMine(params);
      setRequests(res.data?.data || res.data || []);
    } catch {
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAdmin]);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await repairAPI.getCounts();
      setCounts(res.data);
    } catch {}
  }, [isAdmin]);

  useEffect(() => {
    fetchRequests();
    fetchCounts();
  }, [fetchRequests, fetchCounts]);

  const handleStatusUpdate = async (id, status, adminNote) => {
    try {
      await repairAPI.updateStatus(id, { status, admin_note: adminNote });
      showToast('อัปเดตสถานะสำเร็จ');
      setActionModal(null);
      if (selected?.id === id) setSelected(r => ({ ...r, status, admin_note: adminNote }));
      await fetchRequests();
      await fetchCounts();
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.asset_name?.toLowerCase().includes(q) ||
      r.asset_code?.toLowerCase().includes(q) ||
      r.requested_by_name?.toLowerCase().includes(q) ||
      r.symptom?.toLowerCase().includes(q)
    );
  });

  const statCards = [
    { key: 'pending',   label: 'รอดำเนินการ', color: 'text-yellow-600 bg-yellow-50',  icon: Clock },
    { key: 'approved',  label: 'อนุมัติแล้ว',  color: 'text-blue-600 bg-blue-50',     icon: CheckCircle2 },
    { key: 'completed', label: 'ซ่อมเสร็จ',    color: 'text-purple-600 bg-purple-50', icon: Wrench },
    { key: 'returned',  label: 'คืนคลังแล้ว',  color: 'text-green-600 bg-green-50',   icon: ArrowDownToLine },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Wrench size={20} className="text-orange-600"/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">การแจ้งซ่อมทรัพย์สิน</h1>
              <p className="text-sm text-gray-500">
                {isAdmin ? 'จัดการคำขอซ่อมทรัพย์สินทั้งหมด' : 'คำขอซ่อมของฉัน'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchRequests(); fetchCounts(); }}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <RefreshCw size={16}/>
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              <Plus size={16}/> แจ้งซ่อม
            </button>
          </div>
        </div>

        {/* Stat cards — admin only */}
        {isAdmin && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            {statCards.map(({ key, label, color, icon: Icon }) => (
              <button key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                  ${activeTab === key ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200 hover:border-gray-300'} bg-white`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={15}/>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 leading-none">{counts[key] ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all whitespace-nowrap
                  ${activeTab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
                {t.key !== 'all' && isAdmin && counts[t.key] > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                    ${t.key === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'}`}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-shrink-0 w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาทรัพย์สิน, อาการ..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"/>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table */}
        <div className={`flex flex-col flex-1 overflow-hidden transition-all ${selected ? 'border-r border-gray-200' : ''}`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <RefreshCw size={18} className="animate-spin mr-2"/> กำลังโหลด...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Wrench size={36} className="opacity-30"/>
              <p className="text-sm">ไม่มีคำขอซ่อม</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ทรัพย์สิน</th>
                    {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้แจ้ง</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ความเร่งด่วน</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">อาการ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">วันที่</th>
                    {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">การดำเนินการ</th>}
                    <th className="w-8"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => {
                    const urg = URGENCY[r.urgency] || URGENCY.normal;
                    return (
                      <tr key={r.id}
                        onClick={() => setSelected(r)}
                        className={`cursor-pointer hover:bg-orange-50/40 transition-colors
                          ${selected?.id === r.id ? 'bg-orange-50 border-l-2 border-l-orange-500' : 'bg-white border-l-2 border-l-transparent'}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 truncate max-w-[160px]">{r.asset_name}</p>
                          <p className="text-xs text-gray-400">{r.asset_code || '—'}</p>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.requested_by_name || '—'}</td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${urg.color}`}>
                            {r.urgency === 'urgent' && <Zap size={10}/>}
                            {urg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                          <p className="truncate">{r.symptom || '—'}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={r.status}/></td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(r.created_at)}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {r.status === 'pending' && (
                                <>
                                  <button onClick={() => setActionModal({ type: 'approve', request: r })}
                                    className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                                    อนุมัติ
                                  </button>
                                  <button onClick={() => setActionModal({ type: 'reject', request: r })}
                                    className="px-2.5 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
                                    ปฏิเสธ
                                  </button>
                                </>
                              )}
                              {r.status === 'approved' && (
                                <button onClick={() => setActionModal({ type: 'complete', request: r })}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
                                  ซ่อมเสร็จ
                                </button>
                              )}
                              {r.status === 'completed' && (
                                <button onClick={() => setActionModal({ type: 'return', request: r })}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                                  คืนคลัง
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-2 py-3">
                          <ChevronRight size={14} className="text-gray-300"/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 bg-white overflow-hidden flex flex-col">
            <DetailPanel
              request={selected}
              isAdmin={isAdmin}
              onAction={(type, req) => setActionModal({ type, request: req })}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      {/* Create modal — pick any available asset */}
      {showCreateModal && (
        <RepairRequestModal
          asset={null}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { fetchRequests(); fetchCounts(); showToast('ส่งคำขอซ่อมสำเร็จ'); }}
        />
      )}

      {actionModal && (
        <ActionModal
          type={actionModal.type}
          request={actionModal.request}
          onConfirm={handleStatusUpdate}
          onClose={() => setActionModal(null)}
        />
      )}
    </div>
  );
}
