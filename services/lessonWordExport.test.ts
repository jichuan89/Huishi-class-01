import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { buildLessonWord, canExportLesson, lessonExportSections, lessonWordFilename } from './lessonWordExport.ts'
import type { LessonDesignWorkflow } from '../types/lessonDesign.ts'

const fixture = () => ({
  title: '心脏结构与功能', request: { stage: '本科', duration: '40', courseName: '解剖学' },
  designWorkflow: {
    version: 2, status: 'approved', duration: 40, abilityLevel: '基础层', qualityPending: false,
    quality: { blocking: [], warnings: [], score: 100, valid: true }, staleSteps: [],
    selectedObjectives: [{ id: 'obj-1', text: '教师修改后的目标：判断血流方向' }],
    steps: [
      { id: 'objectives', number: 1, title: '教学目标', approved: true, status: 'ready', data: { candidateGroups: [{ text: '未选择的候选目标' }] } },
      { id: 'activities-competencies', number: 4, title: '活动与能力', approved: true, status: 'ready', data: { activities: { activities: [{ name: '观察任务', studentAction: '标注瓣膜', evaluation: { standard: '方向全部正确' }, remediation: '使用箭头卡重做', teacherScript: ['请解释依据'] }] } } },
    ], phases: [{ name: '课堂导入', time: 5 }], alignmentMatrix: [{ objectiveId: 'obj-1', activityIds: ['activity-1'] }],
  } as unknown as LessonDesignWorkflow,
})

test('exports confirmed content including activity details without candidate objectives', async () => {
  const plan = fixture()
  const text = lessonExportSections(plan).flatMap(s => s.lines).join('\n')
  assert.match(text, /教师修改后的目标/)
  assert.match(text, /方向全部正确/)
  assert.match(text, /使用箭头卡重做/)
  assert.doesNotMatch(text, /未选择的候选目标/)
  const blob = await buildLessonWord(plan)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /心脏结构与功能/)
  assert.match(xml, /请解释依据/)
  assert.match(xml, /w:w="11906"/)
  assert.match(await zip.file('word/styles.xml')!.async('string'), /宋体/)
  assert.match(await zip.file('word/footer1.xml')!.async('string'), /PAGE/)
})

test('blocks export after edits, stale content, failed quality or missing approval', async () => {
  for (const patch of [{ status: 'review' }, { qualityPending: true }, { staleSteps: ['content'] }, { quality: { blocking: [{ message: '缺少目标' }] } }, { steps: [{ approved: false, status: 'ready' }] }]) {
    const plan = fixture()
    Object.assign(plan.designWorkflow, patch)
    assert.equal(canExportLesson(plan), false)
    await assert.rejects(buildLessonWord(plan), /确认整套教案/)
  }
})

test('supports legacy lessons and safe Word filenames', () => {
  const sections = lessonExportSections({ title: '旧教案', request: {}, objectives: ['理解概念'], homework: '完成练习' } as any)
  assert.ok(sections.some(s => s.title === '课后作业' && s.lines.includes('完成练习')))
  assert.equal(lessonWordFilename('心脏/结构:*?'), '心脏_结构____教案.docx')
})
