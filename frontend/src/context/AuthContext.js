import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // โหลดข้อมูลจาก localStorage ตอน mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('AuthContext: failed to parse stored user', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  // เรียกหลัง login สำเร็จ — รับ response จาก /api/auth/login
  const login = useCallback((responseData) => {
    const { token, user } = responseData;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // ตรวจสอบ permission เดี่ยว
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    return user.permissions?.includes(permission) ?? false;
  }, [user]);

  // ตรวจสอบหลาย permissions (AND logic — ต้องมีทุกอัน)
  const hasAllPermissions = useCallback((permissions = []) => {
    if (!user) return false;
    return permissions.every(p => user.permissions?.includes(p));
  }, [user]);

  // ตรวจสอบหลาย permissions (OR logic — มีอย่างน้อยหนึ่งอัน)
  const hasAnyPermission = useCallback((permissions = []) => {
    if (!user) return false;
    return permissions.some(p => user.permissions?.includes(p));
  }, [user]);

  // ตรวจสอบ role
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.roleName);
  }, [user]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated,
      login,
      logout,
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook สำหรับใช้งานใน component ต่างๆ
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;