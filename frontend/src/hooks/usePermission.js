import { useAuth } from '../context/AuthContext';

/**
 * usePermission hook
 *
 * ใช้ใน component เพื่อทำ conditional rendering ตามสิทธิ์
 *
 * ตัวอย่างการใช้งาน:
 *
 *   const { can, isRole, canAny } = usePermission();
 *
 *   // แสดงปุ่มลบเฉพาะคนที่มี permission 'delete_asset'
 *   {can('delete_asset') && <DeleteButton />}
 *
 *   // แสดงเมนู Users เฉพาะ superadmin และ admin
 *   {isRole(['superadmin', 'admin']) && <UsersMenu />}
 *
 *   // แสดงส่วน Reports ถ้ามี permission อย่างน้อยหนึ่งอย่าง
 *   {canAny(['view_reports', 'export_reports']) && <ReportsSection />}
 */
const usePermission = () => {
  const { hasPermission, hasAllPermissions, hasAnyPermission, hasRole, user } = useAuth();

  return {
    /** ตรวจสอบ permission เดี่ยว */
    can: hasPermission,

    /** ตรวจสอบหลาย permissions (AND) */
    canAll: hasAllPermissions,

    /** ตรวจสอบหลาย permissions (OR) */
    canAny: hasAnyPermission,

    /** ตรวจสอบ role (รับ string หรือ array) */
    isRole: hasRole,

    /** ข้อมูล user ปัจจุบัน */
    user,

    /** Shortcuts สำหรับ role ที่ใช้บ่อย */
    isSuperAdmin: hasRole('superadmin'),
    isAdmin: hasRole(['superadmin', 'admin']),
    isStaff: hasRole('staff'),
    isAuditor: hasRole('auditor'),

    /** ดู role ปัจจุบัน */
    currentRole: user?.roleName ?? null,

    /** ดู permissions ทั้งหมดของ user */
    permissions: user?.permissions ?? [],
  };
};

export default usePermission;