import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import { NAV_ITEMS } from '../constants/permissions';
import { repairAPI } from '../services/api';
import {
  LayoutDashboard, Package, ScanLine, ClipboardList,
  MapPin, Upload, BarChart2, Users, ShieldCheck,
  ScrollText, LogOut, Menu, X, ChevronRight, Bell,
  Wrench, CheckCircle2, XCircle, Clock, ChevronDown,
  ArrowLeft, Printer,
} from 'lucide-react';

// ── ชื่อหน้าแต่ละ path ────────────────────────────────────────────────────────
const PAGE_TITLES = {
  '/app/dashboard':    { title: 'Dashboard',            parent: null },
  '/app/assets':       { title: 'จัดการทรัพย์สิน',       parent: null },
  '/app/scan':         { title: 'สแกนทรัพย์สิน',          parent: null },
  '/app/inventory':    { title: 'รอบตรวจนับ',             parent: null },
  '/app/locations':    { title: 'สถานที่ / โอนย้าย',      parent: null },
  '/app/import':       { title: 'นำเข้าข้อมูล',           parent: null },
  '/app/print-labels': { title: 'พิมพ์ป้าย',              parent: null },
  '/app/reports':      { title: 'รายงาน',                parent: null },
  '/app/users':        { title: 'จัดการผู้ใช้',           parent: null },
  '/app/roles':        { title: 'สิทธิ์การเข้าถึง',       parent: null },
  '/app/logs':         { title: 'System Logs',           parent: null },
};

// ── Back Bar — แสดงชื่อหน้าและปุ่มย้อนกลับ ────────────────────────────────────
const BackBar = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const page = PAGE_TITLES[location.pathname];

  if (!page || location.pathname === '/app/dashboard') return null;

  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <ArrowLeft size={16} />
      </button>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <button
          onClick={() => navigate('/app/dashboard')}
          className="hover:text-blue-600 transition-colors"
        >
          Dashboard
        </button>
        <ChevronRight size={13} />
        <span className="font-medium text-gray-700">{page.title}</span>
      </div>
    </div>
  );
};

const ICON_MAP = {
  LayoutDashboard, Package, ScanLine, ClipboardList,
  MapPin, Upload, BarChart2, Users, ShieldCheck, ScrollText,
  Printer,
};

const ROLE_BADGE = {
  superadmin: 'bg-purple-100 text-purple-700',
  admin:      'bg-blue-100 text-blue-700',
  staff:      'bg-green-100 text-green-700',
  auditor:    'bg-amber-100 text-amber-700',
};

const REPAIR_STATUS_CFG = {
  pending:   { label: 'รอดำเนินการ',         icon: Clock,         color: 'text-yellow-600', bg: 'bg-yellow-50' },
  approved:  { label: 'อนุมัติ / กำลังซ่อม', icon: Wrench,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
  completed: { label: 'ซ่อมเสร็จ / รอรับคืน',icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50'  },
  returned:  { label: 'คืนแล้ว',              icon: CheckCircle2,  color: 'text-gray-500',   bg: 'bg-gray-50'   },
  rejected:  { label: 'ปฏิเสธ',               icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50'    },
};

// ── Notification Bell ─────────────────────────────────────────────────────────
const NotificationBell = ({ user, isAdmin, isSuperAdmin }) => {
  const [open, setOpen]       = useState(false);
  const [repairs, setRepairs] = useState([]);
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef              = useRef(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      let data = [];
      if (isAdmin || isSuperAdmin) {
        const res = await repairAPI.getAll({ status: 'pending' });
        data = res.data?.data || res.data || [];
      } else {
        const res = await repairAPI.getMine();
        data = res.data?.data || res.data || [];
      }
      setRepairs(data.slice(0, 10));
      if (isAdmin || isSuperAdmin) {
        setUnread(data.length);
      } else {
        setUnread(data.filter(r => ['approved','completed','rejected'].includes(r.status)).length);
      }
    } catch (err) {
      if (err?.response?.status !== 404 && err?.response?.status !== 500) {
        console.warn('fetchNotifications:', err.message);
      }
      setRepairs([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Wrench size={14} className="text-orange-500" />
              <span className="text-sm font-semibold text-gray-800">
                {isAdmin || isSuperAdmin ? 'คำขอซ่อมรอดำเนินการ' : 'สถานะคำขอซ่อมของฉัน'}
              </span>
            </div>
            <button onClick={fetchNotifications} disabled={loading}
              className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50">
              {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && repairs.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">กำลังโหลด...</div>
            ) : repairs.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">
                  {isAdmin || isSuperAdmin ? 'ไม่มีคำขอรอดำเนินการ' : 'ยังไม่มีคำขอซ่อม'}
                </p>
              </div>
            ) : (
              repairs.map((r) => {
                const cfg = REPAIR_STATUS_CFG[r.status] || REPAIR_STATUS_CFG.pending;
                const Icon = cfg.icon;
                return (
                  <div key={r.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon size={13} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.asset_name}</p>
                        <p className="text-xs text-gray-400 truncate">{r.asset_code}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          {r.urgency === 'urgent' && (
                            <span className="text-xs text-red-500 font-semibold">⚡ เร่งด่วน</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">
                          {isAdmin || isSuperAdmin
                            ? `โดย: ${r.requested_by_name || '-'} · ${formatDate(r.created_at)}`
                            : formatDate(r.created_at)
                          }
                        </p>
                        {!isAdmin && !isSuperAdmin && r.admin_note && (
                          <p className="text-xs text-blue-600 mt-1 bg-blue-50 rounded px-2 py-1">
                            💬 {r.admin_note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {repairs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
              <p className="text-xs text-gray-400">{repairs.length} รายการ</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── AppLayout ─────────────────────────────────────────────────────────────────
const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout }  = useAuth();
  const { can, isAdmin, isSuperAdmin } = usePermission();
  const navigate          = useNavigate();

  const visibleNavItems = NAV_ITEMS.filter(item => can(item.permission));

  const handleLogout = () => { logout(); navigate('/login'); };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ===== SIDEBAR ===== */}
      <aside className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex-shrink-0 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 h-16">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package size={16} className="text-white" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">AssetMS</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <ul className="space-y-0.5 px-2">
            {visibleNavItems.map((item) => {
              const Icon = ICON_MAP[item.icon] || Package;
              return (
                <li key={item.key}>
                  <NavLink to={item.path}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150 group relative
                      ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                    `}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {isActive && <ChevronRight size={14} className="text-blue-400" />}
                          </>
                        )}
                        {!sidebarOpen && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            {item.label}
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {getInitials(user?.fullName || user?.username)}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user?.fullName || user?.username}</p>
                <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE[user?.roleName] || 'bg-gray-100 text-gray-600'}`}>
                  {user?.roleDisplayName || user?.roleName}
                </span>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="ออกจากระบบ">
                <LogOut size={16} />
              </button>
            )}
          </div>
          {!sidebarOpen && (
            <button onClick={handleLogout}
              className="mt-2 w-full flex items-center justify-center p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="ออกจากระบบ">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div />
          <div className="flex items-center gap-3">
            <NotificationBell user={user} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
            <div className="h-6 w-px bg-gray-200" />
            <span className="text-sm text-gray-600">
              สวัสดี, <span className="font-medium text-gray-800">{user?.fullName || user?.username}</span>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <BackBar />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;