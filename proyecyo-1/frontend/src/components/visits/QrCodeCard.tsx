import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type QrCodeCardProps = {
  value: string;
  title: string;
  description: string;
};

export function QrCodeCard({ value, title, description }: QrCodeCardProps) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      width: 220,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl("");
        }
      });

    return () => {
      active = false;
    };
  }, [value]);

  function handleDownload() {
    if (!dataUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    link.click();
  }

  async function handleShare() {
    const shareText = `${title}\n${description}\nCodigo: ${value}`;

    if (navigator.share) {
      await navigator.share({
        title,
        text: shareText,
      });
      return;
    }

    await navigator.clipboard.writeText(shareText);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR de ${title}`}
          className="mt-4 h-44 w-44 rounded-2xl border border-slate-200 bg-white object-contain"
        />
      ) : (
        <div className="mt-4 flex h-44 w-44 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-400">
          Generando QR...
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <Button type="button" variant="outline" onClick={handleDownload} className="rounded-2xl">
          <Download className="size-4" />
          Descargar
        </Button>
        <Button type="button" onClick={() => void handleShare()} className="rounded-2xl">
          <Share2 className="size-4" />
          Compartir
        </Button>
      </div>
    </div>
  );
}
