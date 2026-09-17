"use client";

import {FormEvent,useMemo,useState} from "react";
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {AlertTriangle,BrainCircuit,Check,Database,ListChecks,Play,Search,Send,ShieldCheck,Sparkles,Table2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {NativeSelect,NativeSelectOption} from "@/components/ui/native-select";
import {NeedData,StepActions,StepHead} from "../components";
import {useLab} from "../lab-context";
import {fmt} from "../data";

const suggestions=[
 "أين تتركز أعلى قيمة؟",
 "ما مشكلات الجودة المؤثرة؟",
 "ماذا تغيّر بعد التنظيف؟",
 "اكتب توصية مسؤولة",
];

type Mode="plan"|"running"|"done";

export default function Analyze(){
 const{rawRows,numericColumns,categoryColumns,metric,setMetric,dimension,setDimension,analysis,quality,cleanedRows,score}=useLab();
 const[draft,setDraft]=useState(suggestions[0]);
 const[question,setQuestion]=useState(suggestions[0]);
 const[mode,setMode]=useState<Mode>("plan");
 const top=analysis.chart[0];
 const intent=useMemo(()=>detectIntent(question),[question]);
 const plan=useMemo(()=>buildPlan(intent,metric,dimension),[intent,metric,dimension]);
 const evidenceStrength=Math.min(96,Math.max(48,Math.round(score*.65+Math.min(cleanedRows.length,30))));

 const insight=useMemo(()=>{
  if(intent==="quality")return `يحتوي الملف على ${quality.missing} قيمة مفقودة، و${quality.duplicates} صف مكرر، و${quality.negatives} قيمة سالبة. أثرها على النتيجة يعتمد على سياسة التنظيف المعتمدة.`;
  if(intent==="change")return `اعتمد التحليل ${cleanedRows.length} من أصل ${rawRows.length} صفًا. المجموع الحالي لـ ${metric} هو ${fmt.format(analysis.sum)} بمتوسط ${fmt.format(analysis.average)}.`;
  if(intent==="recommend")return top?`تظهر «${top.name}» كأعلى فئة في ${metric} بقيمة ${fmt.format(top.value)}. افحص الفترة والتكلفة وحجم العينة قبل تحويلها إلى قرار.`:"لا توجد قيم كافية لبناء توصية.";
  return top?`أعلى تجمّع ظاهر هو «${top.name}» بقيمة ${fmt.format(top.value)} من ${metric}. هذه ملاحظة وصفية ضمن الصفوف المعتمدة.`:"لا توجد قيم رقمية كافية للإجابة.";
 },[intent,quality,cleanedRows.length,rawRows.length,metric,analysis.sum,analysis.average,top]);

 if(!rawRows.length)return <NeedData/>;

 const prepare=(value=draft)=>{
  const q=value.trim();if(!q)return;
  const qLower=q.toLowerCase();
  const matchedMetric=numericColumns.find(c=>qLower.includes(c.toLowerCase()));
  const matchedDimension=categoryColumns.find(c=>qLower.includes(c.toLowerCase()));
  if(matchedMetric)setMetric(matchedMetric);
  if(matchedDimension)setDimension(matchedDimension);
  setDraft(q);setQuestion(q);setMode("plan");
 };
 const submit=(event:FormEvent)=>{event.preventDefault();prepare()};
 const run=()=>{setMode("running");window.setTimeout(()=>setMode("done"),650)};

 return <div className="analysis-lab">
  <StepHead eyebrow="05 · BASEERA AI ANALYSIS LAB" title="اسأل بياناتك. راجع الخطة. ثم شغّل التحليل." text="اكتب سؤالك بلغتك، ودع بصيرة تحوّله إلى خطة قابلة للفحص قبل تنفيذ أي حساب."/>

  <section className="analysis-command surface">
   <div className="analysis-command-head">
    <span className="ai-orb"><BrainCircuit className="h-5 w-5"/></span>
    <div><b>ما الذي تريد فهمه؟</b><p>بصيرة تقترح طريقة التحليل، والقرار النهائي يبقى لك.</p></div>
    <span className="analysis-status"><i/> محرك التحليل جاهز</span>
   </div>
   <form onSubmit={submit} className="analysis-prompt">
    <Search className="h-5 w-5"/>
    <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="مثال: أي منطقة حققت أعلى مبيعات؟" aria-label="سؤال التحليل"/>
    <Button type="submit" className="h-11 bg-blue-600 px-5 font-black hover:bg-blue-500">حلّل السؤال<Send className="mr-1 h-4 w-4"/></Button>
   </form>
   <div className="analysis-suggestions">{suggestions.map(q=><button key={q} onClick={()=>prepare(q)} className={question===q?"active":""}>{q}</button>)}</div>
  </section>

  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
   <div className="space-y-4">
    <section className="surface overflow-hidden">
     <div className="analysis-section-head"><div><span>خطة التحليل</span><h2>كيف ستجيب بصيرة؟</h2></div><span className="analysis-intent"><Sparkles className="h-3.5 w-3.5"/>{intentLabel(intent)}</span></div>
     <div className="analysis-plan">{plan.map((item,i)=><div key={item.title} className="analysis-plan-step"><span>{i+1}</span><div><b>{item.title}</b><p>{item.text}</p></div>{mode==="done"&&<Check className="mr-auto h-4 w-4 text-emerald-300"/>}</div>)}</div>
     <div className="analysis-controls">
      <label className="field-label">المؤشر الذي سنقيسه<NativeSelect value={metric} onChange={e=>{setMetric(e.target.value);setMode("plan")}}>{numericColumns.map(c=><NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}</NativeSelect></label>
      <label className="field-label">المقارنة حسب<NativeSelect value={dimension} onChange={e=>{setDimension(e.target.value);setMode("plan")}}>{categoryColumns.map(c=><NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}</NativeSelect></label>
      <Button onClick={run} disabled={mode==="running"} className="h-11 self-end bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Play className="ml-2 h-4 w-4"/>{mode==="running"?"جاري التحليل…":mode==="done"?"أعد تشغيل التحليل":"شغّل الخطة"}</Button>
     </div>
    </section>

    {mode!=="done"?<section className="analysis-waiting surface"><span className={mode==="running"?"processing":""}><Sparkles className="h-7 w-7"/></span><div><h3>{mode==="running"?"بصيرة تفحص الصفوف والحسابات…":"الخطة جاهزة للمراجعة"}</h3><p>{mode==="running"?"نربط السؤال بالمؤشر، ننفذ التجميع، ثم نختبر حدود النتيجة.":"راجع المؤشر والمقارنة، ثم شغّل الخطة عندما تصبح مناسبة لسؤالك."}</p></div></section>:
    <>
     <section className="analysis-result surface">
      <div className="analysis-section-head"><div><span>النتيجة الرئيسية</span><h2>{question}</h2></div><span className="evidence-badge"><ShieldCheck className="h-4 w-4"/>قوة الدليل {evidenceStrength}%</span></div>
      <div className="analysis-insight"><Sparkles className="h-5 w-5"/><p>{insight}</p></div>
      <div className="analysis-kpis"><Kpi label="المجموع" value={fmt.format(analysis.sum)}/><Kpi label="عدد القيم" value={fmt.format(analysis.count)}/><Kpi label="المتوسط" value={fmt.format(analysis.average)}/><Kpi label="الصفوف المعتمدة" value={`${cleanedRows.length}/${rawRows.length}`}/></div>
      <div className="analysis-chart" dir="ltr"><ResponsiveContainer><BarChart data={analysis.chart} margin={{top:12,right:8,left:0,bottom:2}}><CartesianGrid vertical={false} stroke="#ffffff10"/><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} width={52}/><Tooltip cursor={{fill:'#38bdf80b'}} contentStyle={{background:'#09162b',border:'1px solid #ffffff1a',borderRadius:12,color:'#e2e8f0'}}/><Bar dataKey="value" fill="#55dfff" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div>
     </section>
     <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="surface overflow-hidden"><div className="analysis-mini-head"><Table2 className="h-4 w-4"/><b>الدليل المستخدم</b><span>أعلى 5 فئات</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{dimension}</th><th>{metric}</th><th>عدد الصفوف</th></tr></thead><tbody>{analysis.chart.slice(0,5).map(row=><tr key={row.name}><td>{row.name}</td><td>{fmt.format(row.value)}</td><td>{fmt.format(row.rows)}</td></tr>)}</tbody></table></div></div>
      <div className="surface p-5"><div className="analysis-mini-head px-0 pt-0"><AlertTriangle className="h-4 w-4 text-amber-300"/><b>حدود الاستنتاج</b></div><p className="mt-4 text-sm leading-7 text-slate-400">النتيجة تصف البيانات الموجودة فقط. لا تثبت السبب، ولا الربحية، ولا أن النمط سيستمر مستقبلًا.</p><div className="mt-4 rounded-xl border border-cyan-300/12 bg-cyan-300/5 p-3 text-xs leading-6 text-cyan-100">الخطوة المقترحة: راجع الفترة، التكلفة، وحجم العينة قبل اتخاذ القرار.</div></div>
     </section>
    </>}
   </div>

   <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
    <section className="surface p-5"><div className="analysis-side-title"><Database className="h-4 w-4"/><b>سياق البيانات</b></div><dl className="analysis-context"><div><dt>الملف الأصلي</dt><dd>{rawRows.length} صف</dd></div><div><dt>بعد التنظيف</dt><dd>{cleanedRows.length} صف</dd></div><div><dt>أعمدة رقمية</dt><dd>{numericColumns.length}</dd></div><div><dt>أعمدة وصفية</dt><dd>{categoryColumns.length}</dd></div></dl></section>
    <section className="surface p-5"><div className="analysis-side-title"><ListChecks className="h-4 w-4"/><b>لماذا هذه الخطة؟</b></div><p className="mt-4 text-sm leading-7 text-slate-400">فهمت بصيرة السؤال على أنه <strong className="text-cyan-200">{intentLabel(intent)}</strong>؛ لذلك ربطته بالمؤشر <strong className="text-white">{metric}</strong> وقارنته حسب <strong className="text-white">{dimension}</strong>.</p></section>
    <section className="surface p-5"><div className="analysis-side-title"><ShieldCheck className="h-4 w-4"/><b>وضع التحقق</b></div><div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-300/12 bg-emerald-300/5 p-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-300/10 text-emerald-300"><Check className="h-4 w-4"/></span><div><b className="text-sm">الحساب قابل للتتبع</b><p className="mt-1 text-xs text-slate-500">يمكنك رؤية المؤشر والصفوف المستخدمة.</p></div></div></section>
   </aside>
  </div>
  <StepActions prev="/lab/clean" next="/lab/dashboard" nextLabel="صمّم اللوحة"/>
 </div>
}

function detectIntent(question:string){const q=question.toLowerCase();if(/جود|مفقود|تكرار|مشكلة|خطأ/.test(q))return"quality";if(/تغيّر|تغير|تنظيف|قبل|بعد/.test(q))return"change";if(/توصية|قرار|أنصح|اقترح/.test(q))return"recommend";return"compare"}
function intentLabel(intent:string){return intent==="quality"?"فحص جودة":intent==="change"?"قياس أثر التنظيف":intent==="recommend"?"توصية مدعومة":"مقارنة وصفية"}
function buildPlan(intent:string,metric:string,dimension:string){const core=[{title:"تحديد نطاق السؤال",text:`قياس ${metric} ضمن الصفوف المعتمدة فقط.`},{title:"تنفيذ المقارنة",text:`تجميع القيم حسب ${dimension} وترتيب النتائج.`}];if(intent==="quality")core[1]={title:"فحص إشارات الجودة",text:"حساب المفقود والتكرار والقيم غير المتسقة."};if(intent==="change")core[1]={title:"مقارنة أثر المعالجة",text:"مقارنة عدد الصفوف والمؤشر قبل التنظيف وبعده."};return[...core,{title:"اختبار النتيجة",text:"عرض الدليل وحدود ما يمكن استنتاجه من الملف."}]}
function Kpi({label,value}:{label:string;value:string}){return <div className="analysis-kpi"><span>{label}</span><b>{value}</b></div>}
