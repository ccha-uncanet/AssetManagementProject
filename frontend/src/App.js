import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { PERMISSIONS } from './constants/permissions';

// Layout
import AppLayout from './components/AppLayout';

// Auth Pages
import Login from './pages/Login';

// Main Pages
import Dashboard from './pages/Dashboard';
import AssetManagement from './pages/AssetManagement';
import ScanAsset from './pages/ScanAsset';
import InventoryCounting from './pages/InventoryCounting';
import LocationMovement from './pages/LocationMovement';
import ImportAssets from './pages/ImportAssets';
import PrintLabels from './pages/PrintLabels';
import UserManagement from './pages/UserManagement';

// Superadmin Pages
import RolePermission from './pages/superadmin/RolePermission';
import SystemLogs from './pages/superadmin/SystemLogs';

// Unauthorized
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected — AppLayout ห่อด้วย ProtectedRoute ชั้นเดียว */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />

          {/* Dashboard — ทุก role ที่ login แล้วเข้าได้ ไม่ต้อง guard ซ้อน */}
          <Route path="dashboard" element={<Dashboard />} />

          <Route
            path="assets"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_ASSETS]} redirectTo="/unauthorized">
                <AssetManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="scan"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.SCAN_ASSET]} redirectTo="/unauthorized">
                <ScanAsset />
              </ProtectedRoute>
            }
          />

          <Route
            path="inventory"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_AUDIT]} redirectTo="/unauthorized">
                <InventoryCounting />
              </ProtectedRoute>
            }
          />

          <Route
            path="locations"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_LOCATIONS]} redirectTo="/unauthorized">
                <LocationMovement />
              </ProtectedRoute>
            }
          />

          <Route
            path="import"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.IMPORT_ASSETS]} redirectTo="/unauthorized">
                <ImportAssets />
              </ProtectedRoute>
            }
          />

          <Route
            path="print-labels"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_ASSETS]} redirectTo="/unauthorized">
                <PrintLabels />
              </ProtectedRoute>
            }
          />

          <Route
            path="users"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_USERS]} redirectTo="/unauthorized">
                <UserManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="roles"
            element={
              <ProtectedRoute allowedRoles={['superadmin']} redirectTo="/unauthorized">
                <RolePermission />
              </ProtectedRoute>
            }
          />

          <Route
            path="logs"
            element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_LOGS]} redirectTo="/unauthorized">
                <SystemLogs />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;