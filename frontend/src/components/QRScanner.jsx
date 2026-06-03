import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

export default function QRScanner({ onScanSuccess, onScanError }) {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const html5QrcodeRef = useRef(null);
  const isMountedRef = useRef(true);

  const startScanner = async () => {
    setErrorMsg('');
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No camera devices found. Check browser camera permissions.');
      }

      // Clear any leftover content from a previous session
      const container = document.getElementById('qr-reader-viewport');
      if (container) container.innerHTML = '';

      const scanner = new Html5Qrcode('qr-reader-viewport');
      html5QrcodeRef.current = scanner;

      // Mark scanning BEFORE start so the div is sized properly
      setIsScanning(true);

      // Small delay to let React re-render and the div become properly sized
      await new Promise(resolve => setTimeout(resolve, 100));

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.65;
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          stopScanner();
          onScanSuccess(decodedText);
          // Success chime
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.stop(ctx.currentTime + 0.15);
          } catch (e) {}
        },
        () => {
          // Ignore per-frame scan errors (fires every frame without a QR code)
        }
      );

    } catch (err) {
      console.error('[SCANNER ERROR]', err);
      setIsScanning(false);
      setErrorMsg(err.message || 'Failed to start camera. Allow camera permissions and try again.');
    }
  };

  const stopScanner = async () => {
    const scanner = html5QrcodeRef.current;
    if (scanner) {
      try {
        // The library exposes getState() or isScanning
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (e) {
        console.error('Error stopping scanner:', e);
        // Force-clear the container as fallback
        const container = document.getElementById('qr-reader-viewport');
        if (container) container.innerHTML = '';
      }
      html5QrcodeRef.current = null;
    }
    setIsScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const scanner = html5QrcodeRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) {
            scanner.stop().then(() => {
              try { scanner.clear(); } catch(e) {}
            }).catch(() => {});
          } else {
            try { scanner.clear(); } catch(e) {}
          }
        } catch (e) {}
        html5QrcodeRef.current = null;
      }
    };
  }, []);

  return (
    <div className="pos-scanner-container bg-glass animate-fade" style={{ padding: '24px', borderRadius: '14px' }}>
      {/* Header row */}
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
            <><CameraOff size={16} /> Stop Camera</>
          ) : (
            <><Camera size={16} /> Start Camera</>
          )}
        </button>
      </div>

      {/* Scanner viewport wrapper — relative positioned for overlay */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '580px', margin: '0 auto' }}>

        {/* 
          The viewport container — ALWAYS in the DOM and visible so html5-qrcode 
          can measure its dimensions. We overlay a placeholder on top when idle.
        */}
        <div
          id="qr-reader-viewport"
          style={{
            width: '100%',
            minHeight: '350px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: isScanning ? '2px solid var(--primary-color)' : '2px dashed var(--surface-border)',
            boxShadow: isScanning ? '0 0 20px rgba(212, 175, 55, 0.2)' : 'none',
            background: '#000',
            transition: 'border 0.2s, box-shadow 0.2s',
          }}
        />

        {/* Placeholder overlay — covers the viewport when camera is off */}
        {!isScanning && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: '14px',
              background: '#000',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              color: 'var(--text-dim)',
              padding: '20px',
              zIndex: 5,
            }}
          >
            <Camera size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>Camera is deactivated</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Start Camera" to scan</p>
          </div>
        )}

        {/* Laser sweep + instructions overlay — on top of the video when scanning */}
        {isScanning && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '10%',
                right: '10%',
                height: '2px',
                background: 'var(--danger-color)',
                opacity: 0.7,
                boxShadow: '0 0 8px var(--danger-color)',
                animation: 'laserSweep 2s ease-in-out infinite',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: '12px',
                color: '#fff',
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '6px 12px',
                margin: '0 auto',
                width: 'fit-content',
                borderRadius: '20px',
                pointerEvents: 'none',
                zIndex: 15,
              }}
            >
              Align QR Code within the frame
            </div>
          </>
        )}
      </div>

      {/* Error display */}
      {errorMsg && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--danger-color)', fontSize: '12px', background: 'var(--danger-glow)', padding: '10px 14px', borderRadius: '6px', marginTop: '16px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
