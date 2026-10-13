import { chromium } from '../../teacher-studio/frontend/node_modules/playwright/index.mjs';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

let savedManifest = null;
if (process.env.COURSEWARE_MANIFEST) {
  const manifestPath = path.resolve(process.env.COURSEWARE_MANIFEST);
  savedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!savedManifest.model.modelUrl.startsWith('/')) {
    savedManifest.model.modelUrl = '/' + path.relative(process.cwd(), path.resolve(path.dirname(manifestPath), savedManifest.model.modelUrl)).replaceAll('\\', '/');
  }
}
const sceneCount = savedManifest ? savedManifest.scenes.filter(scene => scene.enabled).length : 3;
const screenshotDirectory = savedManifest ? 'outputs/camera-courseware-real' : 'outputs/camera-courseware';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1536, height: 724 }, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
page.on('requestfailed', (request) => console.error(request.url(), request.failure()));
const source = `
import React from '/node_modules/.vite/deps/react.js';
const {useRef} = React;
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import Camera from '/components/DraggableCamera.tsx';
import Courseware from '/components/InteractiveCourseware.tsx';
import {CoursewareSwipeInput} from '/services/coursewareSwipeInput.ts';
import {describeHandCandidate} from '/services/handTargetTracker.ts';
import '/index.css';
const input=new CoursewareSwipeInput();
window.feedHand=(landmarks,at,side='Left',confidence=.95)=>{const candidate=landmarks?describeHandCandidate(landmarks,side,confidence):null;const result=input.update(candidate?[candidate]:[],at,4/3);if(result.direction)window.navigatePage(result.direction);return result;};
const manifest = ${savedManifest ? JSON.stringify(savedManifest) : "{title:'课件翻页验证', model:{parts:[]}, scenes:[1,2,3].map(n=>({id:String(n),enabled:true,type:'hook',layout:'cinematic-question',title:'第'+n+'页',claim:'摄像头拖动与翻页验证',studentAction:'观察',expectedOutput:'记录',motion:{durationMs:250}}))}"};
function App(){const navigationRef=useRef(null);const controls=useRef({});window.navigatePage=(direction)=>navigationRef.current?.(direction);return <div id="stage" style={{position:'relative',width:'100vw',height:'100vh'}} onClick={()=>window.stageClicks=(window.stageClicks||0)+1}><Courseware manifest={manifest} controlRef={controls} navigationRef={navigationRef} onExit={()=>{}} onStartQuiz={()=>{}}/><Camera hidden={false}><div className="draggable-camera-preview" style={{background:'#22444c'}}/><div className="lab-hand-status">手势识别已就绪</div></Camera></div>}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;
const compiled = await transform(source, { loader: 'jsx', format: 'esm' });
await page.route('**/__camera_test', route => route.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0"><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/__camera_test.js');</script></body></html>` }));
await page.route('**/__camera_test.js', route => route.fulfill({ contentType: 'application/javascript', body: compiled.code }));
try {
  await page.goto('http://localhost:3000/__camera_test');
  const camera = page.locator('.draggable-camera');
  await camera.waitFor();
  const checkBounds = async () => {
    const box = await camera.boundingBox();
    const stage = await page.locator('#stage').boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0);
    assert.ok(box.x + box.width <= stage.width);
    assert.ok(box.y + box.height <= stage.height - 84 + 1);
    return box;
  };
  let box = await checkBounds();
  await page.mouse.move(box.x + 50, box.y + 65);
  await page.mouse.down();
  await page.mouse.move(70, 90, {steps: 5});
  await page.mouse.up();
  box = await checkBounds();
  assert.ok(box.x < 100 && box.y < 100);
  assert.equal(await page.evaluate(()=>window.stageClicks||0),0);
  await page.reload();
  await camera.waitFor();
  assert.ok((await checkBounds()).x < 100);
  await page.evaluate(()=>window.navigatePage('previous'));
  assert.match(await page.locator('.courseware-runtime-kicker').innerText(),/01 \/ /);
  await page.evaluate(()=>{window.navigatePage('next');window.navigatePage('next')});
  await page.waitForFunction(()=>document.querySelector('.courseware-runtime-kicker')?.textContent.startsWith('03 /'));
  await page.getByRole('button',{name:'上一步'}).click();
  await page.waitForFunction(()=>document.querySelector('.courseware-runtime-kicker')?.textContent.startsWith('02 /'));
  let sampleAt = 0;
  const sampleHand = async (screenX, fingerRotation = 0) => {
    const rawX = 1 - screenX;
    const points = Array.from({length:21},()=>({x:rawX,y:.7}));
    for(const [base,offset] of [[5,-.04],[9,-.02]]) {
      for(let joint=0;joint<4;joint++) points[base+joint]={x:rawX+offset+joint*.08*Math.sin(fingerRotation),y:.65-joint*.08*Math.cos(fingerRotation)};
    }
    points[17]={x:rawX+.16,y:.65};
    sampleAt+=40;
    return page.evaluate(({points,at})=>window.feedHand(points,at),{points,at:sampleAt});
  };
  const holdHand = async (x) => {for(let i=0;i<30;i++) await sampleHand(x);};
  const moveHand = async (from,to) => {
    const directions=[];
    for(let i=1;i<=10;i++) {
      const result=await sampleHand(from+(to-from)*i/10);
      if(result.direction) directions.push(result.direction);
    }
    return directions;
  };
  const expectPage = async (number) => page.waitForFunction(number=>document.querySelector('.courseware-runtime-kicker')?.textContent.startsWith(String(number).padStart(2,'0')+' /'),number);
  await holdHand(.5);
  for(let i=0;i<10;i++) {
    assert.deepEqual(await moveHand(.5,.7),['next']);
    await expectPage(3);
    await holdHand(.7);
    assert.deepEqual(await moveHand(.7,.5),['previous']);
    await expectPage(2);
    await holdHand(.5);
  }
  for(let i=0;i<10;i++) {
    assert.deepEqual(await moveHand(.5,.3),['previous']);
    await expectPage(1);
    await holdHand(.3);
    assert.deepEqual(await moveHand(.3,.5),['next']);
    await expectPage(2);
    await holdHand(.5);
  }
  const moveFingers = async (rotation) => {
    const directions=[];
    for(let i=1;i<=10;i++) {
      const result=await sampleHand(.5,rotation*i/10);
      if(result.direction) directions.push(result.direction);
    }
    return directions;
  };
  for(let i=0;i<10;i++) {
    assert.deepEqual(await moveFingers(-.6),['next']);
    await expectPage(3);
    await holdHand(.5);
    assert.deepEqual(await moveFingers(.6),['previous']);
    await expectPage(2);
    await holdHand(.5);
  }
  await page.evaluate(count=>{for(let i=0;i<count;i++)window.navigatePage('next')},sceneCount);
  await expectPage(sceneCount);
  assert.deepEqual(await moveHand(.5,.7),['next']);
  await expectPage(sceneCount);
  await holdHand(.7);
  await page.evaluate(count=>{for(let i=0;i<count;i++)window.navigatePage('previous')},sceneCount);
  await expectPage(1);
  assert.deepEqual(await moveHand(.7,.5),['previous']);
  await expectPage(1);
  await page.evaluate(()=>window.navigatePage('next'));
  await expectPage(2);
  await mkdir(screenshotDirectory, {recursive:true});
  await page.screenshot({path:screenshotDirectory+'/desktop.png'});
  await page.locator('#stage').evaluate(element => element.requestFullscreen());
  await page.waitForTimeout(100);
  await checkBounds();
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForTimeout(100);
  await checkBounds();
  await page.setViewportSize({width:390,height:740});
  await page.waitForTimeout(100);
  box=await checkBounds();
  assert.equal(Math.round(box.width),168);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+60,y:box.y+65}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:380,y:690}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(100);
  box=await checkBounds();
  assert.ok(box.x>100 && box.y>400);
  await page.screenshot({path:screenshotDirectory+'/mobile.png'});
  await page.setViewportSize({width:900,height:400});
  await page.waitForTimeout(100);
  await checkBounds();
  assert.deepEqual(errors,[]);
  console.log('PASS: 40 whole-hand swipes and 20 stationary-palm finger swipes, page boundaries, buttons, drag, resize, fullscreen and persistence');
  if (savedManifest) console.log(JSON.stringify({title:savedManifest.title, scenes:sceneCount, manifest:process.env.COURSEWARE_MANIFEST}));
} finally { await browser.close(); }
