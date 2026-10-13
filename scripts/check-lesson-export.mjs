import { chromium } from '../../teacher-studio/frontend/node_modules/playwright/index.mjs'
import { transform } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
const source = `
import React from '/node_modules/.vite/deps/react.js';
const {useState}=React;
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
const {createRoot}=ReactDOM;
import Workflow from '/prep/UndergraduateDesignWorkflow.tsx';
import Export from '/prep/LessonExportPage.tsx';
import '/prep/prep-styles.css';
const initial={title:'心脏结构与功能',request:{courseName:'解剖学',duration:'40'},designWorkflow:{version:2,mode:'quick',status:'review',duration:40,abilityLevel:'基础层',currentStep:1,selectedObjectiveGroupId:'g1',selectedObjectives:[{id:'o1',text:'准确标注心脏结构',audience:'本科学生',condition:'根据结构图',behavior:'标注结构',degree:'正确率90%',bloomLevel:'应用'}],steps:[{id:'objectives',number:1,title:'专业能力目标',status:'ready',approved:false,data:{candidateGroups:[{id:'g1',name:'目标组',levelFit:'基础层',classroomDirection:'观察结构',objectives:[{id:'o1',text:'准确标注心脏结构',audience:'本科学生',condition:'根据结构图',behavior:'标注结构',degree:'正确率90%',bloomLevel:'应用'}]}]}}],phases:[{name:'观察与标注',time:10,teacher:'示范结构定位',student:'记录观察证据',check:'检查标注正确率'}],staleSteps:[],alignmentMatrix:[],generation:{engine:'ollama'},quality:{blocking:[],warnings:[],score:100,valid:true}}};
function App(){const [plan,setPlan]=useState(initial);const [view,setView]=useState('workflow');return <main style={{maxWidth:1100,margin:'auto',padding:16}}>{view==='workflow'?<Workflow plan={plan} onChange={setPlan} onNotice={()=>{}} onComplete={()=>setView('export')}/>:<Export plan={plan} editing={false} onBack={()=>setView('workflow')} onNotice={()=>{}}/>}</main>};createRoot(document.getElementById('root')).render(<App/>);`
const compiled = await transform(source, { loader: 'jsx', jsx: 'transform' })
await page.route('**/__lesson_export_check', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">${compiled.code.replaceAll('"react/jsx-runtime"', '"/node_modules/.vite/deps/react_jsx-runtime.js"')}</script></body></html>` }))
await page.route('**/api/prep/local-model/status', route => route.fulfill({ json: { available: true } }))
await page.route('**/api/prep/lesson-design/validate', async route => {
  const { workflow } = route.request().postDataJSON()
  workflow.status = 'approved'
  workflow.steps.forEach(step => { step.approved = true })
  await route.fulfill({ json: { lessonPlan: { designWorkflow: workflow }, workflow, quality: workflow.quality } })
})
try {
  await mkdir('outputs/lesson-export-check', { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://localhost:3001/__lesson_export_check')
  await page.getByRole('button', { name: '确认整套五步教案', exact: true }).click()
  await page.getByRole('heading', { name: '导出教案', exact: true }).waitFor()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Word' }).click()
  const download = await downloaded
  assert.equal(download.suggestedFilename(), '心脏结构与功能_教案.docx')
  await download.saveAs('outputs/lesson-export-check/sample.docx')
  await page.screenshot({ path: 'outputs/lesson-export-check/desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'outputs/lesson-export-check/mobile.png', fullPage: true })
  await page.getByRole('button', { name: '返回教案' }).click()
  await page.getByRole('heading', { name: '本科五步教学设计' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: confirmation, export page, Word download, return, desktop/mobile layout')
} finally { await browser.close() }
