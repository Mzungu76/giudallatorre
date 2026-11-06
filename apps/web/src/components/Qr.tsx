import { useEffect, useState } from "react";
import QRCode from "qrcode";
export default function Qr({ text, size = 108 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: size * 3, color: { dark: "#13224a", light: "#ffffff" } }).then(setSrc).catch(() => setSrc("")); }, [text, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={`QR code: ${text}`} /> : <div className="qr" style={{ width: size, height: size }} />;
}
