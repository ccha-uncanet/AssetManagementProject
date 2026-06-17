import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import { exportPDF } from '../../utils/exportPDF';
import {
  ScrollText, RefreshCw, Search, Filter, Download,
  FileText, Loader2, AlertTriangle, CheckCircle2,
  ArrowUpFromLine, ArrowDownToLine, Wrench, X,
  User, LogIn, LogOut, UserPlus, UserX, UserCog,
  ShieldCheck, Package, ChevronDown,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Asset transaction config
// ─────────────────────────────────────────────────────────────────────────────
const ASSET_ACTION = {
  1: { label: 'คืนคลัง',      color: 'bg-green-100 text-green-700',   icon: ArrowDownToLine },
  2: { label: 'ยืม',          color: 'bg-red-100 text-red-700',       icon: ArrowUpFromLine },
  3: { label: 'ส่งซ่อม',      color: 'bg-orange-100 text-orange-700', icon: Wrench          },
  4: { label: 'รอดำเนินการ',  color: 'bg-yellow-100 text-yellow-700', icon: ChevronDown     },
  5: { label: 'ปฏิเสธ',       color: 'bg-gray-100 text-gray-600',     icon: X               },
  6: { label: 'ซ่อมเสร็จ',    color: 'bg-teal-100 text-teal-700',     icon: CheckCircle2    },
};

// User log action config
const USER_ACTION = {
  LOGIN:       { label: 'เข้าสู่ระบบ',    color: 'bg-blue-100 text-blue-700',     icon: LogIn      },
  LOGOUT:      { label: 'ออกจากระบบ',     color: 'bg-gray-100 text-gray-600',     icon: LogOut     },
  REGISTER:    { label: 'สมัครสมาชิก',    color: 'bg-purple-100 text-purple-700', icon: UserPlus   },
  UPDATE_USER: { label: 'แก้ไขผู้ใช้',    color: 'bg-yellow-100 text-yellow-700', icon: UserCog    },
  DELETE_USER: { label: 'ลบผู้ใช้',       color: 'bg-red-100 text-red-700',       icon: UserX      },
  CHANGE_ROLE: { label: 'เปลี่ยน Role',   color: 'bg-indigo-100 text-indigo-700', icon: ShieldCheck},
  BORROW:      { label: 'ยืมทรัพย์สิน',  color: 'bg-red-100 text-red-700',       icon: ArrowUpFromLine },
  REPAIR:      { label: 'ส่งซ่อม',        color: 'bg-orange-100 text-orange-700', icon: Wrench     },
  INVENTORY:   { label: 'ตรวจนับ',        color: 'bg-teal-100 text-teal-700',     icon: Package    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────────────────────────────────────
const AssetBadge = ({ action }) => {
  const a = ASSET_ACTION[action];
  if (!a) return <span className="text-gray-400 text-xs">-</span>;
  const Icon = a.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${a.color}`}>
      <Icon size={11} /> {a.label}
    </span>
  );
};

const UserBadge = ({ action }) => {
  const a = USER_ACTION[action] || { label: action, color: 'bg-gray-100 text-gray-600', icon: User };
  const Icon = a.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${a.color}`}>
      <Icon size={11} /> {a.label}
    </span>
  );
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
      ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
      {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      {toast.message}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar (shared)
// ─────────────────────────────────────────────────────────────────────────────
const FilterBar = ({
  searchTerm, setSearchTerm, searchPlaceholder,
  actionFilter, setActionFilter, actionOptions,
  dateFrom, setDateFrom, dateTo, setDateTo,
  showFilters, setShowFilters, hasFilter, clearFilters,
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={() => setShowFilters(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
          ${showFilters || hasFilter ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
      >
        <Filter size={14} /> ตัวกรอง
        {hasFilter && <span className="w-4 h-4 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">!</span>}
      </button>
      {hasFilter && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <X size={13} /> ล้าง
        </button>
      )}
    </div>

    {showFilters && (
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-1.5">
          {actionOptions.map(f => (
            <button
              key={f.value}
              onClick={() => setActionFilter(f.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors
                ${actionFilter === f.value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-gray-500">ตั้งแต่</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">ถึง</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — ประวัติทรัพย์สิน
// ─────────────────────────────────────────────────────────────────────────────
const AssetLogsTab = ({ showToast }) => {
  const [logs, setLogs]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm]     = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showFilters, setShowFilters]   = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/logs');
      setLogs(res.data);
    } catch { showToast('ไม่สามารถดึงข้อมูลประวัติทรัพย์สินได้', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log => {
    const matchAction = actionFilter === 'all' || log.Action === parseInt(actionFilter);
    const matchSearch = !searchTerm || [log.AssetName, log.InvNo, log.UserName, log.Username, log.Notes]
      .some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()));
    const logDate  = new Date(log.TransactionDate);
    const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchTo   = !dateTo   || logDate <= new Date(dateTo + 'T23:59:59');
    return matchAction && matchSearch && matchFrom && matchTo;
  });

  const hasFilter = actionFilter !== 'all' || searchTerm || dateFrom || dateTo;

  const clearFilters = () => { setActionFilter('all'); setSearchTerm(''); setDateFrom(''); setDateTo(''); };

  const handleExportExcel = () => {
    const data = filtered.map((log, i) => ({
      'ลำดับ': i + 1,
      'วันที่/เวลา': new Date(log.TransactionDate).toLocaleString('th-TH'),
      'ทรัพย์สิน': log.AssetName || '-',
      'InvNo': log.InvNo || '-',
      'ผู้ดำเนินการ': log.UserName || log.Username || '-',
      'การกระทำ': ASSET_ACTION[log.Action]?.label || '-',
      'หมายเหตุ': log.Notes || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Logs');
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, `asset_logs_${new Date().toLocaleDateString('th-TH')}.xlsx`);
  };

  const handleExportPDF = () => {
    exportPDF({
      title: 'ประวัติการเคลื่อนไหวทรัพย์สิน',
      filename: 'asset_logs',
      orientation: 'landscape',
      columns: ['#', 'วันที่/เวลา', 'ทรัพย์สิน', 'InvNo', 'ผู้ดำเนินการ', 'การกระทำ', 'หมายเหตุ'],
      rows: filtered.map((log, i) => [
        i + 1,
        new Date(log.TransactionDate).toLocaleString('th-TH'),
        log.AssetName || '-',
        log.InvNo || '-',
        log.UserName || log.Username || '-',
        ASSET_ACTION[log.Action]?.label || '-',
        log.Notes || '-',
      ]),
    });
  };

  const countAction = a => logs.filter(l => l.Action === a).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'ทั้งหมด',  value: logs.length,    color: 'bg-gray-50 border-gray-200',     text: 'text-gray-800'   },
          { label: 'ยืม',      value: countAction(2),  color: 'bg-red-50 border-red-200',       text: 'text-red-700'    },
          { label: 'คืนคลัง',  value: countAction(1),  color: 'bg-green-50 border-green-200',   text: 'text-green-700'  },
          { label: 'ส่งซ่อม',  value: countAction(3),  color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold tabular-nums ${s.text}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">แสดง {filtered.length} / {logs.length} รายการ</p>
        <div className="flex gap-2">
          <button onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
            <Download size={14} /> Excel
          </button>
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={fetchLogs} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Filter */}
      <FilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        searchPlaceholder="ค้นหา ชื่อทรัพย์สิน, InvNo, ผู้ดำเนินการ, หมายเหตุ..."
        actionFilter={actionFilter} setActionFilter={setActionFilter}
        actionOptions={[
          { value: 'all', label: 'ทุกประเภท'    },
          { value: '2',   label: 'ยืม'           },
          { value: '1',   label: 'คืนคลัง'       },
          { value: '3',   label: 'ส่งซ่อม'       },
          { value: '4',   label: 'รอดำเนินการ'   },
          { value: '5',   label: 'ปฏิเสธ'        },
          { value: '6',   label: 'ซ่อมเสร็จ'     },
        ]}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        showFilters={showFilters} setShowFilters={setShowFilters}
        hasFilter={hasFilter} clearFilters={clearFilters}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['#', 'วันที่/เวลา', 'ทรัพย์สิน', 'InvNo', 'ผู้ดำเนินการ', 'การกระทำ', 'หมายเหตุ'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log, i) => (
                  <tr key={log.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 tabular-nums text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.TransactionDate).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.AssetName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{log.InvNo || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.UserName || log.Username || '-'}</td>
                    <td className="px-4 py-3"><AssetBadge action={log.Action} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={log.Notes}>
                      {log.Notes || '-'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center">
                      <Package size={32} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-400 text-sm">
                        {hasFilter ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข' : 'ยังไม่มีประวัติทรัพย์สิน'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — ประวัติผู้ใช้
// ─────────────────────────────────────────────────────────────────────────────
const UserLogsTab = ({ showToast }) => {
  const [logs, setLogs]                 = useState([]);
  const [tableExists, setTableExists]   = useState(true);
  const [loading, setLoading]           = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm]     = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showFilters, setShowFilters]   = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/userlogs');
      setLogs(res.data.logs || []);
      setTableExists(res.data.tableExists !== false);
    } catch { showToast('ไม่สามารถดึงข้อมูลประวัติผู้ใช้ได้', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log => {
    const matchAction = actionFilter === 'all' || log.Action === actionFilter;
    const matchSearch = !searchTerm || [log.Username, log.FullName, log.Detail, log.TargetUsername, log.IpAddress]
      .some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()));
    const logDate   = new Date(log.CreatedAt);
    const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchTo   = !dateTo   || logDate <= new Date(dateTo + 'T23:59:59');
    return matchAction && matchSearch && matchFrom && matchTo;
  });

  const hasFilter = actionFilter !== 'all' || searchTerm || dateFrom || dateTo;
  const clearFilters = () => { setActionFilter('all'); setSearchTerm(''); setDateFrom(''); setDateTo(''); };

  const countAction = a => logs.filter(l => l.Action === a).length;

  const handleExportExcel = () => {
    const data = filtered.map((log, i) => ({
      'ลำดับ': i + 1,
      'วันที่/เวลา': new Date(log.CreatedAt).toLocaleString('th-TH'),
      'ผู้ดำเนินการ': log.FullName || log.Username || '-',
      'Username': log.Username || '-',
      'การกระทำ': USER_ACTION[log.Action]?.label || log.Action || '-',
      'รายละเอียด': log.Detail || '-',
      'IP Address': log.IpAddress || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'User Logs');
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, `user_logs_${new Date().toLocaleDateString('th-TH')}.xlsx`);
  };

  const handleExportPDF = () => {
    exportPDF({
      title: 'ประวัติการกระทำของผู้ใช้',
      filename: 'user_logs',
      orientation: 'landscape',
      columns: ['#', 'วันที่/เวลา', 'ผู้ดำเนินการ', 'Username', 'การกระทำ', 'รายละเอียด', 'IP'],
      rows: filtered.map((log, i) => [
        i + 1,
        new Date(log.CreatedAt).toLocaleString('th-TH'),
        log.FullName || log.Username || '-',
        log.Username || '-',
        USER_ACTION[log.Action]?.label || log.Action || '-',
        log.Detail || '-',
        log.IpAddress || '-',
      ]),
    });
  };

  // ตาราง UserLogs ยังไม่ถูกสร้าง (ยังไม่มีการ login ครั้งแรกหลังติดตั้ง middleware)
  if (!loading && !tableExists) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-yellow-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-800 mb-2">ยังไม่มีข้อมูลประวัติผู้ใช้</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          ระบบจะเริ่มบันทึกประวัติผู้ใช้โดยอัตโนมัติหลังจากติดตั้ง middleware และมีการใช้งานระบบครั้งแรก
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'ทั้งหมด',      value: logs.length,             color: 'bg-gray-50 border-gray-200',     text: 'text-gray-800'   },
          { label: 'Login',         value: countAction('LOGIN'),     color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700'   },
          { label: 'จัดการผู้ใช้',  value: countAction('UPDATE_USER') + countAction('DELETE_USER') + countAction('CHANGE_ROLE'),
            color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
          { label: 'ยืม/ซ่อม',     value: countAction('BORROW') + countAction('REPAIR'),
            color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold tabular-nums ${s.text}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">แสดง {filtered.length} / {logs.length} รายการ</p>
        <div className="flex gap-2">
          <button onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
            <Download size={14} /> Excel
          </button>
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={fetchLogs} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Filter */}
      <FilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        searchPlaceholder="ค้นหา ชื่อผู้ใช้, Username, รายละเอียด, IP..."
        actionFilter={actionFilter} setActionFilter={setActionFilter}
        actionOptions={[
          { value: 'all',         label: 'ทุกประเภท'    },
          { value: 'LOGIN',       label: 'เข้าสู่ระบบ'   },
          { value: 'REGISTER',    label: 'สมัครสมาชิก'  },
          { value: 'UPDATE_USER', label: 'แก้ไขผู้ใช้'   },
          { value: 'DELETE_USER', label: 'ลบผู้ใช้'      },
          { value: 'CHANGE_ROLE', label: 'เปลี่ยน Role'  },
          { value: 'BORROW',      label: 'ยืม'           },
          { value: 'REPAIR',      label: 'ส่งซ่อม'       },
        ]}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        showFilters={showFilters} setShowFilters={setShowFilters}
        hasFilter={hasFilter} clearFilters={clearFilters}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['#', 'วันที่/เวลา', 'ผู้ดำเนินการ', 'Username', 'การกระทำ', 'รายละเอียด', 'IP Address'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log, i) => (
                  <tr key={log.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 tabular-nums text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.CreatedAt).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <User size={13} className="text-gray-500" />
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{log.FullName || log.Username || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{log.Username || '-'}</span>
                    </td>
                    <td className="px-4 py-3"><UserBadge action={log.Action} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={log.Detail}>
                      {log.Detail || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">{log.IpAddress || '-'}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center">
                      <User size={32} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-400 text-sm">
                        {hasFilter ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข' : 'ยังไม่มีประวัติผู้ใช้'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main — SystemLogs
// ─────────────────────────────────────────────────────────────────────────────
const SystemLogs = () => {
  const [activeTab, setActiveTab] = useState('assets');
  const [toast, setToast]         = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const tabs = [
    { id: 'assets', label: 'ประวัติทรัพย์สิน', icon: Package,    desc: 'ยืม / คืน / ส่งซ่อม' },
    { id: 'users',  label: 'ประวัติผู้ใช้',    icon: User,       desc: 'Login / จัดการบัญชี' },
  ];

  return (
    <div className="space-y-5">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText size={24} className="text-gray-600" /> System Logs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">ประวัติการใช้งานระบบทั้งหมด</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              <span className={`text-xs ${isActive ? 'text-gray-400' : 'text-gray-400'} hidden sm:inline`}>
                · {tab.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'assets'
        ? <AssetLogsTab showToast={showToast} />
        : <UserLogsTab  showToast={showToast} />
      }
    </div>
  );
};

export default SystemLogs;