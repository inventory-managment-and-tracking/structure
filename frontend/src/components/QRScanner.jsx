import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

export default function QRScanner({ onScanSuccess, onScanError }) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const qrRef = useRef(null);
  const html5QrcodeRef = useRef(null);

  const startScanner = async () => {
    setErrorMsg('');
    try {
      // 1. Request camera permission explicitly first
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No camera devices found');
      }

      setHasPermission(true);
      setIsScanning(true);

      const scanner = new Html5Qrcode('qr-reader-viewport');
      html5QrcodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Prefer rear-facing camera on phones
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          // Success callback
          onScanSuccess(decodedText);
          // Play a success sound
          try {
            const beep = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
            beep.play().catch(() => {});
          } catch (e) {}
        },
        (errorMessage) => {
          // Volatile error callback (fires on every empty frame, let parent deal with it if needed)
          if (onScanError) onScanError(errorMessage);
        }
      );
    } catch (err) {
      console.error('[SCANNER ERROR]', err);
      setHasPermission(false);
      setIsScanning(false);
      setErrorMsg(err.message || 'Failed to initialize scanner. Make sure you allow camera permissions.');
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (e) {
        console.error('Failed to clear scanner on stop:', e);
      }
    }
    html5QrcodeRef.current = null;
    setIsScanning(false);
  };

  // Cleanup scanner on component unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop()
          .then(() => html5QrcodeRef.current.clear())
          .catch((e) => console.error('Cleanup scanner failed:', e));
      }
    };
  }, []);

  return (
    <div className="pos-scanner-container bg-glass animate-fade" style={{ padding: '24px', borderRadius: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>QR Code Scanner</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Scan product label using the phone's back camera</p>
        </div>
        <button
          onClick={isScanning ? stopScanner : startScanner}
          className={`btn-${isScanning ? 'secondary' : 'primary'}`}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          {isScanning ? (
            <>
              <CameraOff size={16} /> Stop Camera
            </>
          ) : (
            <>
              <Camera size={16} /> Start Camera
            </>
          )}
        </button>
      </div>

      <div
        id="qr-reader-viewport"
        className="scanner-viewport-wrapper"
        style={{
          border: isScanning ? '2px dashed var(--primary-color)' : '2px dashed var(--surface-border)',
          transition: 'var(--transition-fast)',
        }}
      >
        {!isScanning && (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '20px' }}>
            <Camera size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>Camera is deactivated</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Start Camera" to scan</p>
          </div>
        )}
        {isScanning && (
          <>
            <div className="scanner-aiming-laser" />
            <div className="scanner-instructions">Align QR Code within the frame</div>
          </>
        )}
      </div>

      {errorMsg && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--danger-color)', fontSize: '12px', background: 'var(--danger-glow)', padding: '10px 14px', borderRadius: '6px', marginTop: '16px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
