"use client";
import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function DownloadTray() {
  const [file, setFile] = useState<{ url: string; name: string } | null>(null), active = useRef<string | null>(null);
  useEffect(() => {
    const ready = (event: Event) => {
      const detail = (event as CustomEvent<{ url: string; name: string }>).detail;
      if (active.current) URL.revokeObjectURL(active.current);
      active.current = detail.url; setFile(detail);
    };
    window.addEventListener('baseera-export-ready', ready);
    return () => { window.removeEventListener('baseera-export-ready', ready); if (active.current) URL.revokeObjectURL(active.current); };
  }, []);
  if (!file) return null;
  return <div className="fixed bottom-5 left-4 right-4 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-cyan-300/40 bg-[#0a1d33] p-4 shadow-2xl no-print" role="status"><Download className="shrink-0 text-cyan-300" size={22}/><div className="min-w-0 flex-1"><p className="text-sm font-bold">ملف التصدير جاهز</p><p className="truncate text-xs text-slate-400" dir="auto">{file.name}</p><a className="mt-2 inline-block text-sm text-cyan-200 underline underline-offset-4" href={file.url} download={file.name}>تنزيل الملف</a></div><Button variant="ghost" size="icon" aria-label="إغلاق ملف التصدير" onClick={() => { URL.revokeObjectURL(file.url); active.current = null; setFile(null); }}><X size={18}/></Button></div>;
}
