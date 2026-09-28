import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, ArrowLeft, ArrowRight, BookOpen, Box, Check, ChevronDown, ClipboardList, Copy, Download,
  FileText, FolderOpen, History, Layers3, Lightbulb, LoaderCircle, MonitorPlay, Plus,
  RefreshCw, Search, Settings2, Sparkles, Target, Trash2, UploadCloud, WandSparkles, X,
  ChevronLeft, ChevronRight, Eye, MoveDown, MoveUp,
} from 'lucide-react'

type FormState = {
  stage: string; grade: string; subject: string; topic: string; lessonType: string
  duration: string; classSize: string; learningSituation: string; objectives: string
  keyPoints: string; difficulties: string; methods: string; resources: string
  assessment: string; homework: string; textbookVersion: string; chapter: string
  unitPosition: string; teachingScene: string; priorKnowledge: string; misconceptions: string
  examPoints: string; coreQuestion: string; materialName: string; materialText: string
  materialPolicy: string; pptTheme: string; pptLength: string; visualBalance: string
  teachingRhythm: string; answerReveal: string; speakerNotes: string; highlightExam: string
  use3d: string
  field: string; courseName: string; semester: string; courseType: string; credits: string; courseHours: string
  prerequisites: string; learningOutcomes: string; assessmentMethod: string
  includeCase: string; includeExperiment: string; includeResearch: string
}
type Reference = { title: string; author: string; year: string; sourceType: string; sourceUrl: string; license: string; usedIn: string[] }
type BioPart = { key: string; name: string; englishName: string; color: string }
type BioModelPlan = { modelKey: string; modelName: string; parts: string[]; partDetails: BioPart[]; observationTasks: string[]; renderMode: string; references: Reference[]; quality?: string }
type BioResult = BioModelPlan & { status: string; editable: boolean; message: string; blendUrl: string; glbUrl: string; previewUrl: string }
type ArtifactState = Partial<Record<'pptx' | 'glb' | 'blend' | 'preview', string>>
type SlidePlan = { type?: string; title: string; subtitle?: string; items?: string[]; purpose?: string; visual?: string; interaction?: string; layout?: string; proof?: string; assetQuery?: string; visualProfile?: string }
type SlidePreview = SlidePlan & { index: number; sourceIndex?: number; previewSvg: string }
type QualityReport = { score: number; blocking: { code: string; slide?: number; message: string }[]; warnings: { code: string; slide?: number; message: string }[]; slideCount: number; layouts: string[] }
type AssetCandidate = { sourceType: string; localPath: string; sourceUrl: string; license: string; altText: string; cropMode: string; subjectTags: string[]; thumbnail?: string }
type LessonPlan = {
  id: string; createdAt: string; title: string; overview: string; objectives: string[]
  situation: string; keyPoints: string[]; difficulties: string[]; methods: string[]
  resources: string; assessment: string; homework: string; blackboard: string[]
  phases: { time: number; name: string; teacher: string; student: string; check: string }[]
  slides: SlidePlan[]
  request: FormState
  courseProfile?: { stage: string; field: string; courseName: string; courseType: string; semester: string; credits: string; courseHours: string }
  learningOutcomes?: string[]; prerequisites?: string[]; knowledgeMap?: string[]; casePrompt?: string; assessmentPlan?: string[]
  references?: Reference[]; modelPlan?: BioModelPlan
}
type RecordItem = { id: string; title: string; subject: string; grade: string; updatedAt: string; plan: LessonPlan }
type BusyState = 'preview' | 'ppt' | '3d' | 'bundle' | null
type ModelOptions = { textureResolution: string; foregroundRatio: string; vertexCount: string; removeBackground: boolean }
type ModelMode = 'single' | 'multiview'
type ModelViews = Partial<Record<'front' | 'top' | 'left' | 'right' | 'bottom', File>>
type ImageModelResult = { status: string; editable: boolean; message: string; glbUrl: string; blendUrl: string; previewUrl: string; parts: { name: string; partKey: string; source: string }[] }

const initialForm: FormState = {
  stage: '高中', grade: '高一', subject: '数学', topic: '函数的单调性', lessonType: '新授课', duration: '45', classSize: '40人',
  textbookVersion: '人教A版', chapter: '第三章 函数的概念与性质', unitPosition: '单元核心概念课', teachingScene: '日常课堂',
  learningSituation: '学生已经接触过函数图像与坐标系，但对“变化趋势”的语言表达还不够稳定。',
  priorKnowledge: '函数图像、定义域、坐标系中的点与变化趋势',
  misconceptions: '把某一段图像上升误认为函数在整个定义域单调递增\n只看函数值大小，不比较自变量的先后关系',
  examPoints: '根据图像判断单调区间\n用定义证明函数单调性\n利用单调性比较函数值大小',
  coreQuestion: '怎样把图像上的“上升或下降”转化为准确的数学语言？',
  objectives: '理解函数单调性的概念与几何意义\n能用定义或图像判断函数的单调区间\n在真实问题中表达变化趋势并解释结论',
  keyPoints: '建立“自变量增大时函数值如何变化”的概念模型\n用图像和符号语言互相验证',
  difficulties: '把直观图像转化为严谨的区间表述\n区分单调递增与函数值变大的局部现象',
  methods: '问题驱动\n合作探究\n即时评价', resources: '教材、函数图像卡片、投影课件',
  assessment: '观察小组表达、判断练习正确率、出口条自评', homework: '完成课本基础练习，并用一句话解释一个生活中的单调变化。',
  materialName: '', materialText: '', materialPolicy: '教材优先，允许补充', pptTheme: '自动推荐', pptLength: '标准',
  visualBalance: '图文均衡', teachingRhythm: '互动型', answerReveal: '包含', speakerNotes: '包含', highlightExam: '突出', use3d: '按需使用',
  field: '生物医学', courseName: '人体解剖学与生理学', semester: '大一上', courseType: '专业核心课', credits: '2', courseHours: '32',
  prerequisites: '', learningOutcomes: '', assessmentMethod: '', includeCase: '包含', includeExperiment: '包含', includeResearch: '不包含',
}

const undergraduateDefaults: Partial<FormState> = {
  stage: '本科', grade: '大一', subject: '生物医学', topic: '心脏血流与心脏结构', duration: '45', lessonType: '新授课',
  textbookVersion: '', chapter: '', unitPosition: '结构与功能', learningSituation: '', priorKnowledge: '', misconceptions: '', examPoints: '',
  coreQuestion: '', objectives: '', keyPoints: '', difficulties: '', methods: '', resources: '', assessment: '', homework: '',
  pptTheme: '医学高对比', pptLength: '标准', teachingRhythm: '理论·结构·案例', highlightExam: '不突出', use3d: '按需使用',
}

const splitLines = (value: string) => value.split('\n').map((x) => x.trim()).filter(Boolean)
const slideLayoutOptions = [
  ['hero-stack', '封面叙事'], ['question-split', '核心问题'], ['three-column', '三栏探索'],
  ['source-quote', '教材引文'], ['layer-map', '概念层级'], ['step-flow', '方法步骤'],
  ['compare-duo', '观点对照'], ['task-timer', '练习计时'], ['evidence-list', '迁移检测'],
  ['answer-rail', '答案揭示'], ['exam-map', '考点地图'], ['observation-stage', '观察任务'],
  ['loop-summary', '课堂总结'], ['take-home', '作业任务'],
] as const
const formToPayload = (form: FormState) => ({ ...form, duration: Number(form.duration) || 45, objectives: splitLines(form.objectives), keyPoints: splitLines(form.keyPoints), difficulties: splitLines(form.difficulties), methods: splitLines(form.methods) })
const recordKey = 'teacher-studio.records.v1'

type PrepStudioProps = {
  onBack: () => void
}

function PrepStudio({ onBack }: PrepStudioProps) {
  const [view, setView] = useState<'new' | 'records' | 'knowledge'>('new')
  const [form, setForm] = useState<FormState>(initialForm)
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [busy, setBusy] = useState<BusyState>(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [modelUrl, setModelUrl] = useState('')
  const [bioResult, setBioResult] = useState<BioResult | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactState>({})
  const [pptArtifact, setPptArtifact] = useState<{ downloadUrl: string; fileName: string } | null>(null)
  const schoolForm = useRef(initialForm)
  const [threeDConfigured, setThreeDConfigured] = useState<boolean | null>(null)
  const [prepStep, setPrepStep] = useState<1 | 2 | 3 | 4>(1)
  const updatePlan = (next: LessonPlan) => {
    if (JSON.stringify(next.modelPlan) !== JSON.stringify(plan?.modelPlan) || next.id !== plan?.id) {
      setBioResult(null); setModelUrl(''); setArtifacts({}); setPptArtifact(null)
    } else { setPptArtifact(null); setArtifacts((current) => ({ ...current, pptx: 'pending' })) }
    setPlan(next)
  }

  useEffect(() => { try { setRecords(JSON.parse(localStorage.getItem(recordKey) || '[]')) } catch { setRecords([]) } }, [])
  useEffect(() => { fetch('/api/prep/3d/status').then((response) => response.json()).then((data) => setThreeDConfigured(Boolean(data.configured))).catch(() => setThreeDConfigured(false)) }, [])
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer) } }, [toast])
  const update = (key: keyof FormState, value: string) => setForm((current) => {
    if (key === 'stage' && value === '本科' && current.stage !== '本科') {
      schoolForm.current = current
      return { ...current, ...undergraduateDefaults }
    }
    if (key === 'stage' && current.stage === '本科' && value !== '本科') return { ...schoolForm.current, stage: value }
    if (current.stage === '本科' && (key === 'objectives' || key === 'learningOutcomes')) return { ...current, objectives: value, learningOutcomes: value }
    return { ...current, [key]: value }
  })
  const sample = () => { setForm(form.stage === '本科' ? { ...initialForm, ...undergraduateDefaults } : initialForm); setPlan(null); setBioResult(null); setArtifacts({}); setPptArtifact(null); setToast(form.stage === '本科' ? '已载入本科心脏示例' : '已载入高中数学示例') }
  const selectMaterial = async (file: File | null) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { setToast('资料文件不能超过 15 MB'); return }
    const body = new FormData(); body.append('material', file)
    try {
      const response = await fetch('/api/prep/material/parse', { method: 'POST', body })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '资料解析失败')
      setForm((current) => ({ ...current, materialName: file.name, materialText: data.text || '' }))
      setToast(`已提取 ${data.characters || 0} 个字符，可在下方检查和修改`)
    } catch (error) { setToast(error instanceof Error ? error.message : '资料解析失败') }
  }
  const generatePlan = async () => {
    if (!form.subject.trim() || !form.topic.trim() || (form.stage !== '本科' && !form.objectives.trim())) { setToast('请先填写学科、课题和至少一条教学目标'); return }
    setBusy('preview')
    try {
      const response = await fetch('/api/prep/lesson/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formToPayload(form)) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '生成失败')
      setPlan({ ...data.lessonPlan, request: { ...form } }); setBioResult(null); setArtifacts({}); setPptArtifact(null); setModelUrl(''); setToast('教案已生成，可继续修改或备案')
    } catch (error) { setToast(error instanceof Error ? error.message : '生成失败，请确认本地 API 已启动') } finally { setBusy(null) }
  }
  const saveRecord = () => {
    if (!plan) return
    const item: RecordItem = { id: plan.id, title: plan.title, subject: plan.request.subject, grade: plan.request.grade, updatedAt: new Date().toISOString(), plan }
    const next = [item, ...records.filter((record) => record.id !== item.id)].slice(0, 30)
    setRecords(next); localStorage.setItem(recordKey, JSON.stringify(next)); setToast('已保存到本地备案')
  }
  const triggerDownload = (url: string, fileName: string) => { const link = document.createElement('a'); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove() }
  const requestPpt = async () => {
    if (!plan) throw new Error('还没有可生成的教案')
    const response = await fetch('/api/prep/ppt/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: plan }) })
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'PPT 生成失败')
    setPptArtifact(data); setArtifacts((current) => ({ ...current, pptx: 'generated' }))
    triggerDownload(data.downloadUrl, data.fileName)
    return data
  }
  const requestImageModel = async (mode: ModelMode, file: File | null, views: ModelViews, options: ModelOptions) => {
    const body = new FormData()
    if (mode === 'single') {
      if (!file) throw new Error('请先上传一张图片')
      body.append('image', file)
    } else {
      for (const view of ['front', 'top', 'left', 'right', 'bottom'] as const) {
        if (!views[view]) throw new Error(`请补齐${view === 'front' ? '正面' : view === 'top' ? '上面' : view === 'left' ? '左侧' : view === 'right' ? '右侧' : '底部'}图`)
        body.append(view, views[view]!)
      }
    }
    body.append('texture_resolution', options.textureResolution)
    body.append('foreground_ratio', options.foregroundRatio)
    body.append('vertex_count', options.vertexCount)
    body.append('remove_bg', String(options.removeBackground))
    body.append('remesh', 'none')
    const response = await fetch(mode === 'single' ? '/api/prep/3d/generate-image' : '/api/prep/3d/generate-multiview-model', { method: 'POST', body })
    if (!response.ok) {
      let message = `3D 生成失败（${response.status}）`
      try { const data = await response.json(); message = data.error || message } catch { const text = await response.text(); if (text) message = text }
      throw new Error(message)
    }
    const data = await response.json()
    if (!data.glbUrl) throw new Error(data.message || '模型文件未生成')
    setModelUrl(data.glbUrl)
    return data
  }
  const request3dDemo = async (file: File) => {
    const body = new FormData(); body.append('image', file)
    const response = await fetch('/api/prep/3d/demo', { method: 'POST', body })
    if (!response.ok) throw new Error('本地演示模型生成失败')
    const url = URL.createObjectURL(await response.blob())
    setModelUrl((current) => { if (current) URL.revokeObjectURL(current); return url })
    return url
  }
  const generatePpt = async () => {
    if (!plan) return
    setBusy('ppt')
    try { await requestPpt(); setToast('PPTX 已生成并开始下载') }
    catch (error) { setToast(error instanceof Error ? error.message : 'PPT 生成失败') }
    finally { setBusy(null) }
  }
  const generate3d = async (file: File | null, options: ModelOptions, mode: ModelMode = 'single', views: ModelViews = {}) => {
    if (plan?.modelPlan) {
      setBusy('3d'); setArtifacts((current) => ({ ...current, glb: 'generating', blend: 'generating', preview: 'generating' })); setBioResult(null)
      try {
        const response = await fetch('/api/prep/biomed/model/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: plan }) })
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '模型生成失败')
        setBioResult(data); setModelUrl(data.glbUrl || '')
        setArtifacts((current) => ({ ...current, glb: data.status === 'generated' ? 'generated' : data.glbUrl ? 'fallback' : 'unavailable', blend: data.blendUrl ? 'generated' : 'unavailable', preview: data.previewUrl ? 'generated' : 'unavailable' }))
        setToast(data.message)
        return data
      } catch (error) { setArtifacts((current) => ({ ...current, glb: 'failed', blend: 'failed', preview: 'failed' })); setToast(error instanceof Error ? error.message : '模型生成失败') }
      finally { setBusy(null) }
      return
    }
    if (mode === 'single' && !file) { setToast('请先上传一张用于建模的 PNG 或 JPG 图片'); return }
    if (mode === 'multiview' && ['front', 'top', 'left', 'right', 'bottom'].some((key) => !views[key as keyof ModelViews])) { setToast('请先补齐五个视角图片'); return }
    setBusy('3d')
    try {
      const result = await requestImageModel(mode, file, views, options)
      setToast(result.editable ? result.message : `${result.message}；当前为本地演示结果`)
      return result as ImageModelResult
    }
    catch (error) { setToast(error instanceof Error ? error.message : '3D 生成失败') }
    finally { setBusy(null) }
  }
  
  const generateBundle = async (file: File | null, options: ModelOptions) => {
    if (!plan) return
    if (plan.modelPlan) {
      setBusy('bundle'); setBioResult(null); setPptArtifact(null); setArtifacts({ pptx: 'generating', glb: 'generating', blend: 'generating', preview: 'generating' })
      try {
        const response = await fetch('/api/prep/course/generate-bundle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: plan }) })
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '组合生成失败')
        setBioResult(data.model); setModelUrl(data.model.glbUrl || ''); setArtifacts(data.artifacts); setPptArtifact(data.pptx)
        triggerDownload(data.pptx.downloadUrl, data.pptx.fileName)
        setToast(data.model.status === 'generated' ? 'PPTX、GLB、Blender 工程和预览图均已生成' : `PPTX 已生成；${data.model.message}`)
      } catch (error) { setArtifacts({ pptx: 'failed', glb: 'failed', blend: 'failed', preview: 'failed' }); setToast(error instanceof Error ? error.message : '组合生成失败') }
      finally { setBusy(null) }
      return
    }
    if (!file) { setToast('请先在3D模型面板上传图片，再使用一键生成 PPT + 3D'); return }
    setBusy('bundle')
    const results = await Promise.allSettled([requestPpt(), requestImageModel('single', file, {}, options)])
    const pptOk = results[0].status === 'fulfilled'
    const modelOk = results[1].status === 'fulfilled'
    setToast(pptOk && modelOk ? (threeDConfigured ? 'PPTX 和 3D 模型都已生成' : 'PPTX 和本地演示模型都已生成') : `组合生成完成：${pptOk ? 'PPT 成功' : 'PPT 失败'}，${modelOk ? '3D 成功' : '3D 失败'}`)
    setBusy(null)
  }
  const openRecord = (item: RecordItem) => { setForm({ ...initialForm, ...item.plan.request }); updatePlan({ ...item.plan, request: { ...initialForm, ...item.plan.request } }); setView('new'); setToast('已打开备案记录') }
  const deleteRecord = (id: string) => { const next = records.filter((record) => record.id !== id); setRecords(next); localStorage.setItem(recordKey, JSON.stringify(next)); setToast('备案已删除') }
  const filteredRecords = useMemo(() => records.filter((record) => `${record.title}${record.subject}${record.grade}`.toLowerCase().includes(query.toLowerCase())), [records, query])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Layers3 size={18} /></div><div><strong>数智备课</strong><span>教案 · PPT · 3D</span></div></div>
      <div className="side-section-label">工作空间</div>
      <nav className="nav-list">
        <button className={view === 'new' ? 'nav-item active' : 'nav-item'} onClick={() => setView('new')}><Plus size={17} />新建教案</button>
        <button className={view === 'records' ? 'nav-item active' : 'nav-item'} onClick={() => setView('records')}><Archive size={17} />备案记录 <em>{records.length || ''}</em></button>
        <button className={view === 'knowledge' ? 'nav-item active' : 'nav-item'} onClick={() => setView('knowledge')}><BookOpen size={17} />知识库 <span className="soon">后续</span></button>
      </nav>
      <button className="nav-item prep-back" type="button" onClick={onBack}><ArrowLeft size={17} />返回 3D 课堂</button>
      <div className="sidebar-bottom"><div className="status-dot" /><div><strong>本地工作模式</strong><span>内容保存在当前浏览器</span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="eyebrow">TEACHER WORKSPACE / 01</div><h1>{view === 'new' ? '新建教案' : view === 'records' ? '备案记录' : '知识库'}</h1></div><div className="top-actions"><span className="saved-state"><Check size={15} /> 自动保存已开启</span><button className="avatar">林</button></div></header>
      {view === 'new' && <>
        <div className="stepper"><div className="step done"><span>01</span><div><strong>教学需求</strong><small>结构化输入</small></div></div><div className="step-line done" /><div className={plan ? 'step done' : 'step current'}><span>02</span><div><strong>教案预览</strong><small>编辑与备案</small></div></div><div className="step-line" /><div className="step"><span>03</span><div><strong>PPT 生成</strong><small>可编辑课件</small></div></div></div>
        <div className="workspace-grid">
          <section className="form-panel">
            <div className="panel-heading"><div><span className="section-kicker">INPUT</span><h2>教学需求</h2><p>把一节课的关键约束写清楚，生成内容会更贴近课堂。</p></div><button className="ghost-btn" onClick={sample}><Sparkles size={15} />载入示例</button></div>
            <div className="prep-nav" aria-label="备课步骤">
              {([[1, '课程信息', '课题与教材'], [2, '教材学情', '资料与基础'], [3, '教学侧重', '目标与考点'], [4, '课件设置', '版式与节奏']] as const).map(([step, title, note]) => <button key={step} className={prepStep === step ? 'prep-step active' : 'prep-step'} onClick={() => setPrepStep(step)}><span>{String(step).padStart(2, '0')}</span><div><strong>{title}</strong><small>{note}</small></div></button>)}
            </div>
            {prepStep === 1 && <div className="form-stage">
              <div className="form-block stage-first"><div className="block-title"><span>课程与教材</span></div>
                <div className="field-grid three"><SelectField label="学段" value={form.stage} options={['小学','初中','高中','本科']} onChange={(v) => update('stage', v)} /><Field label="年级" value={form.grade} onChange={(v) => update('grade', v)} /><Field label="学科" value={form.subject} onChange={(v) => update('subject', v)} required /></div>
                <div className="field-grid"><Field label="课题名称" value={form.topic} onChange={(v) => update('topic', v)} required /><SelectField label="课型" value={form.lessonType} options={['新授课','复习课','习题课','讲评课','实验课','活动课','专题复习课']} onChange={(v) => update('lessonType', v)} /></div>
                <div className="field-grid three"><Field label="教材版本" value={form.textbookVersion} onChange={(v) => update('textbookVersion', v)} /><Field label="册次 / 章节" value={form.chapter} onChange={(v) => update('chapter', v)} /><Field label="单元位置" value={form.unitPosition} onChange={(v) => update('unitPosition', v)} /></div>
                <div className="field-grid three"><SelectField label="授课场景" value={form.teachingScene} options={['日常课堂','公开课','考试复习','教研展示']} onChange={(v) => update('teachingScene', v)} /><Field label="课时（分钟）" value={form.duration} onChange={(v) => update('duration', v)} /><Field label="班级规模" value={form.classSize} onChange={(v) => update('classSize', v)} /></div>
              </div>
              {form.stage === '本科' && <div className="form-block undergraduate-fields"><div className="block-title"><span>本科课程设计</span><small>基础生物医学</small></div>
                <div className="field-grid"><Field label="专业方向" value={form.field} onChange={(v) => update('field', v)} /><Field label="课程名称" value={form.courseName} onChange={(v) => update('courseName', v)} /></div>
                <div className="field-grid"><Field label="年级 / 学期" value={form.semester} onChange={(v) => update('semester', v)} /><SelectField label="课程性质" value={form.courseType} options={['专业核心课','专业选修课','实验课','专题课']} onChange={(v) => update('courseType', v)} /></div>
                <div className="field-grid"><Field label="学分" value={form.credits} onChange={(v) => update('credits', v)} /><Field label="课程总学时" value={form.courseHours} onChange={(v) => update('courseHours', v)} /></div>
                <TextArea label="先修课程 / 知识" value={form.prerequisites} onChange={(v) => update('prerequisites', v)} rows={2} />
                <TextArea label="学习成果" value={form.learningOutcomes} onChange={(v) => update('learningOutcomes', v)} rows={3} />
                <TextArea label="考核方式与评分标准" value={form.assessmentMethod} onChange={(v) => update('assessmentMethod', v)} rows={3} />
                <div className="bio-toggles">{([['includeCase','病例讨论'],['includeExperiment','实验观察'],['includeResearch','科研阅读']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={form[key] === '包含'} onChange={(e) => update(key,e.target.checked ? '包含' : '不包含')} />{label}</label>)}</div>
              </div>}
            </div>}
            {prepStep === 2 && <div className="form-stage">
              <div className="form-block stage-first"><div className="block-title"><span>教材资料</span><small>上传后提取内容，作为生成依据</small></div><label className="material-upload"><UploadCloud size={19} /><div><strong>{form.materialName || '选择教材或备课资料'}</strong><span>支持 TXT、Markdown、DOCX、文本型 PDF，单文件不超过 15 MB</span></div><input type="file" accept=".txt,.md,.docx,.pdf" onChange={(event) => selectMaterial(event.target.files?.[0] || null)} /></label><div className="field-grid"><SelectField label="资料使用方式" value={form.materialPolicy} options={['严格依据教材','教材优先，允许补充','仅作为生成参考']} onChange={(v) => update('materialPolicy', v)} /><div className="field"><span>已识别资料</span><div className="material-filename">{form.materialName || '尚未上传'}</div></div></div><TextArea label="提取内容（可检查和修改）" value={form.materialText} onChange={(v) => update('materialText', v)} rows={6} /></div>
              <div className="form-block"><div className="block-title"><span>学生基础</span><small>决定讲解起点与支架</small></div><TextArea label="学情分析" value={form.learningSituation} onChange={(v) => update('learningSituation', v)} rows={3} /><div className="field-grid two"><TextArea label="前置知识" value={form.priorKnowledge} onChange={(v) => update('priorKnowledge', v)} rows={3} /><TextArea label="常见错误与认知障碍" value={form.misconceptions} onChange={(v) => update('misconceptions', v)} rows={3} /></div></div>
            </div>}
            {prepStep === 3 && <div className="form-stage">
              <div className="form-block stage-first"><div className="block-title"><span>教学主线</span></div><TextArea label="本课核心问题" value={form.coreQuestion} onChange={(v) => update('coreQuestion', v)} rows={2} /><div className="field-grid two"><TextArea label="教学目标" value={form.objectives} onChange={(v) => update('objectives', v)} rows={4} required={form.stage !== '本科'} /><TextArea label="教学重点" value={form.keyPoints} onChange={(v) => update('keyPoints', v)} rows={4} /></div><div className="field-grid two"><TextArea label="教学难点" value={form.difficulties} onChange={(v) => update('difficulties', v)} rows={3} />{form.stage === '本科' ? <TextArea label="课程考核目标" value={form.assessmentMethod} onChange={(v) => update('assessmentMethod', v)} rows={3} /> : <TextArea label="高频考点与典型题型" value={form.examPoints} onChange={(v) => update('examPoints', v)} rows={3} />}</div></div>
              <div className="form-block"><div className="block-title"><span>课堂闭环</span><small>活动、评价与作业</small></div><div className="field-grid two"><TextArea label="教学方法" value={form.methods} onChange={(v) => update('methods', v)} rows={3} /><TextArea label="教学资源" value={form.resources} onChange={(v) => update('resources', v)} rows={3} /></div><div className="field-grid two"><TextArea label="课堂评价" value={form.assessment} onChange={(v) => update('assessment', v)} rows={3} /><TextArea label="课后作业" value={form.homework} onChange={(v) => update('homework', v)} rows={3} /></div></div>
            </div>}
            {prepStep === 4 && <div className="form-stage">
              <div className="form-block stage-first"><div className="block-title"><span>PPT 生成偏好</span></div><div className="setting-grid"><SelectField label="视觉主题" value={form.pptTheme} options={form.stage === '本科' ? ['医学高对比'] : ['自动推荐','课堂故事化','考试复习','科技展示']} onChange={(v) => update('pptTheme', v)} />{form.stage === '本科' ? <><div className="field"><span>页面规格</span><strong>14 页 · 45 分钟默认课堂</strong></div><div className="field"><span>课堂节奏</span><strong>理论讲解 · 结构观察 · 案例应用 · 即时评价</strong></div></> : <><SegmentField label="内容详略" value={form.pptLength} options={['精简','标准','详细']} onChange={(v) => update('pptLength', v)} /><SegmentField label="图文比例" value={form.visualBalance} options={['文字为主','图文均衡','视觉为主']} onChange={(v) => update('visualBalance', v)} /><SegmentField label="课堂节奏" value={form.teachingRhythm} options={['讲授型','互动型','练习型']} onChange={(v) => update('teachingRhythm', v)} /></>}</div></div>
              {form.stage !== '本科' && <div className="form-block"><div className="block-title"><span>课件能力</span><small>按课堂需要启用</small></div><div className="toggle-grid"><ToggleField label="答案逐步揭示" note="题目与答案分开展示" value={form.answerReveal} onChange={(v) => update('answerReveal', v)} /><ToggleField label="教师讲稿备注" note="为每页补充讲解提示" value={form.speakerNotes} onChange={(v) => update('speakerNotes', v)} /><ToggleField label="突出考点易错点" note="适合初高中与复习课" value={form.highlightExam} onChange={(v) => update('highlightExam', v)} /><ToggleField label="编入 3D 教学" note="有合适素材时加入观察任务" value={form.use3d} onChange={(v) => update('use3d', v)} /></div></div>}
              <div className="ppt-summary"><MonitorPlay size={22} /><div><strong>{form.pptTheme === '自动推荐' ? `${form.stage}${form.subject}推荐主题` : form.pptTheme}</strong><span>{form.pptLength}内容 · {form.visualBalance} · {form.teachingRhythm} · 原生可编辑课件</span></div></div>
            </div>}
            <div className="stage-controls"><button className="outline-btn" disabled={prepStep === 1} onClick={() => setPrepStep((prepStep - 1) as 1 | 2 | 3 | 4)}>上一步</button>{prepStep < 4 && <button className="primary-btn" onClick={() => setPrepStep((prepStep + 1) as 1 | 2 | 3 | 4)}>下一步 <ArrowRight size={15} /></button>}</div>
            <div className="form-footer"><span><Lightbulb size={15} />生成内容来自本地模板，通常 1 秒内完成</span><button className="primary-btn" onClick={generatePlan} disabled={busy === 'preview'}>{busy === 'preview' ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}生成教案 <ArrowRight size={16} /></button></div>
          </section>
          <aside className="preview-column">
            {!plan ? <EmptyPreview /> : <Fragment key={plan.id}><LessonPreview plan={plan} onUpdate={updatePlan} onSave={saveRecord} onGenerate={generatePpt} onGenerate3d={generate3d} onGenerateBundle={generateBundle} onRegenerate={generatePlan} busy={busy} modelFile={modelFile} setModelFile={setModelFile} modelUrl={modelUrl} threeDConfigured={threeDConfigured} bioResult={bioResult} artifacts={artifacts} pptArtifact={pptArtifact} /></Fragment>}
          </aside>
        </div>
      </>}
      {view === 'records' && <RecordsView records={filteredRecords} query={query} setQuery={setQuery} onOpen={openRecord} onDelete={deleteRecord} onNew={() => { setView('new'); setPlan(null) }} />}
      {view === 'knowledge' && <KnowledgeView />}
    </main>
    {toast && <div className="toast"><Check size={16} />{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="field"><span>{label}{required && <b>*</b>}</span><input value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function TextArea({ label, value, onChange, rows, required }: { label: string; value: string; onChange: (value: string) => void; rows: number; required?: boolean }) { return <label className="field"><span>{label}{required && <b>*</b>}</span><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><div className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></div></label> }
function SegmentField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <div className="field"><span>{label}</span><div className="segment-group">{options.map((option) => <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{option}</button>)}</div></div> }
function ToggleField({ label, note, value, onChange }: { label: string; note: string; value: string; onChange: (value: string) => void }) { return <label className="toggle-field"><input type="checkbox" checked={value !== '不包含' && value !== '不突出' && value !== '不使用'} onChange={(event) => onChange(event.target.checked ? (label === '突出考点易错点' ? '突出' : label === '编入 3D 教学' ? '按需使用' : '包含') : (label === '突出考点易错点' ? '不突出' : label === '编入 3D 教学' ? '不使用' : '不包含'))} /><span><strong>{label}</strong><small>{note}</small></span></label> }

function EmptyPreview() { return <div className="empty-preview"><div className="empty-icon"><ClipboardList size={25} /></div><h3>教案预览会出现在这里</h3><p>先填写左侧教学需求，生成后可以逐段编辑、备案，并一键制作课件。</p><div className="empty-points"><span><Check size={14} />课堂问题链</span><span><Check size={14} />教学型 PPT 大纲</span><span><Check size={14} />本地备案记录</span></div></div> }

function SlideGallery({ draft, previews, quality, selected, setSelected, editing, changeSlide, moveSlide, duplicateSlide, deleteSlide, regenerateSlide, slideBusy }: { draft: LessonPlan; previews: SlidePreview[]; quality: QualityReport | null; selected: number; setSelected: (index: number) => void; editing: boolean; changeSlide: (index: number, key: keyof SlidePlan, value: string) => void; moveSlide: (index: number, direction: -1 | 1) => void; duplicateSlide: (index: number) => void; deleteSlide: (index: number) => void; regenerateSlide: (layout?: string) => void; slideBusy: boolean }) {
  const [assets, setAssets] = useState<AssetCandidate[]>([])
  const [assetBusy, setAssetBusy] = useState(false)
  const planIndex = previews[selected]?.sourceIndex ?? selected
  const slide = draft.slides[planIndex] || draft.slides[0]
  const preview = previews[selected]
  const searchAssets = async () => {
    if (!slide?.assetQuery) return
    setAssetBusy(true)
    try { const response = await fetch('/api/prep/assets/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: slide.assetQuery, limit: 6 }) }); const data = await response.json(); setAssets(data.results || []) }
    catch { setAssets([]) }
    finally { setAssetBusy(false) }
  }
  const cacheAsset = async (asset: AssetCandidate) => {
    try {
      const response = await fetch('/api/prep/assets/cache', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: asset.sourceUrl, metadata: asset }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '缓存失败')
      setAssets((current) => current.map((item) => item.sourceUrl === asset.sourceUrl ? { ...item, localPath: data.asset.localPath, sourceType: 'cached' } : item))
    } catch (error) { window.alert(error instanceof Error ? error.message : '素材缓存失败') }
  }
  return <div className="slide-gallery">
    <div className="outline-head"><MonitorPlay size={16} /><span>{draft.request?.pptTheme || '自动推荐'} · {draft.request?.pptLength || '标准'} · {previews.length || draft.slides.length} 页</span><span className={quality && quality.score >= 80 ? 'quality-score good' : 'quality-score'}>质检 {quality?.score ?? '--'}</span></div>
    {quality && (quality.warnings.length > 0 || quality.blocking.length > 0) && <div className="quality-panel"><strong><Eye size={14} />导出前检查</strong>{quality.blocking.map((issue) => <span className="quality-error" key={issue.code + issue.slide}>第{issue.slide || '-'}页：{issue.message}</span>)}{quality.warnings.slice(0, 4).map((issue) => <span key={issue.code + issue.slide}>第{issue.slide || '-'}页：{issue.message}</span>)}</div>}
    <div className="slide-thumbnails">{previews.map((item, index) => <button type="button" className={selected === index ? 'slide-thumb active' : 'slide-thumb'} key={`${item.index}-${item.title}`} onClick={() => setSelected(index)}><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.previewSvg)}`} alt={`第${index + 1}页预览`} /><span>{String(index + 1).padStart(2, '0')} · {item.type || '教学页'}</span></button>)}</div>
    <div className="slide-detail">
      <div className="slide-detail-preview">{preview ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.previewSvg)}`} alt="当前幻灯片预览" /> : <div className="model-empty">正在生成预览</div>}</div>
      <div className="slide-detail-content">
        <div className="slide-detail-head"><div><span className="outline-type">{slide?.type || '教学页'} · {slide?.layout || 'content-list'}</span><h3>{slide?.title}</h3></div><div className="slide-tools"><button className="icon-btn" title="上一页" onClick={() => moveSlide(planIndex, -1)} disabled={planIndex === 0}><MoveUp size={15} /></button><button className="icon-btn" title="下一页" onClick={() => moveSlide(planIndex, 1)} disabled={planIndex === draft.slides.length - 1}><MoveDown size={15} /></button><button className="icon-btn" title="复制页面" onClick={() => duplicateSlide(planIndex)}><Copy size={15} /></button><button className="icon-btn danger" title="删除页面" onClick={() => deleteSlide(planIndex)} disabled={draft.slides.length <= 1}><Trash2 size={15} /></button></div></div>
        {editing && slide ? <><InlineEdit label="页面标题" value={slide.title} onChange={(value) => changeSlide(planIndex, 'title', value)} rows={2} /><InlineEdit label="页面内容（每行一条）" value={(slide.items || []).join('\n')} onChange={(value) => changeSlide(planIndex, 'items', value)} rows={4} /></> : <><p className="slide-purpose">{slide?.purpose || '暂无教学意图'}</p><ul className="slide-items">{(slide?.items || []).map((item, index) => <li key={index}>{item}</li>)}</ul><div className="slide-meta"><span>证明对象：{slide?.proof || '课堂内容'}</span><span>视觉表达：{slide?.visual || '结构化内容'}</span></div></>}
        <div className="slide-detail-actions"><button className="outline-btn" onClick={() => regenerateSlide()} disabled={slideBusy || editing}>{slideBusy ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}重做此页</button><label className="layout-switch"><span>切换版式</span><select value={slide?.layout || ''} onChange={(event) => regenerateSlide(event.target.value)} disabled={slideBusy || editing}><option value="">自动轮换</option>{slideLayoutOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{slide?.assetQuery && <button className="outline-btn" onClick={searchAssets} disabled={assetBusy}>{assetBusy ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />}搜索配图建议</button>}</div>
        {assets.length > 0 && <div className="asset-suggestions"><strong>可追溯素材建议</strong><div>{assets.map((asset) => <div className="asset-suggestion-row" key={asset.sourceUrl}><a href={asset.sourceUrl} target="_blank" rel="noreferrer"><img src={asset.thumbnail || asset.sourceUrl} alt={asset.altText} /><span>{asset.altText}<small>{asset.license}</small></span></a><button className="icon-btn" title={asset.localPath ? '已缓存' : '缓存素材'} onClick={() => cacheAsset(asset)} disabled={Boolean(asset.localPath)}><Download size={13} /></button></div>)}</div></div>}
      </div>
    </div>
  </div>
}

function LessonPreview({ plan, onUpdate, onSave, onGenerate, onGenerate3d, onGenerateBundle, onRegenerate, busy, modelFile, setModelFile, modelUrl, threeDConfigured, bioResult, artifacts, pptArtifact }: { plan: LessonPlan; onUpdate: (plan: LessonPlan) => void; onSave: () => void; onGenerate: () => void; onGenerate3d: (file: File | null, options: ModelOptions, mode?: ModelMode, views?: ModelViews) => Promise<ImageModelResult | BioResult | undefined>; onGenerateBundle: (file: File | null, options: ModelOptions) => void; onRegenerate: () => void; busy: BusyState; modelFile: File | null; setModelFile: (file: File | null) => void; modelUrl: string; threeDConfigured: boolean | null; bioResult: BioResult | null; artifacts: ArtifactState; pptArtifact: { downloadUrl: string; fileName: string } | null }) {
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'lesson' | 'slides' | 'materials' | 'model'>('lesson')
  const [draft, setDraft] = useState(plan)
  const [modelOptions, setModelOptions] = useState<ModelOptions>({ textureResolution: '1024', foregroundRatio: '0.85', vertexCount: '-1', removeBackground: true })
  const [slidePreviews, setSlidePreviews] = useState<SlidePreview[]>([])
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [slideBusy, setSlideBusy] = useState(false)
  useEffect(() => setDraft(plan), [plan])
  useEffect(() => {
    let cancelled = false
    fetch('/api/prep/ppt/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: draft }) })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) { setSlidePreviews(data.slides || []); setQuality(data.quality || null); setSelectedSlide((current) => Math.min(current, Math.max(0, (data.slides || []).length - 1))) } })
      .catch(() => { if (!cancelled) { setSlidePreviews([]); setQuality(null) } })
    return () => { cancelled = true }
  }, [draft])
  const change = (key: keyof LessonPlan, value: string | string[]) => setDraft((current) => current.courseProfile && (key === 'objectives' || key === 'learningOutcomes') ? { ...current, objectives: value as string[], learningOutcomes: value as string[] } : { ...current, [key]: value })
  const changeSlide = (index: number, key: keyof SlidePlan, value: string) => setDraft((current) => ({ ...current, slides: current.slides.map((slide, i) => i === index ? { ...slide, [key]: key === 'items' ? splitLines(value) : value } : slide) }))
  const commit = () => {
    let next = draft
    if (draft.courseProfile) {
      next = { ...draft, slides: draft.slides.map((s) => {
        if (s.type === '学习成果' && (draft.learningOutcomes !== plan.learningOutcomes || draft.prerequisites !== plan.prerequisites)) return { ...s, items: [...(draft.learningOutcomes || []), '先修：'+(draft.prerequisites || []).join('；')] }
        if (s.type === '案例' && draft.casePrompt !== plan.casePrompt) return { ...s, items: [draft.casePrompt || '', ...(s.items || []).slice(1)] }
        if (s.type === '作业' && draft.homework !== plan.homework) return { ...s, items: [draft.homework, ...(s.items || []).slice(1)] }
        return s
      }) }
    }
    setDraft(next); onUpdate(next); setEditing(false)
  }
  const applySlides = (slides: SlidePlan[]) => { const next = { ...draft, slides }; setDraft(next); onUpdate(next) }
  const moveSlide = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= draft.slides.length) return
    const slides = [...draft.slides]; [slides[index], slides[nextIndex]] = [slides[nextIndex], slides[index]]; applySlides(slides); setSelectedSlide(nextIndex)
  }
  const duplicateSlide = (index: number) => { const slides = [...draft.slides]; slides.splice(index + 1, 0, { ...slides[index], title: `${slides[index].title}（副本）` }); applySlides(slides); setSelectedSlide(index + 1) }
  const deleteSlide = (index: number) => { if (draft.slides.length <= 1) return; const slides = draft.slides.filter((_, slideIndex) => slideIndex !== index); applySlides(slides); setSelectedSlide(Math.min(index, slides.length - 1)) }
  const regenerateSlide = async (layout?: string) => {
    setSlideBusy(true)
    try {
      const planIndex = slidePreviews[selectedSlide]?.sourceIndex ?? selectedSlide
      const response = await fetch('/api/prep/ppt/regenerate-slide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: draft, slideIndex: planIndex, layout: layout || undefined }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '单页重做失败')
      setDraft(data.lessonPlan); onUpdate(data.lessonPlan); setSlidePreviews(data.slides || []); setQuality(data.quality || null)
    } catch (error) { window.alert(error instanceof Error ? error.message : '单页重做失败') }
    finally { setSlideBusy(false) }
  }
  return <div className="preview-wrap">
    <div className="preview-top"><div><span className="section-kicker">PREVIEW / DRAFT</span><h2>{draft.title}</h2><p>{draft.overview}</p></div><span className="status-chip"><Check size={14} />已生成</span></div>
    <div className="preview-actions">
      {editing ? <button className="primary-btn compact" onClick={commit}><Check size={15} />保存修改</button> : <button className="outline-btn" onClick={() => { setDraft(plan); setEditing(true) }}><FileText size={15} />编辑教案</button>}
      <button className="outline-btn" onClick={onRegenerate} disabled={busy !== null || editing}><RefreshCw size={15} />重新生成</button>
      <button className="outline-btn" onClick={onSave} disabled={editing}><Archive size={15} />保存备案</button>
      <button className="outline-btn" onClick={onGenerate} disabled={busy !== null || editing}><Download size={15} />生成 PPT</button>
      <button className="primary-btn compact combo-action" onClick={() => onGenerateBundle(modelFile, modelOptions)} disabled={busy !== null || editing}>{busy === 'bundle' ? <LoaderCircle className="spin" size={15} /> : <Box size={15} />}一键生成 PPT + 3D</button>
    </div>
    {draft.modelPlan && <div className="artifact-status" aria-live="polite">{(['pptx','glb','blend','preview'] as const).map((key) => <span key={key} data-status={artifacts[key] || 'pending'}>{({pptx:'PPTX',glb:'GLB',blend:'Blender 工程',preview:'预览图'})[key]} · {({generated:'已生成',generating:'生成中',fallback:'演示回退',failed:'失败',unavailable:'不可用',pending:'待生成'})[artifacts[key] || 'pending'] || artifacts[key]}</span>)}{pptArtifact && <a href={pptArtifact.downloadUrl} download={pptArtifact.fileName}>下载 PPTX</a>}</div>}
    <div className="preview-tabs" role="tablist" aria-label="生成结果预览"><button role="tab" aria-selected={activeTab === 'lesson'} className={activeTab === 'lesson' ? 'active' : ''} onClick={() => setActiveTab('lesson')}>{editing ? '编辑教案' : '教案预览'}</button><button role="tab" aria-selected={activeTab === 'slides'} className={activeTab === 'slides' ? 'active' : ''} onClick={() => setActiveTab('slides')}>PPT 大纲 <em>{draft.slides.length} 页</em></button><button role="tab" aria-selected={activeTab === 'materials'} className={activeTab === 'materials' ? 'active' : ''} onClick={() => setActiveTab('materials')}>教材素材</button><button role="tab" aria-selected={activeTab === 'model'} className={activeTab === 'model' ? 'active' : ''} onClick={() => setActiveTab('model')}>3D 模型</button></div>
    <div className="preview-scroll">
      {activeTab === 'lesson' && draft.courseProfile && <>
        <PreviewSection title="课程定位" items={[`${draft.courseProfile.field} · ${draft.courseProfile.courseName}`, `${draft.courseProfile.semester} · ${draft.courseProfile.courseType} · ${draft.courseProfile.credits} 学分 · ${draft.courseProfile.courseHours} 学时`]} />
        {editing ? <><InlineEdit label="学习成果" value={(draft.learningOutcomes || []).join('\n')} onChange={(value) => { change('learningOutcomes',splitLines(value)); change('objectives',splitLines(value)) }} rows={3} /><InlineEdit label="先修知识" value={(draft.prerequisites || []).join('\n')} onChange={(value) => change('prerequisites',splitLines(value))} rows={3} /><InlineEdit label="案例任务" value={draft.casePrompt || ''} onChange={(value) => change('casePrompt',value)} rows={3} /><InlineEdit label="考核设计" value={(draft.assessmentPlan || []).join('\n')} onChange={(value) => change('assessmentPlan',splitLines(value))} rows={3} /></> : <><PreviewSection title="先修知识" items={draft.prerequisites || []} /><PreviewSection title="学习成果" items={draft.learningOutcomes || []} /><PreviewSection title="知识结构图" items={draft.knowledgeMap || []} /><PreviewSection title="案例任务" items={[draft.casePrompt || '']} /><PreviewSection title="考核设计" items={draft.assessmentPlan || []} /></>}
        <PreviewSection title="推荐 3D 模型" items={[draft.modelPlan?.modelName || '', ...(draft.modelPlan?.observationTasks || [])]} />
        <ReferenceList references={draft.references || []} />
      </>}
      {activeTab === 'lesson' && (editing ? <div className="edit-preview"><InlineEdit label="课程概览" value={draft.overview} onChange={(value) => change('overview', value)} rows={3} /><InlineEdit label="课程目标（每行一条）" value={draft.objectives.join('\n')} onChange={(value) => change('objectives', splitLines(value))} rows={4} /><InlineEdit label="教学重点（每行一条）" value={draft.keyPoints.join('\n')} onChange={(value) => change('keyPoints', splitLines(value))} rows={3} /><InlineEdit label="教学难点（每行一条）" value={draft.difficulties.join('\n')} onChange={(value) => change('difficulties', splitLines(value))} rows={3} /><InlineEdit label="课后作业" value={draft.homework} onChange={(value) => change('homework', value)} rows={3} /></div> : <><PreviewSection title="课程目标" items={draft.objectives} /><PreviewSection title="学情分析" items={[draft.situation]} /><PreviewSection title="重点与难点" items={[...draft.keyPoints.map((x) => `重点：${x}`), ...draft.difficulties.map((x) => `难点：${x}`)]} /><div className="preview-section"><div className="section-title"><span>教学流程</span><small>{draft.phases.reduce((sum, phase) => sum + phase.time, 0)} 分钟</small></div><div className="timeline">{draft.phases.map((phase) => <div className="timeline-row" key={phase.name}><div className="time-badge">{phase.time}<small>MIN</small></div><div className="timeline-copy"><strong>{phase.name}</strong><p><b>教师</b>{phase.teacher}</p><p><b>学生</b>{phase.student}</p><span><Check size={12} />{phase.check}</span></div></div>)}</div></div><PreviewSection title="板书设计" items={draft.blackboard} /><PreviewSection title="作业设计" items={[draft.homework]} /></>)}
      {activeTab === 'slides' && <SlideGallery draft={draft} previews={slidePreviews} quality={quality} selected={selectedSlide} setSelected={setSelectedSlide} editing={editing} changeSlide={changeSlide} moveSlide={moveSlide} duplicateSlide={duplicateSlide} deleteSlide={deleteSlide} regenerateSlide={regenerateSlide} slideBusy={slideBusy} />}
      {activeTab === 'materials' && <div className="material-preview"><PreviewSection title="教材依据" items={[draft.request.textbookVersion, draft.request.chapter, draft.request.materialName ? `已使用：${draft.request.materialName}` : '未上传教材资料，依据教师填写内容生成', draft.request.materialPolicy].filter(Boolean)} /><PreviewSection title="课堂知识线索" items={[draft.request.priorKnowledge, draft.request.coreQuestion, ...splitLines(draft.request.examPoints || '')].filter(Boolean)} /><div className="preview-section"><div className="section-title"><span>资料摘录</span></div><p className="material-excerpt">{draft.request.materialText?.slice(0, 1000) || '暂无资料摘录。可返回“教材学情”步骤上传或粘贴内容。'}</p></div></div>}
      {activeTab === 'model' && (draft.modelPlan ? <BioModelPanel plan={draft} onUpdate={(value) => { setDraft(value); onUpdate(value) }} result={bioResult} onGenerate={() => onGenerate3d(null, modelOptions)} busy={busy !== null || editing} /> : <ModelPanel file={modelFile} setFile={setModelFile} modelUrl={modelUrl} options={modelOptions} setOptions={setModelOptions} configured={threeDConfigured} onGenerate={(file, options, mode, views) => onGenerate3d(file, options, mode, views)} busy={busy} disabled={editing} />)}
    </div>
    <div className="preview-foot"><span><FileText size={14} />本地模板生成 · 可继续修改</span><span>更新于 {draft.createdAt.replace('T', ' ')}</span></div>
  </div>
}

function ReferenceList({ references }: { references: Reference[] }) {
  return <section className="preview-section"><div className="section-title"><span>参考资料</span></div><ol className="bio-references">{references.map((r,i) => <li key={i}>{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.title}</a> : <strong>{r.title}</strong>}<small>{r.author} · {r.year} · {r.sourceType === 'user-material' ? '用户资料' : r.sourceType === 'builtin-template' ? '内置教学模板' : '公开教育资料'}<br />{r.license}</small></li>)}</ol></section>
}

function BioModelPanel({ plan, onUpdate, result, onGenerate, busy }: { plan: LessonPlan; onUpdate: (plan: LessonPlan) => void; result: BioResult | null; onGenerate: () => void; busy: boolean }) {
  const model = plan.modelPlan!
  const [catalog, setCatalog] = useState<{ modelKey: string; parts: BioPart[] }[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const viewer = useRef<HTMLElement | null>(null)
  const [viewerState, setViewerState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { fetch('/api/prep/biomed/models').then((r) => r.json()).then((data) => setCatalog(data.models || [])).catch(() => setCatalog([])) }, [])
  useEffect(() => { setHidden([]) }, [result])
  useEffect(() => {
    setViewerState('loading')
    const element = viewer.current
    if (!element) return
    const loaded = () => setViewerState('ready')
    const failed = () => setViewerState('error')
    element.addEventListener('load', loaded)
    element.addEventListener('error', failed)
    return () => { element.removeEventListener('load', loaded); element.removeEventListener('error', failed) }
  }, [result])
  const available = catalog.find((m) => m.modelKey === model.modelKey)?.parts || model.partDetails
  const changeParts = (key: string, selected: boolean) => {
    const parts = selected ? [...model.parts,key] : model.parts.filter((p) => p !== key)
    if (!parts.length) return
    const partDetails = available.filter((p) => parts.includes(p.key))
    onUpdate({ ...plan, modelPlan: { ...model, parts, partDetails }, slides: plan.slides.map((s) => s.type === '观察' ? { ...s, items: ['部件：'+partDetails.map((p) => p.name).join('、'), ...(s.items || []).slice(1)] } : s) })
  }
  const toggleVisible = (part: BioPart) => {
    const next = hidden.includes(part.key) ? hidden.filter((k) => k !== part.key) : [...hidden,part.key]
    const el = viewer.current as (HTMLElement & { model?: { materials: { name: string; setAlphaMode: (value: string) => void; pbrMetallicRoughness: { setBaseColorFactor: (value: number[]) => void; baseColorFactor: number[] } }[] } }) | null
    // The GLB uses a unique material for every named anatomical part.
    el?.model?.materials.filter((m) => m.name === part.key).forEach((m) => { const rgba = [...m.pbrMetallicRoughness.baseColorFactor]; rgba[3] = next.includes(part.key) ? 0 : 1; m.setAlphaMode('BLEND'); m.pbrMetallicRoughness.setBaseColorFactor(rgba) })
    setHidden(next)
  }
  return <section className="model-panel biomed-panel"><div className="model-panel-head"><div><span className="section-kicker">BIOMEDICAL / 3D</span><h3>{model.modelName}</h3><p>{result?.message || '可编辑教学结构示意'}</p></div></div>
    <p className="bio-scope">{model.quality || '教学结构示意，非解剖扫描；不按真实比例，不用于诊断或治疗。'}</p>
    <label className="field"><span>结构显示</span><select disabled={busy} value={model.renderMode} onChange={(e) => onUpdate({ ...plan, modelPlan: { ...model, renderMode: e.target.value } })}><option value="assembled">组合结构</option><option value="exploded">拆解观察</option></select></label>
    <fieldset className="bio-parts" disabled={busy}><legend>生成部件</legend>{available.map((part) => <label key={part.key}><input type="checkbox" checked={model.parts.includes(part.key)} onChange={(e) => changeParts(part.key,e.target.checked)} />{part.name}<small>{part.englishName}</small></label>)}</fieldset>
    <PreviewSection title="结构观察任务" items={model.observationTasks} />
    <button className="primary-btn" disabled={busy} onClick={onGenerate}>{busy ? <LoaderCircle size={16} className="spin" /> : <Box size={16} />}生成模型与 Blender 工程</button>
    {result && <><div className="artifact-downloads">{result.glbUrl && <a href={result.glbUrl} download><Download size={15} />GLB</a>}{result.blendUrl && <a href={result.blendUrl} download><Download size={15} />Blender 工程</a>}{result.previewUrl && <a href={result.previewUrl} download><Download size={15} />预览图</a>}</div>
      {result.glbUrl && <><div className="model-result"><model-viewer ref={(el: HTMLElement | null) => { viewer.current = el }} src={result.glbUrl} loading="eager" camera-controls shadow-intensity="1" exposure="1" environment-image="neutral" /></div>{viewerState !== 'ready' && <p role="status">{viewerState === 'error' ? '模型预览加载失败，可下载 GLB 或 Blender 工程查看。' : '模型加载中…'}</p>}</>}
      {result.status === 'generated' && <div className="bio-visibility">{result.partDetails.map((part) => <button className="outline-btn" key={part.key} onClick={() => toggleVisible(part)} aria-pressed={!hidden.includes(part.key)}><Eye size={14} />{part.name} · {hidden.includes(part.key) ? '已隐藏' : '显示'}</button>)}</div>}
      {result.previewUrl && <img className="bio-render" src={result.previewUrl} alt={`${result.modelName}渲染预览`} />}
    </>}
    <ReferenceList references={plan.references || model.references} />
  </section>
}

function ModelPanel({ file, setFile, modelUrl, options, setOptions, configured, onGenerate, busy, disabled }: { file: File | null; setFile: (file: File | null) => void; modelUrl: string; options: ModelOptions; setOptions: (options: ModelOptions) => void; configured: boolean | null; onGenerate: (file: File | null, options: ModelOptions, mode: ModelMode, views: ModelViews) => Promise<ImageModelResult | BioResult | undefined>; busy: BusyState; disabled: boolean }) {
  const [mode, setMode] = useState<ModelMode>('single')
  const [views, setViews] = useState<ModelViews>({})
  const [result, setResult] = useState<ImageModelResult | null>(null)
  const update = (key: keyof ModelOptions, value: string | boolean) => setOptions({ ...options, [key]: value })
  const viewLabels = { front: '正面图', top: '上面图', left: '左侧图', right: '右侧图', bottom: '底部图' } as const
  const viewKeys = Object.keys(viewLabels) as (keyof ModelViews)[]
  const submit = async () => { const generated = await onGenerate(file, options, mode, views); if (generated && 'parts' in generated) setResult(generated as ImageModelResult) }
  return <section className="model-panel">
    <div className="model-panel-head"><div><span className="section-kicker">3D ASSET</span><h3><Box size={16} />课堂三维模型</h3><p>上传课件中的物体图片，生成可旋转的 GLB 模型。</p></div><span className={configured ? 'model-status ready' : 'model-status'}>{configured === null ? '检测中' : configured ? '服务已配置' : '待配置'}</span></div>
    {configured === false && <div className="model-warning"><Settings2 size={15} />当前未配置真实重建服务；单图和多视角都可以先用本地预览验证流程。配置 <code>SF3D_BASE_URL</code>、<code>SF3D_API_KEY</code> 后才会调用真实重建。</div>}
    <div className="model-mode-switch" role="tablist" aria-label="3D生成模式"><button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>单张图片生成</button><button type="button" className={mode === 'multiview' ? 'active' : ''} onClick={() => setMode('multiview')}>五视角重建</button></div>
    {mode === 'single' ? <label className="upload-box"><UploadCloud size={18} /><span>{file ? file.name : '选择一张 PNG / JPG 图片'}</span><small>{file ? `${Math.ceil(file.size / 1024)} KB · 已就绪` : '适合快速生成整体模型'}</small><input type="file" accept="image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label> : <div className="multiview-grid">{viewKeys.map((key) => <label className={views[key] ? 'view-upload ready' : 'view-upload'} key={key}><UploadCloud size={15} /><strong>{viewLabels[key]}</strong><small>{views[key]?.name || '选择图片'}</small><input type="file" accept="image/png,image/jpeg" onChange={(event) => setViews((current) => ({ ...current, [key]: event.target.files?.[0] || undefined }))} /></label>)}</div>}
    {mode === 'multiview' && <p className="model-hint">请保持五张图的主体、比例和背景一致。真实服务会用五个视角重建，输出后仍会进行 Blender 部件拆分。</p>}
    <div className="model-controls"><label className="field"><span>贴图分辨率</span><select value={options.textureResolution} onChange={(event) => update('textureResolution', event.target.value)}><option>512</option><option>768</option><option>1024</option><option>1536</option><option>2048</option></select></label><label className="field"><span>前景占比</span><input type="number" min="0.5" max="1" step="0.05" value={options.foregroundRatio} onChange={(event) => update('foregroundRatio', event.target.value)} /></label><label className="field"><span>目标顶点数</span><input type="number" step="1" value={options.vertexCount} onChange={(event) => update('vertexCount', event.target.value)} /></label><label className="model-check"><input type="checkbox" checked={options.removeBackground} onChange={(event) => update('removeBackground', event.target.checked)} />自动移除背景</label></div>
    <div className="model-actions"><button className="primary-btn model-generate" onClick={submit} disabled={busy !== null || disabled || (mode === 'single' ? !file : viewKeys.some((key) => !views[key]))}>{busy === '3d' ? <LoaderCircle className="spin" size={15} /> : <Box size={15} />}{mode === 'single' ? '生成单图模型' : '生成五视角模型'}</button></div>
    {modelUrl ? <><div className="model-result"><model-viewer src={modelUrl} camera-controls auto-rotate shadow-intensity="1" exposure="1" environment-image="neutral" /><div className="image-model-downloads"><a className="model-download" href={modelUrl} download="lesson-model.glb"><Download size={15} />GLB</a>{result?.blendUrl && <a className="model-download" href={result.blendUrl} download><Download size={15} />Blender 工程</a>}{result?.previewUrl && <a className="model-download" href={result.previewUrl} download><Download size={15} />预览图</a>}</div></div>{result && <div className="part-summary"><strong>可拆分部件 · {result.parts.length}</strong><div>{result.parts.slice(0, 12).map((part) => <span key={part.partKey}>{part.name}</span>)}</div>{result.parts.length > 12 && <small>另有 {result.parts.length - 12} 个部件</small>}</div>}</> : <div className="model-empty"><Box size={22} /><span>生成后将在这里预览模型</span></div>}
  </section>
}
function PreviewSection({ title, items }: { title: string; items: string[] }) { return <div className="preview-section"><div className="section-title"><span>{title}</span></div><ul className="preview-list">{items.map((item) => <li key={item}><i />{item}</li>)}</ul></div> }
function InlineEdit({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) { return <label className="inline-edit"><span>{label}</span><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></label> }

function RecordsView({ records, query, setQuery, onOpen, onDelete, onNew }: { records: RecordItem[]; query: string; setQuery: (v: string) => void; onOpen: (item: RecordItem) => void; onDelete: (id: string) => void; onNew: () => void }) { return <section className="records-view"><div className="records-head"><div><span className="section-kicker">ARCHIVE / LOCAL</span><h2>备案记录</h2><p>保存在当前浏览器的教案草稿和生成记录。</p></div><button className="primary-btn" onClick={onNew}><Plus size={17} />新建教案</button></div><div className="record-toolbar"><div className="search-box"><Search size={16} /><input placeholder="搜索课题、学科或年级" value={query} onChange={(e) => setQuery(e.target.value)} /></div><span>{records.length} 条记录</span></div><div className="record-list">{records.length ? records.map((record) => <div className="record-row" key={record.id}><div className="record-icon"><FileText size={18} /></div><div className="record-main"><strong>{record.title}</strong><span>{record.grade} · {record.subject} · {new Date(record.updatedAt).toLocaleString('zh-CN')}</span></div><span className="record-tag">已备案</span><button className="icon-btn" title="打开" onClick={() => onOpen(record)}><FolderOpen size={16} /></button><button className="icon-btn danger" title="删除" onClick={() => onDelete(record.id)}><Trash2 size={16} /></button></div>) : <div className="no-records"><History size={28} /><h3>还没有备案记录</h3><p>生成第一份教案后，点击“保存备案”即可在这里继续编辑。</p></div>}</div></section> }
function KnowledgeView() { return <section className="knowledge-view"><div className="knowledge-hero"><div className="knowledge-symbol"><BookOpen size={27} /></div><span className="section-kicker">KNOWLEDGE BASE / COMING SOON</span><h2>让教案更懂你的课堂</h2><p>后续可以添加教材笔记、教研资料和校本资源，生成时优先引用你自己的内容。</p><div className="future-grid"><div><UploadCloud size={19} /><strong>添加资料</strong><span>Word、PDF、图片与课堂笔记</span></div><div><Layers3 size={19} /><strong>建立分类</strong><span>按学科、年级、章节和标签整理</span></div><div><Sparkles size={19} /><strong>精准生成</strong><span>减少泛化内容，保留校本表达</span></div></div></div></section> }

export default PrepStudio
