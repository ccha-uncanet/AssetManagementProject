/**
 * USAGE EXAMPLES — usePermission & Conditional Rendering
 * =========================================================
 *
 * คัดลอกส่วนที่ต้องการไปใช้ใน Component ของคุณได้เลย
 */

// ============================================================
// 1. BASIC SETUP — import ใน component ที่ต้องการ
// ============================================================
import usePermission from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';

const MyPage = () => {
  const { can, canAny, isRole, isSuperAdmin, isAdmin, isStaff, isAuditor } = usePermission();

  return (
    <div>

      {/* ============================================================
          2. ซ่อน/แสดงปุ่มตาม permission
          ============================================================ */}

      {/* แสดงปุ่ม "เพิ่มทรัพย์สิน" เฉพาะคนที่มีสิทธิ์ create */}
      {can(PERMISSIONS.CREATE_ASSET) && (
        <button>+ เพิ่มทรัพย์สิน</button>
      )}

      {/* แสดงปุ่มลบเฉพาะ superadmin และ admin */}
      {isAdmin && (
        <button className="text-red-500">ลบ</button>
      )}

      {/* แสดง badge "Superadmin" เฉพาะ superadmin */}
      {isSuperAdmin && (
        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
          Superadmin
        </span>
      )}


      {/* ============================================================
          3. ซ่อน/แสดง Section ตาม permission
          ============================================================ */}

      {/* Section รายงาน — แสดงถ้ามี permission view_reports หรือ export_reports */}
      {canAny([PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS]) && (
        <section>
          <h2>รายงาน</h2>

          {/* ปุ่ม Export เพิ่มเติม เฉพาะคนที่ export ได้ */}
          {can(PERMISSIONS.EXPORT_REPORTS) && (
            <button>Export Excel</button>
          )}
        </section>
      )}


      {/* ============================================================
          4. ปุ่มในตาราง — แสดง action ต่างกันตาม role
          ============================================================ */}
      <table>
        <tbody>
          {/* สมมติ loop assets */}
          <tr>
            <td>ชื่อทรัพย์สิน</td>
            <td>
              {/* ทุก role เห็น View */}
              <button>ดู</button>

              {/* เฉพาะคนที่ edit ได้ */}
              {can(PERMISSIONS.EDIT_ASSET) && (
                <button>แก้ไข</button>
              )}

              {/* เฉพาะ superadmin เท่านั้นที่ลบได้ */}
              {can(PERMISSIONS.DELETE_ASSET) && (
                <button className="text-red-500">ลบ</button>
              )}
            </td>
          </tr>
        </tbody>
      </table>


      {/* ============================================================
          5. แสดง content ต่างกันตาม role (Dashboard ตัวอย่าง)
          ============================================================ */}
      <div>
        {/* Superadmin เห็น System Health */}
        {isSuperAdmin && (
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3>System Health</h3>
            {/* ... */}
          </div>
        )}

        {/* Admin เห็น Asset Summary */}
        {isAdmin && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3>สรุปทรัพย์สิน</h3>
            {/* ... */}
          </div>
        )}

        {/* Staff เห็น Task ที่ต้องทำ */}
        {isStaff && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h3>งานที่ต้องดำเนินการ</h3>
            {/* ... */}
          </div>
        )}

        {/* Auditor เห็น Report Summary */}
        {isAuditor && (
          <div className="bg-amber-50 p-4 rounded-lg">
            <h3>สรุปรายงาน</h3>
            {/* ... */}
          </div>
        )}
      </div>


      {/* ============================================================
          6. Disable ปุ่ม แทนการซ่อน (UX ที่ดีกว่าในบางกรณี)
          ============================================================ */}
      <button
        disabled={!can(PERMISSIONS.PRINT_LABEL)}
        className={!can(PERMISSIONS.PRINT_LABEL) ? 'opacity-50 cursor-not-allowed' : ''}
        title={!can(PERMISSIONS.PRINT_LABEL) ? 'คุณไม่มีสิทธิ์พิมพ์ฉลาก' : undefined}
      >
        พิมพ์ฉลาก
      </button>

    </div>
  );
};

export default MyPage;