"use client";
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/app-link';
import { navigate } from '@/lib/baseera/navigation';
import { ArrowLeft, Database, FileSpreadsheet, Upload, Layers3, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLab } from './lab-context';
import { StepHead } from './components';
export default function UploadPage() {
  const { project, hydrated, loadFile, loadDemo } = useLab(), input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [drag, setDrag] = useState(false);
  const checkedDemo = useRef(false);
  useEffect(() => {
    if (!hydrated || checkedDemo.current) return;
    checkedDemo.current = true;
    if (!project && new URLSearchParams(window.location.search).get('demo') === '1') { loadDemo(); void navigate('/lab/profile', true).catch(() => {}); }
  }, [hydrated, project, loadDemo]);
  async function open(file?: File) {
    if (!file || busy) return;
    if (project && !window.confirm('فتح ملف جديد يستبدل المسودة الحالية. هل حفظت مشروعك أو صدّرت نسخة منه؟')) return;
    setBusy(true); setError('');
    try { await loadFile(file); void navigate('/lab/profile').catch(() => {}); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر قراءة الملف.'); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <><StepHead eyebrow="YOUR DATA, YOUR DECISIONS" title="خلّينا نفهم ملفك." text="ارفع ملفك، راجع بياناته وعدّلها، ثم ابنِ تحليلًا يمكنك تتبّع أرقامه."/>
    {project && <div className="notice mb-5 flex flex-wrap items-center justify-between gap-4"><div><b>مشروعك الحالي: {project.name}</b><p className="mt-1 text-sm text-slate-400">{project.sheets.length} أوراق · يمكنك المتابعة من حيث توقفت</p></div><Button asChild><Link href="/lab/profile">متابعة المشروع<ArrowLeft size={16}/></Link></Button></div>}
    <div className={`upload-zone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void open(e.dataTransfer.files[0]); }}>
      <div className="upload-icon"><FileSpreadsheet size={38}/></div><h2 className="text-2xl font-bold">كل الأوراق. كل الصفوف. بوضوح.</h2><p className="my-4 max-w-xl text-slate-400">اسحب الملف هنا أو اختره من جهازك. نتعامل مع القيم والجداول، ولا ننفّذ وحدات Macro أو صيغ الملف.</p>
      <input ref={input} type="file" aria-label="اختيار ملف بيانات" accept=".xlsx,.xls,.csv,.tsv,.baseera.json" className="sr-only" onChange={e => void open(e.target.files?.[0])}/>
      <Button size="lg" disabled={busy || !hydrated} onClick={() => input.current?.click()}><Upload size={18}/>{busy ? 'جارٍ قراءة الملف…' : 'اختيار ملف'}</Button><p className="mt-4 text-sm text-slate-500" dir="ltr">Excel · CSV · TSV · Baseera Project</p><p className="mt-2 text-xs text-slate-500">حتى 20 MB و250 ألف خلية و150 عمودًا لكل ورقة. الصف الأول للعناوين.</p>
    </div>{error && <p role="alert" className="error-box mt-4">{error}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-3">{[[Layers3, 'مساحة قابلة للتعديل', 'تنقّل بين الأوراق، وابحث وصفِّ وعدّل أي خلية.'], [ShieldCheck, 'الأصل محفوظ', 'احتفظ بالمصدر، وعاين التنظيف قبل تطبيقه.'], [Database, 'أرقام قابلة للمراجعة', 'التحليل يحسب من الصفوف؛ مع توضيح المستبعد والناقص.']].map(([Icon, title, text]) => { const I = Icon as typeof Database; return <div className="surface p-5" key={String(title)}><I className="mb-4 text-cyan-300" size={22}/><h3 className="font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{String(text)}</p></div>; })}</div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-5"><div><h3 className="font-bold">جرّب قبل أن ترفع ملفك</h3><p className="mt-1 text-sm text-slate-400">بيانات مبيعات اصطناعية، ورقتان، و145 صفًا فيها حالات تحتاج مراجعة.</p></div><Button variant="outline" disabled={!hydrated} onClick={() => { if (!project || window.confirm('استبدال المسودة الحالية ببيانات التجربة؟ احفظ مشروعك أولًا.')) { loadDemo(); void navigate('/lab/profile').catch(() => {}); } }}>افتح بيانات التجربة<ArrowLeft size={16}/></Button></div>
    <p className="mt-5 text-sm leading-7 text-slate-500">قراءة الملف والتحليل اليدوي يجريان على جهازك. الحفظ السحابي يرسل المشروع إلى حسابك؛ وطلب AI يرسل وصف الأعمدة والإحصاءات بعد موافقتك.</p>
  </>;
}
