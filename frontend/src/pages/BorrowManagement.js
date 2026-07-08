import React, { useState, useEffect, useCallback } from 'react';
import { borrowAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BorrowRequestModal from '../components/BorrowRequestModal';
import {
  BookOpen, Plus, Search, X, ChevronRight,
  Clock, CheckCircle2, ArrowDownToLine, XCircle,
  Package, Calendar, User, MessageSquare, AlertTriangle,
  RefreshCw,
} from 'lucide-react';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS = {
  pending:  { label: 'รอดำเนินการ', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', icon: Clock },
  approved: { label: 'อนุมัติแล้ว',  color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400',   icon: CheckCircle2 },
  returned: { label: 'คืนแล้ว',      color: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  icon: ArrowDownToLine },
  rejected: { label: 'ปฏิเสธ',       color: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    icon: XCircle },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {s.label}
    </span>
  );
};

const TABS = [
  { key: 'all',      label: 'ทั้งหมด' },
  { key: 'pending',  label: 'รอดำเนินการ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'returned', label: 'คืนแล้ว' },
  { key: 'rejected', label: 'ปฏิเสธ' },
];

const fmt = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Action confirm modal ───────────────────────────────────────────────────────
const ActionModal = ({ type, request, onConfirm, onClose }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const config = {
    approve: { title: 'อนุมัติคำขอยืม', btn: 'อนุมัติ', btnCls: 'bg-blue-600 hover:bg-blue-700', noteLabel: 'หมายเหตุ (ไม่บังคับ)' },
    reject:  { title: 'ปฏิเสธคำขอยืม',  btn: 'ปฏิเสธ',  btnCls: 'bg-red-600 hover:bg-red-700',  noteLabel: 'เหตุผลที่ปฏิเสธ (ไม่บังคับ)' },
    return:  { title: 'บันทึกการคืน',    btn: 'ยืนยันคืน', btnCls: 'bg-green-600 hover:bg-green-700', noteLabel: 'หมายเหตุ (ไม่บังคับ)' },
  }[type];

  const handle = async () => {
    setLoading(true);
    const statusMap = { approve: 'approved', reject: 'rejected', return: 'returned' };
    await onConfirm(request.id, statusMap[type], note.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 mb-1">{config.title}</h3>
        <p className="text-sm text-gray-500 mb-4">
          ผู้ยืม: <span className="font-medium text-gray-800">{request.borrower_name}</span>
          {' · '}{request.assets?.length || 0} รายการ
        </p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">{config.noteLabel}</label>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="ระบุหมายเหตุ..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
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
  const StatusIcon = s.icon;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">คำขอ #{request.id}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={18}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Status */}
        <div className="flex items-center gap-2">
          <StatusIcon size={16} className={`text-${s.dot.replace('bg-', '')}`}/>
          <StatusBadge status={request.status}/>
        </div>

        {/* Meta */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <User size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">ผู้ยืม</p>
              <p className="text-sm font-medium text-gray-800">{request.borrower_name}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">ผู้ส่งคำขอ</p>
              <p className="text-sm font-medium text-gray-800">{request.requested_by_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">กำหนดคืน</p>
              <p className="text-sm font-medium text-gray-800">{fmt(request.expected_return)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-xs text-gray-400">วันที่ส่งคำขอ</p>
              <p className="text-sm font-medium text-gray-800">{fmt(request.created_at)}</p>
            </div>
          </div>
          {request.note && (
            <div className="flex items-start gap-3">
              <MessageSquare size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
              <div>
                <p className="text-xs text-gray-400">หมายเหตุ</p>
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

        {/* Asset list */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ทรัพย์สิน ({request.assets?.length || 0} รายการ)
          </p>
          <div className="space-y-2">
            {(request.assets || []).map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <Package size={14} className="text-gray-400 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.code || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
            <button onClick={() => onAction('return', request)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">
              บันทึกการคืน
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BorrowManagement() {
  const { user, can } = useAuth();
  const isAdmin = user?.roleName === 'admin' || user?.roleName === 'superadmin';

  const [requests, setRequests]         = useState([]);
  const [counts, setCounts]             = useState({ pending: 0, approved: 0, returned: 0, rejected: 0 });
  const [activeTab, setActiveTab]       = useState('all');
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionModal, setActionModal]   = useState(null); // { type, request }
  const [loading, setLoading]           = useState(false);
  const [toast, setToast]               = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = isAdmin
        ? await borrowAPI.getAll(params)
        : await borrowAPI.getMine(params);
      setRequests(res.data?.data || []);
    } catch {
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAdmin]);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await borrowAPI.getCounts();
      setCounts(res.data);
    } catch {}
  }, [isAdmin]);

  useEffect(() => {
    fetchRequests();
    fetchCounts();
  }, [fetchRequests, fetchCounts]);

  const handleStatusUpdate = async (id, status, adminNote) => {
    try {
      await borrowAPI.updateStatus(id, { status, admin_note: adminNote });
      showToast('อัปเดตสถานะสำเร็จ');
      setActionModal(null);
      // refresh panel if open
      if (selected?.id === id) setSelected(r => ({ ...r, status, admin_note: adminNote }));
      await fetchRequests();
      await fetchCounts();
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  // Client-side filter
  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.borrower_name?.toLowerCase().includes(q) ||
      r.requested_by_name?.toLowerCase().includes(q) ||
      (r.assets || []).some(a =>
        a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q)
      )
    );
  });

  const statCards = [
    { key: 'pending',  label: 'รอดำเนินการ', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
    { key: 'approved', label: 'อนุมัติแล้ว',  color: 'text-blue-600 bg-blue-50',    icon: CheckCircle2 },
    { key: 'returned', label: 'คืนแล้ว',      color: 'text-green-600 bg-green-50',  icon: ArrowDownToLine },
    { key: 'rejected', label: 'ปฏิเสธ',       color: 'text-red-600 bg-red-50',      icon: XCircle },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <BookOpen size={20} className="text-blue-600"/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">การยืมทรัพย์สิน</h1>
              <p className="text-sm text-gray-500">
                {isAdmin ? 'จัดการคำขอยืมทรัพย์สินทั้งหมด' : 'คำขอยืมของฉัน'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchRequests(); fetchCounts(); }}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <RefreshCw size={16}/>
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
              <Plus size={16}/> ยืมทรัพย์สิน
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
                  ${activeTab === key ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'} bg-white`}>
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
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all
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
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อผู้ยืม, ทรัพย์สิน..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
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
              <BookOpen size={36} className="opacity-30"/>
              <p className="text-sm">ไม่มีคำขอยืม</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้ยืม</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">รายการทรัพย์สิน</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">กำหนดคืน</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">วันที่</th>
                    {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">การดำเนินการ</th>}
                    <th className="w-8"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => (
                    <tr key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer hover:bg-blue-50/50 transition-colors
                        ${selected?.id === r.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'bg-white border-l-2 border-l-transparent'}`}>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{r.borrower_name}</p>
                          <p className="text-xs text-gray-400">{r.requested_by_name || '—'}</p>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Package size={13} className="text-gray-400 flex-shrink-0"/>
                          <span className="text-gray-700 truncate max-w-[180px]">
                            {(r.assets || []).map(a => a.name).join(', ') || '—'}
                          </span>
                          {(r.assets?.length || 0) > 1 && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {r.assets.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.expected_return)}</td>
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
                              <button onClick={() => setActionModal({ type: 'return', request: r })}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                                คืนแล้ว
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <ChevronRight size={14} className="text-gray-300"/>
                      </td>
                    </tr>
                  ))}
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

      {/* Modals */}
      {showCreateModal && (
        <BorrowRequestModal
          assets={[]}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { fetchRequests(); fetchCounts(); showToast('ส่งคำขอยืมสำเร็จ'); }}
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
