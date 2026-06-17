import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Save, Loader2, CheckCircle2,
  AlertTriangle, Users, Package, BarChart2,
  ScrollText, Settings, Lock, RefreshCw
} from 'lucide-react';

const MODULE_CONFIG = {
  users:    { label: 'Users',    icon: Users,      color: 'bg-blue-50 text-blue-700 border-blue-200'    },
  assets:   { label: 'Assets',   icon: Package,    color: 'bg-green-50 text-green-700 border-green-200'  },
  reports:  { label: 'Reports',  icon: BarChart2,  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  logs:     { label: 'Logs',     icon: ScrollText, color: 'bg-amber-50 text-amber-700 border-amber-200'  },
  settings: { label: 'Settings', icon: Settings,   color: 'bg-gray-50 text-gray-700 border-gray-200'    },
};

const ROLE_STYLE = {
  superadmin: { bg: 'bg-purple-600', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-500' },
  admin:      { bg: 'bg-blue-600',   badge: 'bg-blue-100 text-blue-700',     border: 'border-blue-500'   },
  staff:      { bg: 'bg-green-600',  badge: 'bg-green-100 text-green-700',   border: 'border-green-500'  },
  auditor:    { bg: 'bg-amber-600',  badge: 'bg-amber-100 text-amber-700',   border: 'border-amber-500'  },
};

const RolePermission = () => {
  const [roles, setRoles]               = useState([]);
  const [permissions, setPermissions]   = useState([]);
  const [rolePerms, setRolePerms]       = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState(null);
  const [dirty, setDirty]               = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/roles');
      setRoles(res.data.roles);
      setPermissions(res.data.permissions);
      setRolePerms(res.data.rolePermissions);
      if (res.data.roles.length > 0 && !selectedRole) {
        setSelectedRole(res.data.roles[0]);
      }
      setDirty(false);
    } catch { showToast('ไม่สามารถดึงข้อมูลได้', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const hasPerm = (roleId, permId) =>
    rolePerms.some(rp => rp.RoleId === roleId && rp.PermissionId === permId);

  const togglePerm = (permId) => {
    if (!selectedRole) return;
    const exists = hasPerm(selectedRole.Id, permId);
    setRolePerms(prev =>
      exists
        ? prev.filter(rp => !(rp.RoleId === selectedRole.Id && rp.PermissionId === permId))
        : [...prev, { RoleId: selectedRole.Id, PermissionId: permId }]
    );
    setDirty(true);
  };

  const toggleAll = (moduleName, check) => {
    if (!selectedRole) return;
    const modPerms = permissions.filter(p => p.Module === moduleName);
    setRolePerms(prev => {
      let updated = prev.filter(rp =>
        !(rp.RoleId === selectedRole.Id && modPerms.some(p => p.Id === rp.PermissionId))
      );
      if (check) updated = [...updated, ...modPerms.map(p => ({ RoleId: selectedRole.Id, PermissionId: p.Id }))];
      return updated;
    });
    setDirty(true);
  };

  const countPerms = (roleId) => rolePerms.filter(rp => rp.RoleId === roleId).length;

  const moduleAllChecked = (moduleName) => {
    if (!selectedRole) return false;
    const modPerms = permissions.filter(p => p.Module === moduleName);
    return modPerms.length > 0 && modPerms.every(p => hasPerm(selectedRole.Id, p.Id));
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const permIds = rolePerms.filter(rp => rp.RoleId === selectedRole.Id).map(rp => rp.PermissionId);
      await api.put(`/superadmin/roles/${selectedRole.Id}/permissions`, { permissionIds: permIds });
      showToast(`บันทึก Permission ของ ${selectedRole.DisplayName} สำเร็จ`);
      setDirty(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'เกิดข้อผิดพลาด', 'error');
    } finally { setSaving(false); }
  };

  const modules = [...new Set(permissions.map(p => p.Module))];

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type==='error'?'bg-red-600 text-white':'bg-gray-900 text-white'}`}>
          {toast.type==='error'?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={24} className="text-purple-600"/> Role & Permission
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">กำหนดสิทธิ์การใช้งานของแต่ละ Role</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw size={16}/>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-purple-500"/>
            <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-5 items-start">
          {/* Role List */}
          <div className="w-52 flex-shrink-0 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Roles</p>
            {roles.map(role => {
              const style = ROLE_STYLE[role.Name] || ROLE_STYLE.staff;
              const isSelected = selectedRole?.Id === role.Id;
              return (
                <button key={role.Id} onClick={() => { setSelectedRole(role); setDirty(false); }}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all
                    ${isSelected ? `${style.border} bg-white shadow-sm` : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${style.bg}`}/>
                    <p className="font-semibold text-gray-800 text-sm">{role.DisplayName}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${style.badge}`}>
                    {countPerms(role.Id)} permissions
                  </span>
                </button>
              );
            })}
          </div>

          {/* Permission Matrix */}
          {selectedRole && (
            <div className="flex-1 min-w-0 space-y-4">
              {/* Header */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${ROLE_STYLE[selectedRole.Name]?.bg||'bg-gray-600'} flex items-center justify-center`}>
                    <Lock size={18} className="text-white"/>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedRole.DisplayName}</p>
                    <p className="text-xs text-gray-400">
                      {countPerms(selectedRole.Id)} / {permissions.length} permissions
                      {dirty && <span className="ml-2 text-amber-500 font-medium">· มีการเปลี่ยนแปลง</span>}
                    </p>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving || !dirty}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors shadow-sm">
                  {saving ? <><Loader2 size={14} className="animate-spin"/> บันทึก...</> : <><Save size={14}/> บันทึก</>}
                </button>
              </div>

              {/* Progress */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
                <div className="flex justify-between mb-1.5 text-xs text-gray-500">
                  <span>สิทธิ์ที่เปิดใช้งาน</span>
                  <span className="font-semibold">{Math.round((countPerms(selectedRole.Id)/Math.max(permissions.length,1))*100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${ROLE_STYLE[selectedRole.Name]?.bg||'bg-gray-600'}`}
                    style={{ width: `${(countPerms(selectedRole.Id)/Math.max(permissions.length,1))*100}%` }}/>
                </div>
              </div>

              {/* Modules */}
              {modules.map(mod => {
                const modConf = MODULE_CONFIG[mod] || { label: mod, icon: Settings, color: 'bg-gray-50 text-gray-700 border-gray-200' };
                const Icon = modConf.icon;
                const modPerms = permissions.filter(p => p.Module === mod);
                const allChecked = moduleAllChecked(mod);
                const someChecked = modPerms.some(p => hasPerm(selectedRole.Id, p.Id));
                return (
                  <div key={mod} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className={`flex items-center justify-between px-5 py-3 border-b ${modConf.color}`}>
                      <div className="flex items-center gap-2">
                        <Icon size={15}/>
                        <span className="font-semibold text-sm">{modConf.label}</span>
                        <span className="text-xs opacity-70">
                          ({modPerms.filter(p => hasPerm(selectedRole.Id, p.Id)).length}/{modPerms.length})
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                        <input type="checkbox" checked={allChecked}
                          ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
                          onChange={e => toggleAll(mod, e.target.checked)}
                          className="rounded border-gray-300 accent-green-600"/>
                        เลือกทั้งหมด
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4">
                      {modPerms.map(perm => {
                        const checked = hasPerm(selectedRole.Id, perm.Id);
                        return (
                          <label key={perm.Id}
                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border
                              ${checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}>
                            <input type="checkbox" checked={checked} onChange={() => togglePerm(perm.Id)}
                              className="rounded border-gray-300 accent-green-600 mt-0.5 flex-shrink-0"/>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${checked ? 'text-green-800' : 'text-gray-700'}`}>
                                {perm.DisplayName}
                              </p>
                              <p className="text-xs text-gray-400 font-mono truncate">{perm.Name}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Sticky save */}
              {dirty && (
                <div className="sticky bottom-4">
                  <button onClick={handleSave} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg">
                    {saving ? <><Loader2 size={16} className="animate-spin"/> กำลังบันทึก...</> : <><Save size={16}/> บันทึกการเปลี่ยนแปลง</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RolePermission;