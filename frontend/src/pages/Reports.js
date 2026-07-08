import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { assetAPI, borrowAPI, repairAPI, inventoryAPI } from '../services/api';
import {
  FileSpreadsheet, FileText, RefreshCw, BarChart2,
  Package, BookOpen, Wrench, ClipboardList,
  CheckCircle2, AlertTriangle, LayoutDashboard,
  PieChart as PieIcon,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';

// ── Status helpers ─────────────────────────────────────────────────────────────
const ASSET_STATUS = { 1: 'ว่าง / ปกติ', 2: 'ถูกยืม', 3: 'ส่งซ่อม' };
const ASSET_STATUS_EN = { 1: 'Available', 2: 'Borrowed', 3: 'Repairing' };
const BORROW_STATUS_TH = { pending: 'รอดำเนินการ', approved: 'อนุมัติแล้ว', returned: 'คืนแล้ว', rejected: 'ปฏิเสธ' };
const REPAIR_STATUS_TH = { pending: 'รอดำเนินการ', approved: 'อนุมัติแล้ว', completed: 'ซ่อมเสร็จ', returned: 'คืนคลังแล้ว', rejected: 'ปฏิเสธ' };
const REPAIR_STATUS_EN = { pending: 'Pending', approved: 'Approved', completed: 'Completed', returned: 'Returned', rejected: 'Rejected' };
const BORROW_STATUS_EN = { pending: 'Pending', approved: 'Approved', returned: 'Returned', rejected: 'Rejected' };

const fmt = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtNum = (n) => n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
const fmtPrice = (n) => n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

// Group array by key → [{ name, count }] sorted desc
const groupByCount = (arr, key) => {
  const map = {};
  arr.forEach(item => {
    const k = item[key] || 'ไม่ระบุ';
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
};

// Group and sum numeric field
const groupBySum = (arr, groupKey, sumKey) => {
  const map = {};
  arr.forEach(item => {
    const k = item[groupKey] || 'ไม่ระบุ';
    map[k] = (map[k] || 0) + (Number(item[sumKey]) || 0);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));
};

// Group by month from date field → [{ month: 'Jan 25', count }]
const groupByMonth = (arr, dateKey) => {
  const map = {};
  arr.forEach(item => {
    const d = new Date(item[dateKey]);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!map[key]) map[key] = { month: label, count: 0, key };
    map[key].count++;
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
};

// ── Small reusable pieces ──────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className={`flex items-center gap-3 p-4 rounded-xl border bg-white`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
      <Icon size={18}/>
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{children}</h2>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5">
    <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>
    {children}
  </div>
);

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SimpleBarChart = ({ data, dataKey, nameKey = 'name', color = '#3b82f6' }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
      <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0}/>
      <YAxis tick={{ fontSize: 11 }} allowDecimals={false}/>
      <Tooltip/>
      <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]}/>
    </BarChart>
  </ResponsiveContainer>
);

const SimpleLineChart = ({ data, dataKey, nameKey = 'month' }) => (
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
      <XAxis dataKey={nameKey} tick={{ fontSize: 11 }}/>
      <YAxis tick={{ fontSize: 11 }} allowDecimals={false}/>
      <Tooltip/>
      <Line type="monotone" dataKey={dataKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }}/>
    </LineChart>
  </ResponsiveContainer>
);

// Compact table for report sections
const ReportTable = ({ cols, rows, emptyMsg = 'ไม่มีข้อมูล' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-100">
        <tr>
          {cols.map(c => (
            <th key={c.key} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.length === 0 ? (
          <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-gray-400 text-sm">{emptyMsg}</td></tr>
        ) : rows.map((row, i) => (
          <tr key={i} className="hover:bg-gray-50/50">
            {cols.map(c => (
              <td key={c.key} className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row[c.key] ?? '—'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── PDF export helpers ─────────────────────────────────────────────────────────
const buildPdf = (title, tables) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, 23);

  let y = 30;
  tables.forEach(({ heading, head, body }) => {
    if (heading) {
      doc.setFontSize(11);
      doc.text(heading, 14, y);
      y += 5;
    }
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  });

  return doc;
};

// ── Main page ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',  label: 'ภาพรวม',    icon: LayoutDashboard },
  { key: 'assets',    label: 'ทรัพย์สิน', icon: Package },
  { key: 'borrows',   label: 'การยืม',    icon: BookOpen },
  { key: 'repairs',   label: 'การซ่อม',   icon: Wrench },
  { key: 'inventory', label: 'ตรวจนับ',   icon: ClipboardList },
];

const DONUT_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast]         = useState(null);

  // ── Asset data ────────────────────────────────────────────────────────────
  const [assets, setAssets]           = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // ── Borrow data ───────────────────────────────────────────────────────────
  const [borrows, setBorrows]         = useState([]);
  const [borrowCounts, setBorrowCounts] = useState({});
  const [loadingBorrows, setLoadingBorrows] = useState(false);

  // ── Repair data ───────────────────────────────────────────────────────────
  const [repairs, setRepairs]         = useState([]);
  const [repairCounts, setRepairCounts] = useState({});
  const [loadingRepairs, setLoadingRepairs] = useState(false);

  // ── Inventory data ────────────────────────────────────────────────────────
  const [sessions, setSessions]       = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAssets = useCallback(async () => {
    if (assets.length) return;
    setLoadingAssets(true);
    try { const r = await assetAPI.getAll(); setAssets(r.data || []); }
    catch { showToast('โหลดข้อมูลทรัพย์สินไม่สำเร็จ', 'error'); }
    finally { setLoadingAssets(false); }
  }, [assets.length]);

  const fetchBorrows = useCallback(async () => {
    if (borrows.length) return;
    setLoadingBorrows(true);
    try {
      const [rList, rCnt] = await Promise.all([borrowAPI.getAll(), borrowAPI.getCounts()]);
      setBorrows(rList.data?.data || rList.data || []);
      setBorrowCounts(rCnt.data || {});
    } catch { showToast('โหลดข้อมูลการยืมไม่สำเร็จ', 'error'); }
    finally { setLoadingBorrows(false); }
  }, [borrows.length]);

  const fetchRepairs = useCallback(async () => {
    if (repairs.length) return;
    setLoadingRepairs(true);
    try {
      const [rList, rCnt] = await Promise.all([repairAPI.getAll(), repairAPI.getCounts()]);
      setRepairs(rList.data?.data || rList.data || []);
      setRepairCounts(rCnt.data || {});
    } catch { showToast('โหลดข้อมูลการซ่อมไม่สำเร็จ', 'error'); }
    finally { setLoadingRepairs(false); }
  }, [repairs.length]);

  const fetchInventory = useCallback(async () => {
    if (sessions.length) return;
    setLoadingInventory(true);
    try { const r = await inventoryAPI.getSessions(); setSessions(r.data || []); }
    catch { showToast('โหลดข้อมูลตรวจนับไม่สำเร็จ', 'error'); }
    finally { setLoadingInventory(false); }
  }, [sessions.length]);

  // Lazy-load per tab
  useEffect(() => {
    if (activeTab === 'overview')  { fetchAssets(); fetchBorrows(); fetchRepairs(); }
    if (activeTab === 'assets')    fetchAssets();
    if (activeTab === 'borrows')   fetchBorrows();
    if (activeTab === 'repairs')   fetchRepairs();
    if (activeTab === 'inventory') fetchInventory();
  }, [activeTab, fetchAssets, fetchBorrows, fetchRepairs, fetchInventory]);

  const handleRefresh = () => {
    if (activeTab === 'overview')  { setAssets([]); setBorrows([]); setRepairs([]); fetchAssets(); fetchBorrows(); fetchRepairs(); }
    if (activeTab === 'assets')    { setAssets([]);   fetchAssets(); }
    if (activeTab === 'borrows')   { setBorrows([]);  fetchBorrows(); }
    if (activeTab === 'repairs')   { setRepairs([]);  fetchRepairs(); }
    if (activeTab === 'inventory') { setSessions([]); fetchInventory(); }
  };

  // ── Excel export (all sheets) ──────────────────────────────────────────────
  const exportExcel = async () => {
    // Ensure all data loaded
    const [rA, rB, rR, rS] = await Promise.all([
      assets.length   ? { data: assets }   : assetAPI.getAll(),
      borrows.length  ? { data: { data: borrows } } : borrowAPI.getAll(),
      repairs.length  ? { data: { data: repairs } } : repairAPI.getAll(),
      sessions.length ? { data: sessions } : inventoryAPI.getSessions(),
    ]);

    const allAssets   = rA.data || [];
    const allBorrows  = rB.data?.data || rB.data || [];
    const allRepairs  = rR.data?.data || rR.data || [];
    const allSessions = rS.data || [];

    const wb = XLSX.utils.book_new();

    // Sheet 1 — Assets
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      allAssets.map(a => ({
        'รหัส (InvNo)':  a.InvNo || '',
        'ชื่อทรัพย์สิน': a.Name || '',
        'Serial No':    a.SerialNumber || '',
        'หมวดหมู่':      a.Category || '',
        'สถานที่':       a.Location || '',
        'สถานะ':         ASSET_STATUS[a.Status] || '',
        'ราคา (บาท)':   a.PurchasePrice != null ? Number(a.PurchasePrice) : '',
        'วันที่ซื้อ':    a.PurchaseDate ? new Date(a.PurchaseDate).toLocaleDateString('th-TH') : '',
      }))
    ), 'ทรัพย์สิน');

    // Sheet 2 — Borrows
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      allBorrows.map(b => ({
        'ผู้ยืม':       b.borrower_name || '',
        'ผู้ส่งคำขอ':  b.requested_by_name || '',
        'ทรัพย์สิน':   (b.assets || []).map(a => a.name).join(', '),
        'กำหนดคืน':    b.expected_return ? new Date(b.expected_return).toLocaleDateString('th-TH') : '',
        'สถานะ':        BORROW_STATUS_TH[b.status] || b.status || '',
        'วันที่ขอยืม':  b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH') : '',
        'หมายเหตุ':     b.note || '',
      }))
    ), 'การยืม');

    // Sheet 3 — Repairs
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      allRepairs.map(r => ({
        'ทรัพย์สิน':     r.asset_name || '',
        'รหัส':          r.asset_code || '',
        'ผู้แจ้งซ่อม':  r.requested_by_name || '',
        'ความเร่งด่วน': r.urgency === 'urgent' ? 'เร่งด่วน' : 'ปกติ',
        'อาการ':         r.symptom || '',
        'สถานะ':         REPAIR_STATUS_TH[r.status] || r.status || '',
        'วันที่แจ้ง':    r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '',
      }))
    ), 'การซ่อม');

    // Sheet 4 — Inventory sessions
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      allSessions.map(s => ({
        'ชื่อรอบ':     s.Name || s.name || '',
        'สถานะ':       s.Status || s.status || '',
        'วันที่เปิด':  s.CreatedAt || s.created_at ? new Date(s.CreatedAt || s.created_at).toLocaleDateString('th-TH') : '',
        'วันที่ปิด':   s.ClosedAt || s.closed_at ? new Date(s.ClosedAt || s.closed_at).toLocaleDateString('th-TH') : '',
      }))
    ), 'ตรวจนับ');

    XLSX.writeFile(wb, `รายงาน_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('ดาวน์โหลด Excel สำเร็จ');
  };

  // ── PDF export (current tab) ───────────────────────────────────────────────
  const exportPDF = () => {
    let doc;
    if (activeTab === 'assets') {
      doc = buildPdf('Asset Report', [
        {
          heading: 'Assets List',
          head: ['InvNo', 'Name', 'Category', 'Location', 'Status', 'Price (THB)'],
          body: assets.map(a => [
            a.InvNo || '', a.Name || '', a.Category || '', a.Location || '',
            ASSET_STATUS_EN[a.Status] || '', a.PurchasePrice != null ? Number(a.PurchasePrice).toLocaleString() : '',
          ]),
        },
      ]);
    } else if (activeTab === 'borrows') {
      doc = buildPdf('Borrow Requests Report', [
        {
          heading: 'Borrow Requests',
          head: ['Borrower', 'Assets', 'Due Date', 'Status', 'Requested On'],
          body: borrows.map(b => [
            b.borrower_name || '',
            (b.assets || []).map(a => a.code || a.name).join(', '),
            b.expected_return ? new Date(b.expected_return).toLocaleDateString('en-GB') : '',
            BORROW_STATUS_EN[b.status] || b.status || '',
            b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB') : '',
          ]),
        },
      ]);
    } else if (activeTab === 'repairs') {
      doc = buildPdf('Repair Requests Report', [
        {
          heading: 'Repair Requests',
          head: ['Asset Code', 'Asset Name', 'Requester', 'Urgency', 'Status', 'Date'],
          body: repairs.map(r => [
            r.asset_code || '', r.asset_name || '', r.requested_by_name || '',
            r.urgency === 'urgent' ? 'Urgent' : 'Normal',
            REPAIR_STATUS_EN[r.status] || r.status || '',
            r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
          ]),
        },
      ]);
    } else {
      doc = buildPdf('Inventory Sessions Report', [
        {
          heading: 'Inventory Sessions',
          head: ['Name', 'Status', 'Created', 'Closed'],
          body: sessions.map(s => [
            s.Name || s.name || '',
            s.Status || s.status || '',
            s.CreatedAt || s.created_at ? new Date(s.CreatedAt || s.created_at).toLocaleDateString('en-GB') : '',
            s.ClosedAt || s.closed_at ? new Date(s.ClosedAt || s.closed_at).toLocaleDateString('en-GB') : '',
          ]),
        },
      ]);
    }
    doc.save(`report-${activeTab}-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('ดาวน์โหลด PDF สำเร็จ');
  };

  // ── Derived chart data ─────────────────────────────────────────────────────
  const assetByCategory  = groupByCount(assets, 'Category');
  const assetByLocation  = groupByCount(assets, 'Location');
  const assetValueByCat  = groupBySum(assets, 'Category', 'PurchasePrice');
  const borrowByMonth    = groupByMonth(borrows, 'created_at');
  const repairByMonth    = groupByMonth(repairs, 'created_at');
  const totalAssetValue  = assets.reduce((s, a) => s + (Number(a.PurchasePrice) || 0), 0);

  const loading = loadingAssets || loadingBorrows || loadingRepairs || loadingInventory;

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
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <BarChart2 size={20} className="text-indigo-600"/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">รายงาน</h1>
              <p className="text-sm text-gray-500">สรุปข้อมูลและส่งออกรายงาน</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={loading}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
            </button>
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
              <FileSpreadsheet size={15}/> Excel
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors">
              <FileText size={15}/> PDF
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                ${activeTab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={14}/> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── Overview tab ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {(loadingAssets || loadingBorrows || loadingRepairs) ? <Spinner/> : (
              <>
                {/* Top stat row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="ทรัพย์สินทั้งหมด"   value={fmtNum(assets.length)}                         icon={Package}    color="text-blue-600 bg-blue-50"/>
                  <StatCard label="มูลค่ารวม (บาท)"     value={`฿${fmtNum(totalAssetValue)}`}                icon={BarChart2}  color="text-indigo-600 bg-indigo-50"/>
                  <StatCard label="คำขอยืมรอดำเนินการ" value={fmtNum(borrowCounts.pending)}                  icon={BookOpen}   color="text-yellow-600 bg-yellow-50"/>
                  <StatCard label="คำขอซ่อมรอดำเนินการ" value={fmtNum(repairCounts.pending)}                 icon={Wrench}     color="text-orange-600 bg-orange-50"/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Asset status donut */}
                  <ChartCard title="สถานะทรัพย์สิน">
                    {assets.length ? (() => {
                      const donutData = [
                        { name: 'ว่าง / ปกติ', value: assets.filter(a=>a.Status===1).length },
                        { name: 'ถูกยืม',       value: assets.filter(a=>a.Status===2).length },
                        { name: 'ส่งซ่อม',      value: assets.filter(a=>a.Status===3).length },
                      ].filter(d => d.value > 0);
                      return (
                        <div className="flex flex-col items-center">
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]}/>)}
                              </Pie>
                              <Tooltip/>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex gap-4 mt-1">
                            {donutData.map((d, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS[i] }}/>
                                {d.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })() : <Empty/>}
                  </ChartCard>

                  {/* Borrow by month */}
                  <ChartCard title="การยืมรายเดือน">
                    {borrowByMonth.length ? <SimpleLineChart data={borrowByMonth} dataKey="count"/> : <Empty/>}
                  </ChartCard>

                  {/* Repair by month */}
                  <ChartCard title="การซ่อมรายเดือน">
                    {repairByMonth.length ? <SimpleLineChart data={repairByMonth} dataKey="count"/> : <Empty/>}
                  </ChartCard>
                </div>

                {/* Summary rows */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <BookOpen size={14} className="text-blue-500"/>
                      <SectionTitle>คำขอยืมล่าสุด</SectionTitle>
                    </div>
                    <ReportTable
                      cols={[
                        { key: 'borrower_name', label: 'ผู้ยืม' },
                        { key: '_assets',        label: 'ทรัพย์สิน' },
                        { key: '_status',        label: 'สถานะ' },
                      ]}
                      rows={[...borrows].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5).map(b => ({
                        ...b,
                        _assets: (b.assets||[]).map(a=>a.name).join(', ') || '—',
                        _status: BORROW_STATUS_TH[b.status] || b.status,
                      }))}
                      emptyMsg="ไม่มีคำขอยืม"
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <Wrench size={14} className="text-orange-500"/>
                      <SectionTitle>คำขอซ่อมล่าสุด</SectionTitle>
                    </div>
                    <ReportTable
                      cols={[
                        { key: 'asset_name',       label: 'ทรัพย์สิน' },
                        { key: '_urgency',          label: 'ความเร่งด่วน' },
                        { key: '_status',           label: 'สถานะ' },
                      ]}
                      rows={[...repairs].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5).map(r => ({
                        ...r,
                        _urgency: r.urgency === 'urgent' ? 'เร่งด่วน' : 'ปกติ',
                        _status:  REPAIR_STATUS_TH[r.status] || r.status,
                      }))}
                      emptyMsg="ไม่มีคำขอซ่อม"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Assets tab ────────────────────────────────────────────────────── */}
        {activeTab === 'assets' && (
          <>
            {loadingAssets ? <Spinner/> : (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="ทรัพย์สินทั้งหมด" value={fmtNum(assets.length)} icon={Package} color="text-blue-600 bg-blue-50"/>
                  <StatCard label="ว่าง / ปกติ"     value={fmtNum(assets.filter(a=>a.Status===1).length)} icon={CheckCircle2} color="text-green-600 bg-green-50"/>
                  <StatCard label="ถูกยืม"           value={fmtNum(assets.filter(a=>a.Status===2).length)} icon={BookOpen}     color="text-yellow-600 bg-yellow-50"/>
                  <StatCard label="มูลค่ารวม (บาท)"  value={`฿${fmtNum(totalAssetValue)}`}              icon={BarChart2}    color="text-indigo-600 bg-indigo-50"/>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ChartCard title="จำนวนทรัพย์สินตามหมวดหมู่">
                    {assetByCategory.length ? <SimpleBarChart data={assetByCategory.slice(0,12)} dataKey="count" color="#3b82f6"/> : <Empty/>}
                  </ChartCard>
                  <ChartCard title="จำนวนทรัพย์สินตามสถานที่">
                    {assetByLocation.length ? <SimpleBarChart data={assetByLocation.slice(0,12)} dataKey="count" color="#10b981"/> : <Empty/>}
                  </ChartCard>
                  <ChartCard title="มูลค่ารวมตามหมวดหมู่ (บาท)">
                    {assetValueByCat.length ? <SimpleBarChart data={assetValueByCat.slice(0,12)} dataKey="total" color="#8b5cf6"/> : <Empty/>}
                  </ChartCard>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <SectionTitle>รายการทรัพย์สินทั้งหมด</SectionTitle>
                  </div>
                  <ReportTable
                    cols={[
                      { key: 'InvNo',    label: 'รหัส' },
                      { key: 'Name',     label: 'ชื่อ' },
                      { key: 'Category', label: 'หมวดหมู่' },
                      { key: 'Location', label: 'สถานที่' },
                      { key: '_status',  label: 'สถานะ' },
                      { key: '_price',   label: 'ราคา (บาท)' },
                    ]}
                    rows={assets.map(a => ({
                      ...a,
                      _status: ASSET_STATUS[a.Status] || '—',
                      _price:  fmtPrice(a.PurchasePrice),
                    }))}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* ── Borrows tab ───────────────────────────────────────────────────── */}
        {activeTab === 'borrows' && (
          <>
            {loadingBorrows ? <Spinner/> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="ทั้งหมด"      value={fmtNum(borrows.length)}          icon={BookOpen}    color="text-blue-600 bg-blue-50"/>
                  <StatCard label="รอดำเนินการ"  value={fmtNum(borrowCounts.pending)}    icon={AlertTriangle} color="text-yellow-600 bg-yellow-50"/>
                  <StatCard label="อนุมัติแล้ว"  value={fmtNum(borrowCounts.approved)}   icon={CheckCircle2} color="text-blue-600 bg-blue-50"/>
                  <StatCard label="คืนแล้ว"      value={fmtNum(borrowCounts.returned)}   icon={CheckCircle2} color="text-green-600 bg-green-50"/>
                </div>

                <ChartCard title="แนวโน้มคำขอยืมรายเดือน">
                  {borrowByMonth.length ? <SimpleLineChart data={borrowByMonth} dataKey="count"/> : <Empty/>}
                </ChartCard>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <SectionTitle>รายการคำขอยืมทั้งหมด</SectionTitle>
                  </div>
                  <ReportTable
                    cols={[
                      { key: 'borrower_name',     label: 'ผู้ยืม' },
                      { key: '_assets',            label: 'ทรัพย์สิน' },
                      { key: '_due',               label: 'กำหนดคืน' },
                      { key: '_status',            label: 'สถานะ' },
                      { key: '_date',              label: 'วันที่ขอ' },
                    ]}
                    rows={borrows.map(b => ({
                      ...b,
                      _assets: (b.assets || []).map(a => a.name).join(', ') || '—',
                      _due:    fmt(b.expected_return),
                      _status: BORROW_STATUS_TH[b.status] || b.status,
                      _date:   fmt(b.created_at),
                    }))}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* ── Repairs tab ───────────────────────────────────────────────────── */}
        {activeTab === 'repairs' && (
          <>
            {loadingRepairs ? <Spinner/> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="ทั้งหมด"     value={fmtNum(repairs.length)}          icon={Wrench}      color="text-orange-600 bg-orange-50"/>
                  <StatCard label="รอดำเนินการ" value={fmtNum(repairCounts.pending)}    icon={AlertTriangle} color="text-yellow-600 bg-yellow-50"/>
                  <StatCard label="ซ่อมเสร็จ"   value={fmtNum(repairCounts.completed)} icon={CheckCircle2} color="text-purple-600 bg-purple-50"/>
                  <StatCard label="คืนคลังแล้ว" value={fmtNum(repairCounts.returned)}  icon={CheckCircle2} color="text-green-600 bg-green-50"/>
                </div>

                <ChartCard title="แนวโน้มคำขอซ่อมรายเดือน">
                  {repairByMonth.length ? <SimpleLineChart data={repairByMonth} dataKey="count"/> : <Empty/>}
                </ChartCard>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <SectionTitle>รายการคำขอซ่อมทั้งหมด</SectionTitle>
                  </div>
                  <ReportTable
                    cols={[
                      { key: 'asset_name',        label: 'ทรัพย์สิน' },
                      { key: 'asset_code',         label: 'รหัส' },
                      { key: 'requested_by_name',  label: 'ผู้แจ้ง' },
                      { key: '_urgency',           label: 'ความเร่งด่วน' },
                      { key: '_status',            label: 'สถานะ' },
                      { key: '_date',              label: 'วันที่แจ้ง' },
                    ]}
                    rows={repairs.map(r => ({
                      ...r,
                      _urgency: r.urgency === 'urgent' ? 'เร่งด่วน' : 'ปกติ',
                      _status:  REPAIR_STATUS_TH[r.status] || r.status,
                      _date:    fmt(r.created_at),
                    }))}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* ── Inventory tab ─────────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <>
            {loadingInventory ? <Spinner/> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="รอบตรวจนับทั้งหมด" value={fmtNum(sessions.length)}                                   icon={ClipboardList} color="text-blue-600 bg-blue-50"/>
                  <StatCard label="กำลังดำเนินการ"    value={fmtNum(sessions.filter(s=>(s.Status||s.status)==='active').length)}   icon={RefreshCw}    color="text-yellow-600 bg-yellow-50"/>
                  <StatCard label="ปิดแล้ว"           value={fmtNum(sessions.filter(s=>(s.Status||s.status)==='closed').length)}  icon={CheckCircle2} color="text-green-600 bg-green-50"/>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <SectionTitle>รอบตรวจนับทั้งหมด</SectionTitle>
                  </div>
                  <ReportTable
                    cols={[
                      { key: '_name',    label: 'ชื่อรอบ' },
                      { key: '_status',  label: 'สถานะ' },
                      { key: '_created', label: 'วันที่เปิด' },
                      { key: '_closed',  label: 'วันที่ปิด' },
                    ]}
                    rows={sessions.map(s => ({
                      _name:    s.Name   || s.name   || '—',
                      _status:  s.Status || s.status || '—',
                      _created: fmt(s.CreatedAt || s.created_at),
                      _closed:  fmt(s.ClosedAt  || s.closed_at),
                    }))}
                    emptyMsg="ยังไม่มีรอบตรวจนับ"
                  />
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex items-center justify-center py-20 text-gray-400">
    <RefreshCw size={24} className="animate-spin mr-2"/> กำลังโหลด...
  </div>
);

const Empty = () => (
  <div className="flex items-center justify-center h-[180px] text-gray-300 text-sm">ไม่มีข้อมูลเพียงพอ</div>
);
