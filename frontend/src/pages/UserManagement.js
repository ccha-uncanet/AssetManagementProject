import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, Trash2, Pencil, X, Loader2,
  Users, CheckCircle2, AlertTriangle, Eye, EyeOff, Save
} from 'lucide-react';

// ── Role config — ใช้ทั้ง id และ name เป็น key ────────────────────────────
const ROLES = [
  { id: 1, name: 'superadmin', label: 'Superadmin', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  { id: 2, name: 'admin',      label: 'Admin',       color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  { id: 3, name: 'staff',      label: 'Staff',       color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  { id: 4, name: 'auditor',    label: 'Auditor',     color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'  },
];

// หา role config จาก RoleName หรือ RoleId_New หรือ RoleId (fallback)
const getRoleConfig = (u) => {
  return (
    ROLES.find(r => r.name === u.RoleName) ||
    ROLES.find(r => r.id === u.RoleId_New) ||
    ROLES.find(r => r.id === u.RoleId) ||
    { id: 0, name: 'unknown', label: 'ไม่ระบุ', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
  );
};

const RoleBadge = ({ user }) => {
  const r = getRoleConfig(user);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${r.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
      {r.label}
    </span>
  );
};

const EMPTY_FORM = { username: '', password: '', fullName: '', email: '', roleId: 3 };

// ── Main ──────────────────────────────────────────────────────────────────────
const UserManagement = () => {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [showForm, setShowForm]         = useState(false);
  const [formData, setFormData]         = useState(EMPTY_FORM);
  const [formLoading, setFormLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser]   = useState(null);
  const [toast, setToast]               = useState(null);

  const { isAdmin, isSuperAdmin } = usePermission();
  const { user: currentUser }     = useAuth();

  // Admin ขึ้นไปจัดการ user ได้
  const canManage = isAdmin;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getAll();
      setUsers(res.data);
    } catch {
      showToast('ไม่สามารถดึงข้อมูลผู้ใช้ได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.Username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.FullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.Email?.toLowerCase().includes(searchTerm.toLowerCase());
    const r = getRoleConfig(u);
    const matchRole = roleFilter === 'all' || r.name === roleFilter;
    return matchSearch && matchRole;
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await api.post('/auth/register', formData);
      showToast('สร้างผู้ใช้งานสำเร็จ');
      setFormData(EMPTY_FORM);
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || err.response?.data?.message || 'สร้างไม่สำเร็จ', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateRole = async (userId) => {
    if (!editingUser) return;
    try {
      await userAPI.update(userId, { roleId: editingUser.roleId });
      showToast('อัปเดต Role สำเร็จ');
      setEditingUser(null);
      fetchUsers();
    } catch {
      showToast('อัปเดตไม่สำเร็จ', 'error');
    }
  };

  const handleDelete = async (id, username) => {
    if (id === currentUser?.id) { showToast('ไม่สามารถลบบัญชีตัวเองได้', 'error'); return; }
    if (!window.confirm(`ยืนยันการลบผู้ใช้ "${username}" ?`)) return;
    try {
      await userAPI.delete(id);
      showToast('ลบผู้ใช้งานเรียบร้อย');
      fetchUsers();
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    }
  };

  const field = (key) => ({
    value: formData[key],
    onChange: (e) => setFormData(f => ({ ...f, [key]: e.target.value })),
    disabled: formLoading,
    className: 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50',
  });

  const statsByRole = ROLES.map(r => ({
    ...r,
    count: users.filter(u => getRoleConfig(u).name === r.name).length,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ทั้งหมด <span className="font-medium text-gray-700">{users.length}</span> บัญชี
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'ยกเลิก' : 'เพิ่มผู้ใช้งาน'}
          </button>
        )}
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsByRole.map(r => (
          <button key={r.id}
            onClick={() => setRoleFilter(roleFilter === r.name ? 'all' : r.name)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
              ${roleFilter === r.name ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.dot}`} />
            <div>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{r.count}</p>
              <p className="text-xs text-gray-500">{r.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showForm && canManage && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <Plus size={16} className="text-blue-600" /> เพิ่มผู้ใช้งานใหม่
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Username *</label>
                <input type="text" placeholder="username" required {...field('username')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="รหัสผ่าน" required
                    value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                    disabled={formLoading}
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อ-นามสกุล</label>
                <input type="text" placeholder="ชื่อ นามสกุล" {...field('fullName')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input type="email" placeholder="email@example.com" {...field('email')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
                <select value={formData.roleId}
                  onChange={e => setFormData(f => ({ ...f, roleId: parseInt(e.target.value) }))}
                  disabled={formLoading}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white">
                  {ROLES.filter(r => isSuperAdmin || r.name !== 'superadmin').map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); }}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={formLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {formLoading ? <><Loader2 size={14} className="animate-spin" /> กำลังบันทึก...</> : 'บันทึกผู้ใช้งาน'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="ค้นหา Username, ชื่อ-สกุล, Email..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {roleFilter !== 'all' && (
            <button onClick={() => setRoleFilter('all')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <X size={13} /> ล้าง filter
            </button>
          )}
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filteredUsers.length} / {users.length} รายการ
          </span>
        </div>
      </div>

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
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้ใช้งาน</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  {canManage && (
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map(u => {
                  const isSelf    = u.Id === currentUser?.id;
                  const isEditing = editingUser?.id === u.Id;
                  const roleConf  = getRoleConfig(u);

                  return (
                    <tr key={u.Id} className={`hover:bg-gray-50 transition-colors ${isSelf ? 'bg-blue-50/40' : ''}`}>

                      {/* Avatar + Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-semibold">
                              {(u.FullName || u.Username || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {u.FullName || '-'}
                              {isSelf && <span className="ml-2 text-xs text-blue-500 font-normal">(คุณ)</span>}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {u.Username}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-gray-500 text-xs">{u.Email || '-'}</td>

                      {/* Role */}
                      <td className="px-5 py-4 text-center">
                        <RoleBadge user={u} />
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <select value={editingUser.roleId}
                                  onChange={e => setEditingUser(p => ({ ...p, roleId: parseInt(e.target.value) }))}
                                  className="px-2 py-1.5 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                  {ROLES.filter(r => isSuperAdmin || r.name !== 'superadmin').map(r => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                  ))}
                                </select>
                                <button onClick={() => handleUpdateRole(u.Id)}
                                  className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                  <Save size={13} />
                                </button>
                                <button onClick={() => setEditingUser(null)}
                                  className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingUser({ id: u.Id, roleId: u.RoleId_New || u.RoleId || 3 })}
                                  disabled={isSelf}
                                  title={isSelf ? 'ไม่สามารถแก้ไข Role ของตัวเองได้' : 'เปลี่ยน Role'}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => handleDelete(u.Id, u.Username)}
                                  disabled={isSelf}
                                  title={isSelf ? 'ไม่สามารถลบบัญชีตัวเองได้' : 'ลบผู้ใช้งาน'}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" className="py-16 text-center">
                      <Users size={32} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-400 text-sm">
                        {searchTerm || roleFilter !== 'all' ? 'ไม่พบผลการค้นหา' : 'ยังไม่มีผู้ใช้งานในระบบ'}
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

export default UserManagement;