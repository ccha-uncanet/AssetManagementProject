import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { assetAPI, repairAPI, borrowAPI } from '../services/api';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';
import {
  Package, CheckCircle2, ArrowUpDown, Wrench,
  RefreshCw, AlertTriangle, BarChart3, PieChart as PieIcon,
  ChevronRight, ClipboardList,
} from 'lucide-react';
import RepairRequests from './RepairRequests';
import BorrowRequests from './BorrowRequests';

const REPAIR_API_READY = true;

// ── สี ────────────────────────────────────────────────────────────────────────
const COLORS = {
  Available: '#22c55e',
  Borrowed:  '#ef4444',
  Repairing: '#f97316',
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color, loading, onClick }) => {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-500',   text: 'text-blue-600',   border: 'border-blue-100' },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-500',  text: 'text-green-600',  border: 'border-green-100' },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-500',    text: 'text-red-600',    border: 'border-red-100' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-100' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border ${c.border} p-6 shadow-sm transition-all duration-200
        ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer group' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${c.icon} rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.bg} ${c.text}`}>{sub}</span>
          {onClick && <ChevronRight size={14} className={`${c.text} opacity-0 group-hover:opacity-100 transition-opacity`}/>}
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-20" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-28" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {Number(value).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          {onClick && (
            <p className={`text-xs ${c.text} mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-medium`}>
              คลิกเพื่อดูรายการ →
            </p>
          )}
        </>
      )}
    </div>
  );
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = payload[0].payload.pct;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800">{name}</p>
      <p className="text-gray-500">{Number(value).toLocaleString()} รายการ <span className="text-gray-400">({pct}%)</span></p>
    </div>
  );
};

// ── Tab Bar ───────────────────────────────────────────────────────────────────
const TabBar = ({ activeTab, setActiveTab, repairPendingCount, borrowPendingCount }) => (
  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
    <button onClick={() => setActiveTab('overview')}
      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'overview' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}>
      ภาพรวม
    </button>
    <button onClick={() => setActiveTab('repairs')}
      className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'repairs' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}>
      คำขอซ่อม
      {repairPendingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {repairPendingCount > 9 ? '9+' : repairPendingCount}
        </span>
      )}
    </button>
    <button onClick={() => setActiveTab('borrows')}
      className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'borrows' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}>
      คำขอยืม
      {borrowPendingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {borrowPendingCount > 9 ? '9+' : borrowPendingCount}
        </span>
      )}
    </button>
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats]         = useState({ Total: 0, Available: 0, Borrowed: 0, Repairing: 0 });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── ใหม่: Tab และ repair counts ──
  const [activeTab, setActiveTab]           = useState('overview');
  const [repairCounts, setRepairCounts]     = useState({ pending: 0, approved: 0, completed: 0, returned: 0, rejected: 0 });
  const [repairLoading, setRepairLoading]   = useState(false);
  const [borrowCounts, setBorrowCounts]     = useState({ pending: 0, approved: 0, returned: 0, rejected: 0 });

  const { user } = useAuth();
  const { isSuperAdmin, isAdmin } = usePermission();
  const navigate  = useNavigate();
  const location  = useLocation();

  // รับ state จาก navigate() เช่น จาก AssetManagement เมื่อเปลี่ยนสถานะเป็นส่งซ่อม
  useEffect(() => {
    if (location.state?.openTab) {
      setActiveTab(location.state.openTab);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await assetAPI.getStats();
      setStats(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('ไม่สามารถดึงข้อมูลสถิติได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  // ── ดึง repair counts (เฉพาะ admin/superadmin) ──
  // เปลี่ยน REPAIR_API_READY = true เมื่อ Backend endpoint /repair-requests/counts พร้อม
  const fetchRepairCounts = async () => {
    if (!REPAIR_API_READY || !isSuperAdmin && !isAdmin) return;
    setRepairLoading(true);
    try {
      const res = await repairAPI.getCounts();
      setRepairCounts(res.data || {});
    } catch {
      // silent fail
    } finally {
      setRepairLoading(false);
    }
  };

  const fetchBorrowCounts = async () => {
    if (!isSuperAdmin && !isAdmin) return;
    try {
      const res = await borrowAPI.getCounts();
      setBorrowCounts(res.data || {});
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchStats();
    fetchRepairCounts();
    fetchBorrowCounts();
    const interval = setInterval(() => {
      fetchStats();
      fetchRepairCounts();
      fetchBorrowCounts();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── ข้อมูลสำหรับกราฟ ──
  const total = stats.Total || 0;
  const pct = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

  const pieData = [
    { name: 'ว่าง / ปกติ', value: stats.Available, pct: pct(stats.Available), fill: COLORS.Available },
    { name: 'ถูกยืม',      value: stats.Borrowed,  pct: pct(stats.Borrowed),  fill: COLORS.Borrowed  },
    { name: 'ส่งซ่อม',     value: stats.Repairing, pct: pct(stats.Repairing), fill: COLORS.Repairing },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'ว่าง / ปกติ', จำนวน: stats.Available, fill: COLORS.Available },
    { name: 'ถูกยืม',      จำนวน: stats.Borrowed,  fill: COLORS.Borrowed  },
    { name: 'ส่งซ่อม',     จำนวน: stats.Repairing, fill: COLORS.Repairing },
  ];

  const formatTime = (d) => d?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '-';

  const getRoleLabel = () => ({
    superadmin: 'Superadmin', admin: 'Admin', staff: 'Staff', auditor: 'Auditor'
  })[user?.roleName] || user?.roleName || '';

  // ── Overview Content ──────────────────────────────────────────────────────
  const OverviewContent = () => (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ทรัพย์สินทั้งหมดในระบบ" value={stats.Total}     sub="ทั้งหมด" icon={Package}      color="blue"   loading={loading}
          onClick={() => navigate('/app/assets')} />
        <StatCard label="พร้อมใช้งาน"             value={stats.Available} sub="ปกติ"    icon={CheckCircle2} color="green"  loading={loading}
          onClick={() => navigate('/app/assets', { state: { statusFilter: '1' } })} />
        <StatCard label="อยู่นอกคลัง / ถูกยืม"   value={stats.Borrowed}  sub="ถูกยืม"  icon={ArrowUpDown}  color="red"    loading={loading}
          onClick={() => navigate('/app/assets', { state: { statusFilter: '2' } })} />
        <StatCard label="รอซ่อม / ดำเนินการ"      value={stats.Repairing} sub="ส่งซ่อม" icon={Wrench}       color="orange" loading={loading}
          onClick={() => navigate('/app/assets', { state: { statusFilter: '3' } })} />
      </div>

      {/* ── Repair Summary Card (เฉพาะ admin/superadmin) ── */}
      {(isSuperAdmin || isAdmin) && (
        <button
          onClick={() => setActiveTab('repairs')}
          className="w-full flex items-center justify-between bg-white rounded-2xl border border-orange-100 px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClipboardList size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">คำขอซ่อมทรัพย์สิน</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {repairLoading ? 'กำลังโหลด...' : (
                  <>
                    รอดำเนินการ <strong className="text-orange-600">{repairCounts.pending || 0}</strong>
                    {' · '}กำลังซ่อม <strong className="text-blue-600">{repairCounts.approved || 0}</strong>
                    {' · '}ซ่อมเสร็จ <strong className="text-green-600">{repairCounts.completed || 0}</strong>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(repairCounts.pending || 0) > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {repairCounts.pending} รอดำเนินการ
              </span>
            )}
            <ChevronRight size={16} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
          </div>
        </button>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Donut Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <PieIcon size={16} className="text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-800">สัดส่วนสถานะทรัพย์สิน</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-56">
              <div className="w-40 h-40 rounded-full border-8 border-gray-100 animate-pulse" />
            </div>
          ) : total === 0 ? (
            <div className="flex items-center justify-center h-56 text-gray-400 text-sm">
              ยังไม่มีข้อมูลทรัพย์สิน
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={68} outerRadius={95}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" fill="#1e293b" style={{ fontSize: 26, fontWeight: 700 }}>
                    {Number(total).toLocaleString()}
                  </text>
                  <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" style={{ fontSize: 12 }}>
                    รายการทั้งหมด
                  </text>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-5 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-xs text-gray-500">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-700">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <BarChart3 size={16} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-gray-800">จำนวนแยกตามสถานะ</h2>
          </div>

          {loading ? (
            <div className="flex items-end gap-6 h-56 px-4">
              {[60, 35, 20].map((h, i) => (
                <div key={i} className="flex-1 bg-gray-100 rounded-t-lg animate-pulse" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barSize={48} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                <Bar dataKey="จำนวน" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Admin alert */}
      {(isSuperAdmin || isAdmin) && stats.Repairing > 0 && !loading && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-orange-500" />
          <span>
            มีทรัพย์สิน <strong>{stats.Repairing} รายการ</strong> ที่อยู่ระหว่างการซ่อม กรุณาติดตามสถานะ
          </span>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            สวัสดี <span className="font-medium text-gray-700">{user?.fullName || user?.username}</span>
            {' · '}
            <span className="text-blue-600 font-medium">{getRoleLabel()}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              อัปเดตล่าสุด {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => { fetchStats(); fetchRepairCounts(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Tab Bar (เฉพาะ admin/superadmin เห็น tab คำขอซ่อม) ── */}
      {(isSuperAdmin || isAdmin) && (
        <TabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          repairPendingCount={repairCounts.pending || 0}
          borrowPendingCount={borrowCounts.pending || 0}
        />
      )}

      {/* ── Content ── */}
      {activeTab === 'overview' && <OverviewContent />}
      {activeTab === 'repairs'  && <RepairRequests />}
      {activeTab === 'borrows'  && <BorrowRequests />}
    </div>
  );
};

export default Dashboard;