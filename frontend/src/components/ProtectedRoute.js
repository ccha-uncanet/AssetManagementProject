import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 *
 * Props:
 *  - allowedRoles: string[]     เช่น ['superadmin', 'admin']
 *  - requiredPermissions: string[]  เช่น ['view_dashboard']  (AND logic)
 *  - anyPermission: string[]    (OR logic — มีอย่างน้อยหนึ่งก็ผ่าน)
 *  - redirectTo: string         path ที่จะ redirect ถ้าไม่มีสิทธิ์ (default: '/login')
 *  - fallback: ReactNode        แสดง component อื่นแทนการ redirect (optional)
 *
 * ใช้งาน:
 *  <Route path="users" element={
 *    <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
 *      <UserManagement />
 *    </ProtectedRoute>
 *  } />
 */
const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requiredPermissions = [],
  anyPermission = [],
  redirectTo = '/login',
  fallback = null,
}) => {
  const { isAuthenticated, loading, hasRole, hasAllPermissions, hasAnyPermission, user } = useAuth();
  const location = useLocation();

  // รอโหลด auth state จาก localStorage ก่อน
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // ยังไม่ได้ login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ตรวจสอบ role (ถ้ากำหนด allowedRoles)
  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    if (fallback) return fallback;
    return <Navigate to={redirectTo} replace />;
  }

  // ตรวจสอบ permissions แบบ AND (ถ้ากำหนด requiredPermissions)
  if (requiredPermissions.length > 0 && !hasAllPermissions(requiredPermissions)) {
    if (fallback) return fallback;
    return <Navigate to={redirectTo} replace />;
  }

  // ตรวจสอบ permissions แบบ OR (ถ้ากำหนด anyPermission)
  if (anyPermission.length > 0 && !hasAnyPermission(anyPermission)) {
    if (fallback) return fallback;
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default ProtectedRoute;