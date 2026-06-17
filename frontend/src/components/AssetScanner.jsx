import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function AssetScanner({ onScanSuccess }) {
  const [scanResult, setScanResult] = useState('');

  useEffect(() => {
    // 1. ตั้งค่าคุณสมบัติของกล้อง
    const config = {
      fps: 15,                           // จำนวนเฟรมต่อวินาทีในการจับภาพ
      qrbox: { width: 250, height: 250 }, // ขนาดช่องสี่เหลี่ยมที่จะให้ผู้ใช้ส่อง
      aspectRatio: 1.0,
      rememberLastUsedCamera: true       // จำกล้องตัวล่าสุดที่เปิดใช้งาน
    };

    // 2. เรียกใช้งานตัวสแกน โดยผูกเข้ากับ ID "reader"
    const scanner = new Html5QrcodeScanner("reader", config, /* verbose= */ false);

    scanner.render(
      (decodedText) => {
        // ทำงานเมื่อสแกนสำเร็จ (ได้ข้อความจาก QR Code เช่น รหัสทรัพย์สิน ASSET-001)
        setScanResult(decodedText);
        
        // ส่งค่าที่ได้กลับไปให้ Parent Component (เช่น เอาไปค้นหาในฐานข้อมูล MS SQL ต่อ)
        if (onScanSuccess) {
          onScanSuccess(decodedText);
        }

        // ปิดกล้องหลังจากสแกนเสร็จเพื่อประหยัดแบตเตอรี่มือถือ
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      },
      (errorMessage) => {
        // ฟังก์ชันนี้จะทำงานตลอดเวลาที่กล้องยังสแกนไม่เจอ QR Code 
        // ปล่อยว่างไว้เพื่อไม่ให้ Log ขยะขึ้นมาเยอะเกินไปครับ
      }
    );

    // ล้างระบบเมื่อผู้ใช้ปิดหน้าต่างนี้ หรือเปลี่ยนหน้าเว็บ
    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner on unmount", error));
    };
  }, [onScanSuccess]);

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <div className="card shadow-sm p-3 mb-4 bg-body rounded">
        <h4 className="text-center mb-3">กล้องสแกนรหัสทรัพย์สิน</h4>
        
        {/* กล้องจะถูกเรนเดอร์ใน div ก้อนนี้ */}
        <div id="reader" style={{ width: '100%' }}></div>
        
        {scanResult && (
          <div className="alert alert-success mt-3 text-center" role="alert">
            <strong>พบรหัสทรัพย์สิน:</strong> {scanResult}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetScanner;