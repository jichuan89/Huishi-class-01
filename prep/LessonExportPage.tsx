import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Download, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import {
  buildLessonWord,
  buildTeacherLessonWord,
  canExportLesson,
  lessonExportSections,
  lessonWordFilename,
  validateTeacherLessonDraft,
  type ExportLesson,
  type TeacherLessonDraft,
} from '../services/lessonWordExport'
import './lesson-export.css'

type TeacherLessonReview = {
  draft: TeacherLessonDraft
  quality: { valid: boolean; blocking: string[]; checks?: string[] }
}

export default function LessonExportPage({
  plan, editing, onBack, onNotice, review, onReviewChange,
}: {
  plan: ExportLesson
  editing: boolean
  onBack: () => void
  onNotice: (message: string) => void
  review: TeacherLessonReview | null
  onReviewChange: (review: TeacherLessonReview | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editingDraft, setEditingDraft] = useState(false)
  const [teacherConfirmed, setTeacherConfirmed] = useState(false)
  const isUndergraduate = Boolean(plan.designWorkflow)

  useEffect(() => {
    if (!isUndergraduate || review) return
    let cancelled = false
    setBusy(true)
    setError('')
    fetch('/api/prep/lesson-design/prepare-export', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonPlan: plan }),
    })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'AI 教案成稿失败')
        if (!data.draft || data.quality?.valid !== true) throw new Error(data.error || data.quality?.blocking?.[0] || 'AI 教案未通过内容检查')
        if (!cancelled) onReviewChange({ draft: data.draft, quality: data.quality })
      })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'AI 教案成稿失败，请重试') })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [isUndergraduate, plan, review, retry, onReviewChange])

  const updateDraft = (patch: Partial<TeacherLessonDraft>) => {
    if (!review) return
    const draft = { ...review.draft, ...patch }
    const quality = validateTeacherLessonDraft(draft)
    onReviewChange({ ...review, draft, quality })
    setTeacherConfirmed(false)
  }
  const download = async () => {
    if (isUndergraduate && (!review || !review.quality.valid || !teacherConfirmed || editingDraft)) return
    setBusy(true)
    try {
      const blob = isUndergraduate
        ? await buildTeacherLessonWord(review!.draft)
        : await buildLessonWord(plan)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = lessonWordFilename(isUndergraduate ? review!.draft.title : plan.title)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      onNotice('教师版 Word 教案已导出')
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : '导出失败，请重试') }
    finally { setBusy(false) }
  }
  const legacyReady = !editing && canExportLesson(plan)
  const teacherReady = Boolean(review?.quality.valid && teacherConfirmed && !editingDraft && !editing)
  const ready = isUndergraduate ? teacherReady : legacyReady

  return <section className="lesson-export-page" aria-label="导出教案">
    <header className="lesson-export-toolbar">
      <div><h3>{isUndergraduate ? '审核教师版教案' : '导出教案'}</h3><span>{isUndergraduate ? 'AI 成稿 · 教师审核 · Word 文档' : 'Word 文档 · 数智教学设计'}</span></div>
      <div className="lesson-export-buttons">
        <button className="outline-btn" onClick={onBack}><ArrowLeft size={15} />返回教案</button>
        {isUndergraduate && review && <button className="outline-btn" onClick={() => setEditingDraft(value => !value)} disabled={busy}>{editingDraft ? <Check size={15} /> : <Sparkles size={15} />}{editingDraft ? '完成修改' : '编辑成稿'}</button>}
        {isUndergraduate
          ? <button className="primary-btn" disabled={!review?.quality.valid || busy || editingDraft || editing} onClick={() => { if (teacherConfirmed) void download(); else setTeacherConfirmed(true) }}>{busy ? <LoaderCircle className="spin" size={15} /> : teacherConfirmed ? <Download size={15} /> : <Check size={15} />}{busy ? '正在生成' : teacherConfirmed ? '导出 Word' : '确认审核'}</button>
          : <button className="primary-btn" disabled={!legacyReady || busy} onClick={() => void download()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{busy ? '正在导出' : '导出 Word'}</button>}
      </div>
    </header>

    {isUndergraduate && busy && !review && <div className="lesson-export-state"><LoaderCircle className="spin" size={19} /><div><strong>AI 正在整理教师版教案</strong><span>将已确认的教学设计改写为便于课堂直接使用的内容。</span></div></div>}
    {isUndergraduate && error && <div className="lesson-export-error" role="alert"><div><strong>没有生成审核稿</strong><p>{error}</p><span>未使用模板代替，也没有导出原始字段内容。</span></div><button className="outline-btn" onClick={() => { setError(''); setRetry(value => value + 1) }} disabled={busy}><RefreshCw size={15} />重试 AI 成稿</button></div>}
    {isUndergraduate && review && <>
      <div className={`teacher-review-status ${review.quality.valid ? 'is-valid' : 'has-errors'}`} role="status">
        <div><Check size={16} /><strong>{review.quality.valid ? 'AI 初审完成，请通读并确认' : '审核稿尚有内容需要补全'}</strong><span>{teacherConfirmed ? '你已确认当前版本，可以导出 Word。' : '课程阶段、学期和能力分层仅作为生成背景，不会写入成稿。'}</span></div>
        {review.quality.checks?.length ? <small>{review.quality.checks.join(' · ')}</small> : null}
      </div>
      {!review.quality.valid && <ul className="teacher-review-errors">{review.quality.blocking.map(item => <li key={item}>{item}</li>)}</ul>}
      {editingDraft ? <TeacherLessonEditor draft={review.draft} onChange={updateDraft} /> : <TeacherLessonPreview draft={review.draft} />}
    </>}

    {!isUndergraduate && !legacyReady && <p role="status">{editing ? '请先保存教案修改。' : '教案有待确认的修改，请返回重新校验并确认整套教案。'}</p>}
    {!isUndergraduate && <article className="lesson-export-paper"><h1>{plan.title} 教案</h1>{lessonExportSections(plan).map((section, index) => <section key={index}><h2>{section.title}</h2>{section.lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}</section>)}</article>}
  </section>
}

function TeacherLessonPreview({ draft }: { draft: TeacherLessonDraft }) {
  const list = (items: string[]) => <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
  return <article className="lesson-export-paper teacher-lesson-paper">
    <h1>{draft.title}</h1>
    <div className="teacher-lesson-meta">{draft.courseName && <span>{draft.courseName}</span>}<span>本课时长：{draft.duration}分钟</span></div>
    <p className="teacher-lesson-overview">{draft.overview}</p>
    <section><h2>教学目标</h2>{list(draft.objectives)}</section>
    <section className="teacher-lesson-pair"><div><h2>教学重点</h2>{list(draft.keyPoints)}</div><div><h2>教学难点</h2>{list(draft.difficulties)}</div></section>
    <section><h2>课前准备</h2><p><b>教师</b>　{draft.teacherPreparation.join('；')}</p><p><b>学生</b>　{draft.studentPreparation.join('；')}</p></section>
    <section><h2>教学过程</h2><div className="teacher-process-list">{draft.process.map((item, index) => <article key={`${index}-${item.name}`}>
      <header><strong>{item.name}</strong><span>{item.minutes} 分钟</span></header>
      <p><b>教师活动</b>{item.teacherActivity}</p><p><b>学生活动</b>{item.studentActivity}</p>
      <p><b>关键提问</b>{item.question}</p><p><b>检查要点</b>{item.check}</p>
    </article>)}</div></section>
    <section><h2>课后作业</h2>{list(draft.homework)}</section>
    <section><h2>板书设计</h2>{list(draft.blackboardDesign)}</section>
    {draft.references.length > 0 && <section><h2>参考资料</h2>{list(draft.references)}</section>}
  </article>
}

function TeacherLessonEditor({ draft, onChange }: { draft: TeacherLessonDraft; onChange: (patch: Partial<TeacherLessonDraft>) => void }) {
  const lines = (items: string[]) => items.join('\n')
  const parseLines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean)
  return <div className="teacher-lesson-editor">
    <label>教案标题<input value={draft.title} onChange={event => onChange({ title: event.target.value })} /></label>
    <label>课程说明<textarea rows={4} value={draft.overview} onChange={event => onChange({ overview: event.target.value })} /></label>
    <label>教学目标（每行一条）<textarea rows={4} value={lines(draft.objectives)} onChange={event => onChange({ objectives: parseLines(event.target.value) })} /></label>
    <div className="teacher-lesson-pair"><label>教学重点<textarea rows={4} value={lines(draft.keyPoints)} onChange={event => onChange({ keyPoints: parseLines(event.target.value) })} /></label><label>教学难点<textarea rows={4} value={lines(draft.difficulties)} onChange={event => onChange({ difficulties: parseLines(event.target.value) })} /></label></div>
    <label>教师课前准备（每行一条）<textarea rows={3} value={lines(draft.teacherPreparation)} onChange={event => onChange({ teacherPreparation: parseLines(event.target.value) })} /></label>
    <label>学生课前准备（每行一条）<textarea rows={3} value={lines(draft.studentPreparation)} onChange={event => onChange({ studentPreparation: parseLines(event.target.value) })} /></label>
    <h3>教学过程</h3>
    {draft.process.map((item, index) => <fieldset key={`${index}-${item.name}`}><legend>{item.name} · {item.minutes} 分钟</legend>
      <label>教师活动<textarea rows={4} value={item.teacherActivity} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, teacherActivity: event.target.value } : row) })} /></label>
      <label>学生活动<textarea rows={3} value={item.studentActivity} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, studentActivity: event.target.value } : row) })} /></label>
      <label>关键提问<input value={item.question} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, question: event.target.value } : row) })} /></label>
      <label>检查要点<input value={item.check} onChange={event => onChange({ process: draft.process.map((row, i) => i === index ? { ...row, check: event.target.value } : row) })} /></label>
    </fieldset>)}
    <label>课后作业（每行一条）<textarea rows={3} value={lines(draft.homework)} onChange={event => onChange({ homework: parseLines(event.target.value) })} /></label>
    <label>板书设计（每行一条）<textarea rows={4} value={lines(draft.blackboardDesign)} onChange={event => onChange({ blackboardDesign: parseLines(event.target.value) })} /></label>
  </div>
}
