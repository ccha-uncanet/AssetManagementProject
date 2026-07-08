import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, SwitchCamera, Loader2 } from 'lucide-react';

/**
 * Custom full-screen camera scanner using Html5Qrcode low-level API.
 * No default html5-qrcode UI — styled entirely with Tailwind.
 *
 * Props:
 *   onScanSuccess(decodedText) — called once when a code is read
 *   onClose()                  — called when user presses ✕
 */
const MIN_BOX = 100;
const MAX_BOX = 400;
const DEFAULT_BOX = 240;

export default function AssetScanner({ onScanSuccess, onClose }) {
  const scannerRef  = useRef(null);
  const runningRef  = useRef(false);
  const boxSizeRef  = useRef(DEFAULT_BOX); // read each frame by qrbox fn — no restart needed
  const [cameras, setCameras]   = useState([]);
  const [camIndex, setCamIndex] = useState(0);
  const [starting, setStarting] = useState(true);
  const [error, setError]       = useState('');
  const [boxSize, setBoxSize]   = useState(DEFAULT_BOX);
  const READER_ID = 'qr-reader-custom';

  const handleBoxChange = (e) => {
    const v = Number(e.target.value);
    boxSizeRef.current = v;
    setBoxSize(v);
  };

  const safeStop = async () => {
    if (scannerRef.current && runningRef.current) {
      runningRef.current = false;
      await scannerRef.current.stop().catch(() => {});
    }
  };

  const startCamera = async (cameraId) => {
    setError('');
    try {
      await scannerRef.current.start(
        cameraId,
        { fps: 15, qrbox: () => ({ width: boxSizeRef.current, height: boxSizeRef.current }) },
        (decodedText) => {
          safeStop();
          onScanSuccess(decodedText);
        },
        () => {}
      );
      runningRef.current = true;
    } catch (err) {
      setError('ไม่สามารถเปิดกล้องได้: ' + (err.message || err));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!devices?.length) {
          setError('ไม่พบกล้อง — กรุณาอนุญาตการเข้าถึงกล้อง');
          setStarting(false);
          return;
        }

        setCameras(devices);
        scannerRef.current = new Html5Qrcode(READER_ID);

        // Prefer rear camera on mobile
        const rearIndex = devices.findIndex(d => /back|rear|environment/i.test(d.label));
        const idx = rearIndex >= 0 ? rearIndex : 0;
        setCamIndex(idx);
        await startCamera(devices[idx].id);
      } catch {
        if (mounted) {
          setError('ไม่สามารถเข้าถึงกล้องได้ — กรุณาอนุญาตในเบราว์เซอร์');
          setStarting(false);
        }
      }
    };

    init();
    return () => {
      mounted = false;
      safeStop();
    };
  }, []);

  const handleSwitch = async () => {
    if (cameras.length < 2) return;
    const next = (camIndex + 1) % cameras.length;
    setCamIndex(next);
    setStarting(true);
    await safeStop();
    await startCamera(cameras[next].id);
  };

  const handleClose = async () => {
    await safeStop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Force html5-qrcode's inline-style video to fill the container */}
      <style>{`
        #qr-reader-custom video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
        <span className="text-white text-sm font-medium">สแกน QR / Barcode</span>
        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button onClick={handleSwitch}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              title="สลับกล้อง">
              <SwitchCamera size={18} className="text-white"/>
            </button>
          )}
          <button onClick={handleClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title="ปิด">
            <X size={18} className="text-white"/>
          </button>
        </div>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">

        {/* html5-qrcode attaches the <video> element here */}
        <div
          id={READER_ID}
          className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>img]:hidden [&>*:not(video)]:hidden"
        />

        {/* Loading */}
        {starting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <Loader2 size={36} className="animate-spin text-white mb-3"/>
            <p className="text-white text-sm">กำลังเปิดกล้อง...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-8">
            <p className="text-red-400 text-center text-sm mb-4">{error}</p>
            <button onClick={handleClose}
              className="px-4 py-2 bg-white text-gray-900 rounded-xl text-sm font-medium">
              ปิด
            </button>
          </div>
        )}

        {/* Scan frame (shown when camera is live) */}
        {!starting && !error && (
          <>
            {/* Vignette darkening outside scan box */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse ${boxSize + 20}px ${boxSize + 20}px at center, transparent 47%, rgba(0,0,0,0.65) 49%)` }}
            />

            {/* Scan box with corner brackets */}
            <div className="absolute pointer-events-none"
              style={{ width: boxSize, height: boxSize, top: '50%', left: '50%', transform: 'translate(-50%, -55%)' }}>
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"/>
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"/>
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"/>
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"/>

              {/* Animated scan line */}
              <div className="absolute left-2 right-2 h-0.5 bg-blue-400/80 shadow-[0_0_8px_2px_rgba(96,165,250,0.5)] animate-[scanline_2s_ease-in-out_infinite]"/>
            </div>

            <p className="absolute text-center text-white/60 text-xs w-full"
              style={{ top: `calc(50% + ${boxSize / 2 + 16}px)`, transform: 'translateY(-55%)' }}>
              วาง QR Code หรือ Barcode ภายในกรอบ
            </p>
          </>
        )}
      </div>

      {/* Slider bar */}
      {!starting && !error && (
        <div className="flex items-center gap-3 px-6 py-3 bg-black/70 backdrop-blur-sm">
          <span className="text-white/50 text-xs w-16 shrink-0">ขนาดกรอบ</span>
          <input
            type="range"
            min={MIN_BOX}
            max={MAX_BOX}
            value={boxSize}
            onChange={handleBoxChange}
            className="flex-1 accent-blue-400 h-1.5 cursor-pointer"
          />
          <span className="text-white/70 text-xs w-12 text-right shrink-0">{boxSize}px</span>
        </div>
      )}
    </div>
  );
}
