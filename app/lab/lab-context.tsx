"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card, demoProject, makeSheet, newProject, Project, Sheet, validateProject } from '@/lib/baseera/model';
import { uuid } from '@/lib/baseera/model';
import { importWorkbook } from '@/lib/baseera/io';
import { analyze, inspectSheet } from '@/lib/baseera/engine';
import { registerNavigationSave } from '@/lib/baseera/navigation';
type Draft = { project: Project; cloudVersion: number | null; undo?: Project[]; redo?: Project[] };
let draftQueue: Promise<unknown> = Promise.resolve();
function draft(value?: Project | null, cloudVersion: number | null = null, undo: Project[] = [], redo: Project[] = []): Promise<Draft | null> {
  const task = draftQueue.catch(() => {}).then(() => accessDraft(value, cloudVersion, undo, redo));
  draftQueue = task;
  return task;
}
function accessDraft(value?: Project | null, cloudVersion: number | null = null, undo: Project[] = [], redo: Project[] = []): Promise<Draft | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('baseera-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('draft');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('draft', value === undefined ? 'readonly' : 'readwrite'), store = tx.objectStore('draft');
      const operation = value === undefined ? store.get('current') : value === null ? store.delete('current') : store.put({ project: value, cloudVersion, undo, redo }, 'current');
      let saved: Draft | null = null;
      operation.onsuccess = () => { if (value === undefined) saved = operation.result?.version === 2 ? { project: operation.result, cloudVersion: null } : operation.result ?? null; };
      tx.oncomplete = () => { db.close(); resolve(saved); }; tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
type Context = {
  hydrated: boolean; project: Project | null; sheet: Sheet | null;
  profile: ReturnType<typeof inspectSheet> | null; result: ReturnType<typeof analyze> | null; analysisError: string;
  notice: string; setNotice: (s: string) => void; draftState: string;
  loadDemo: () => void; loadFile: (file: File) => Promise<void>; openProject: (p: Project, cloudVersion?: number) => void;
  updateSheet: (sheet: Sheet, description: string, affected: number) => void;
  updateProject: (fn: (p: Project) => Project) => void;
  switchSheet: (id: string) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
  addCard: (card: Omit<Card, 'id' | 'createdRevision'>) => void;
  reset: () => void; saveCloud: () => Promise<void>; saving: boolean; cloudState: string;
};
const LabContext = createContext<Context | null>(null);
export function LabProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<Project | null>(null), current = useRef<Project | null>(null);
  const [hydrated, setHydrated] = useState(false), [notice, setNotice] = useState(''), [draftState, setDraftState] = useState('');
  const [undoStack, renderUndo] = useState<Project[]>([]), [redoStack, renderRedo] = useState<Project[]>([]);
  const undoRef = useRef<Project[]>([]), redoRef = useRef<Project[]>([]);
  const setUndoStack = (value: Project[] | ((s: Project[]) => Project[])) => { undoRef.current = typeof value === 'function' ? value(undoRef.current) : value; renderUndo(undoRef.current); };
  const setRedoStack = (value: Project[] | ((s: Project[]) => Project[])) => { redoRef.current = typeof value === 'function' ? value(redoRef.current) : value; renderRedo(redoRef.current); };
  const [saving, setSaving] = useState(false), [cloudState, setCloudState] = useState('لم يُحفظ سحابيًا');
  const cloudVersion = useRef<number | null>(null);
  const commit = useCallback((p: Project | null) => { current.current = p; setProject(p); }, []);
  useEffect(() => {
    let mounted = true;
    draft().then(saved => {
      if (!mounted) return;
      if (saved) { commit(validateProject(saved.project));
        try { setUndoStack((saved.undo ?? []).slice(-20).map(validateProject)); setRedoStack((saved.redo ?? []).slice(-20).map(validateProject)); } catch { setUndoStack([]); setRedoStack([]); }
        cloudVersion.current = saved.cloudVersion; setCloudState(saved.cloudVersion ? 'نسخة مرتبطة بمشروع محفوظ؛ احفظ أحدث التعديلات' : 'لم يُحفظ سحابيًا'); }
      else {
        const legacy = sessionStorage.getItem('baseera-session');
        if (legacy) { const old = JSON.parse(legacy); if (old.rawRows?.length) { const keys = Object.keys(old.rawRows[0]); commit(newProject(old.fileName || 'ملف سابق', [makeSheet('البيانات', [keys, ...old.rawRows.map((r: Record<string, unknown>) => keys.map(k => r[k] ?? null))], 0)])); setNotice('استعدنا بيانات جلستك السابقة. راجع أنواع الأعمدة قبل التحليل.'); } }
      }
    }).catch(() => { if (mounted) setNotice('تعذر استعادة المسودة المحلية. يمكنك رفع نسخة مشروع محفوظة.'); }).finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, [commit]);
  useEffect(() => {
    if (!hydrated) return;
    let active = true; setDraftState('جارٍ حفظ المسودة…');
    draft(project, cloudVersion.current, undoRef.current, redoRef.current).then(() => { if (active) setDraftState(project ? 'مسودة على هذا الجهاز' : ''); }).catch(() => { if (active) setDraftState('تعذر حفظ المسودة — صدّر نسخة مشروع'); });
    return () => { active = false; };
  }, [project, hydrated]);
  useLayoutEffect(() => registerNavigationSave(async () => {
    try {
      if (!hydrated) throw new Error('انتظر لحظة حتى تكتمل استعادة مشروعك ثم حاول مجددًا.');
      setDraftState('جارٍ حفظ التقدم قبل الانتقال…');
      await draft(current.current, cloudVersion.current, undoRef.current, redoRef.current);
    } catch (error) {
      setNotice(!hydrated ? 'انتظر لحظة حتى تكتمل استعادة مشروعك ثم حاول مجددًا.' : 'تعذر حفظ التقدم؛ بقيت في الصفحة لحماية تعديلاتك. صدّر نسخة مشروع ثم حاول مجددًا.');
      throw error;
    }
  }), [hydrated]);
  const openProject = useCallback((p: Project, version?: number) => {
    commit(validateProject(p)); setUndoStack([]); setRedoStack([]); cloudVersion.current = version ?? null;
    setCloudState(version ? 'تم فتح المشروع المحفوظ' : 'لم يُحفظ سحابيًا'); setNotice('');
  }, [commit]);
  const updateProject = (fn: (p: Project) => Project) => { const p = current.current; if (!p) return; commit(validateProject({ ...fn(p), updatedAt: new Date().toISOString() })); setCloudState('تغييرات غير محفوظة سحابيًا'); };
  const updateSheet = (sheet: Sheet, description: string, affected: number) => {
    const p = current.current; if (!p) return;
    const next = validateProject({ ...p, revision: p.revision + 1, verifiedRevision: null, updatedAt: new Date().toISOString(), sheets: p.sheets.map(s => s.id === sheet.id ? sheet : s), history: [...p.history, { id: uuid(), at: new Date().toISOString(), sheetId: sheet.id, label: description, affected }].slice(-500) });
    const cells = p.sheets.reduce((n, s) => n + s.rows.length * s.columns.length, 0), limit = Math.max(2, Math.min(20, Math.floor(500000 / Math.max(1, cells))));
    setUndoStack(stack => [...stack, p].slice(-limit)); setRedoStack([]); commit(next); setCloudState('تغييرات غير محفوظة سحابيًا');
  };
  const travel = (direction: 'undo' | 'redo') => {
    const source = direction === 'undo' ? undoStack : redoStack, p = current.current, previous = source.at(-1); if (!p || !previous) return;
    const next = { ...p, sheets: previous.sheets, activeSheetId: previous.activeSheetId, activePlan: p.activeSheetId === previous.activeSheetId ? p.activePlan : null, revision: p.revision + 1, verifiedRevision: null, updatedAt: new Date().toISOString(), history: [...p.history, { id: uuid(), at: new Date().toISOString(), sheetId: previous.activeSheetId, label: direction === 'undo' ? 'تراجع عن آخر تعديل' : 'إعادة التعديل', affected: 0 }].slice(-500) };
    if (direction === 'undo') { setUndoStack(source.slice(0, -1)); setRedoStack(stack => [...stack, p]); } else { setRedoStack(source.slice(0, -1)); setUndoStack(stack => [...stack, p]); }
    commit(next); setCloudState('تغييرات غير محفوظة سحابيًا');
  };
  const sheet = project?.sheets.find(s => s.id === project.activeSheetId) ?? null;
  const profile = useMemo(() => sheet ? inspectSheet(sheet) : null, [sheet]);
  const computation = useMemo(() => { if (!sheet || !project?.activePlan) return { result: null, error: '' }; try { return { result: analyze(sheet, project.activePlan), error: '' }; } catch (e) { return { result: null, error: e instanceof Error ? e.message : 'تعذر حساب النتيجة.' }; } }, [sheet, project?.activePlan]);
  const saveCloud = async () => {
    const p = current.current; if (!p || saving) return;
    setSaving(true); setCloudState('جارٍ الحفظ…');
    try {
      const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p, expectedVersion: cloudVersion.current }) });
      const data = await response.json() as { error?: string; version: number }; if (!response.ok) throw new Error(data.error || 'تعذر حفظ المشروع.');
      if (current.current?.id === p.id) { cloudVersion.current = data.version; void draft(current.current, data.version, undoRef.current, redoRef.current).catch(() => setDraftState('تعذر تحديث المسودة المحلية؛ صدّر نسخة احتياطية')); setCloudState(current.current === p ? 'محفوظ سحابيًا' : 'حُفظت نسخة؛ لديك تعديلات أحدث'); }
    } catch (e) { setCloudState(e instanceof Error ? e.message : 'فشل الحفظ؛ بياناتك ما زالت في المسودة.'); } finally { setSaving(false); }
  };
  return <LabContext.Provider value={{ hydrated, project, sheet, profile, result: computation.result, analysisError: computation.error, notice, setNotice, draftState, cloudState, saving, saveCloud,
    loadDemo: () => openProject(demoProject()), loadFile: async file => openProject(await importWorkbook(file)), openProject, updateSheet, updateProject,
    switchSheet: id => updateProject(p => ({ ...p, activeSheetId: id, activePlan: null, verifiedRevision: null })),
    undo: () => travel('undo'), redo: () => travel('redo'), canUndo: !!undoStack.length, canRedo: !!redoStack.length,
    addCard: card => updateProject(p => ({ ...p, cards: [...p.cards, { ...card, id: uuid(), createdRevision: p.revision }] })),
    reset: () => { commit(null); cloudVersion.current = null; setUndoStack([]); setRedoStack([]); sessionStorage.removeItem('baseera-session'); setCloudState('لم يُحفظ سحابيًا'); },
  }}>{children}</LabContext.Provider>;
}
export function useLab() { const context = useContext(LabContext); if (!context) throw new Error('LabProvider required'); return context; }
