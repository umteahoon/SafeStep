import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  isActive: boolean;
}

const ELEMENT_ID = 'safestep-qr-reader';

export function QrScanner({ onScan, isActive }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;

    const scanner = new Html5Qrcode(ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          /* 프레임마다 실패하는 건 정상 (QR이 안 보일 때) — 무시 */
        }
      )
      .then(() => {
        isRunningRef.current = true;
      })
      .catch(() => {
        /* 카메라 권한 거부 등 */
      });

    return () => {
      if (isRunningRef.current) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
        isRunningRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div id={ELEMENT_ID} className="w-full" />
    </div>
  );
}
