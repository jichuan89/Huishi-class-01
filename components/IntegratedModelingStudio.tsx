import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, Grid, OrbitControls, useGLTF } from '@react-three/drei';
import {
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  ImagePlus,
  Layers3,
  Loader2,
  RotateCcw,
  Server,
  UploadCloud,
} from 'lucide-react';
import * as THREE from 'three';

type Mode = 'single' | 'multiview';
type ViewKey = 'front' | 'left' | 'right' | 'back';
type Part = {
  name: string;
  partKey?: string;
  partLabel?: string;
  method?: string;
  confidence?: number;
  faceCount?: number;
  vertexCount?: number;
};
type SegmentationResult = {
  provider?: string;
  status?: string;
  partCount?: number;
  hierarchical?: boolean;
  license?: string;
  warnings?: string[];
};
type Result = {
  status: string;
  editable: boolean;
  message: string;
  glbUrl: string;
  blendUrl: string;
  previewUrl: string;
  parts: Part[];
  warnings?: string[];
  segmentation?: SegmentationResult | null;
  separation?: { status: string; warnings?: string[] };
  engine?: string;
};
type EngineStatus = {
  provider?: string;
  blenderAvailable?: boolean;
  apiBase?: string;
  segmentation?: {
    provider?: string;
    available?: boolean;
    license?: string;
    fallback?: string;
    warnings?: string[];
  };
  singleImage?: { available: boolean };
  multiview?: { available: boolean };
};
type Options = {
  textureResolution: string;
  foregroundRatio: string;
  vertexCount: string;
  removeBackground: boolean;
};

const viewLabels: Record<ViewKey, string> = {
  front: '正面',
  left: '左侧',
  right: '右侧',
  back: '背面',
};

function UploadedModel({ url, hidden, exploded, selected }: { url: string; hidden: string[]; exploded: boolean; selected: string }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    meshes.forEach((object, index) => {
      const key = String(object.userData.partKey || object.name || `part_${index}`);
      object.visible = !hidden.some((item) => key.includes(item) || item.includes(key));
      object.position.set(
        exploded ? ((index % 3) - 1) * 0.32 : 0,
        exploded ? (Math.floor(index / 3) % 3 - 1) * 0.24 : 0,
        exploded ? (index % 2 ? 0.2 : -0.2) : 0,
      );
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      materials.forEach((material) => {
        if ('emissive' in material) {
          (material as THREE.MeshStandardMaterial).emissive.set(selected && (key.includes(selected) || selected.includes(key)) ? '#216b69' : '#000000');
        }
      });
    });
  }, [copy, hidden, exploded, selected]);

  return <primitive object={copy} />;
}

function Preview({ url, hidden, exploded, showGrid, selected }: { url: string; hidden: string[]; exploded: boolean; showGrid: boolean; selected: string }) {
  return (
    <div className="modeling-preview-canvas">
      <Canvas camera={{ position: [0.2, -5, 1], fov: 42 }}>
        <color attach="background" args={['#0b0d11']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 7, 4]} intensity={2.2} />
        <directionalLight position={[-4, 2, -4]} intensity={0.8} />
        {showGrid && <Grid args={[30, 30]} cellSize={0.5} cellThickness={0.7} cellColor="#29333b" sectionSize={2.5} sectionThickness={1.2} sectionColor="#3b4a55" fadeDistance={24} position={[0, -1.25, 0]} />}
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.25}>
            <Center>
              <UploadedModel url={url} hidden={hidden} exploded={exploded} selected={selected} />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}

export default function IntegratedModelingStudio({ onBack, onUseModel }: { onBack: () => void; onUseModel?: (url: string) => void }) {
  const [mode, setMode] = useState<Mode>('single');
  const [single, setSingle] = useState<File | null>(null);
  const [views, setViews] = useState<Partial<Record<ViewKey, File>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [options, setOptions] = useState<Options>({ textureResolution: '1024', foregroundRatio: '0.85', vertexCount: '-1', removeBackground: true });
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [exploded, setExploded] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('等待上传');
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>(['建模工作区已就绪']);

  useEffect(() => {
    fetch('/api/prep/3d/status', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        setEngine(data);
        setLogs((items) => [...items, `服务：${data.provider || 'local'}，PartField：${data.segmentation?.available ? '可用' : '几何兜底'}`]);
      })
      .catch(() => setLogs((items) => [...items, '服务检查失败']));
  }, []);

  const choose = (file: File | undefined, key: ViewKey | 'single') => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError('仅支持 PNG、JPG 或 WebP 图片');
    if (file.size > 12 * 1024 * 1024) return setError('单张图片不能超过 12MB');
    setError('');
    if (key === 'single') setSingle(file);
    else setViews((current) => ({ ...current, [key]: file }));
    setLogs((items) => [...items, `已选择 ${key === 'single' ? '参考图' : viewLabels[key]}：${file.name}`]);
  };

  const submit = async () => {
    if (mode === 'single' && !single) return setError('请先上传一张图片');
    if (mode === 'multiview' && (Object.keys(viewLabels) as ViewKey[]).some((key) => !views[key])) return setError('请补齐正面、左侧、右侧和背面四张图片');
    setBusy(true);
    setError('');
    setResult(null);
    setHidden([]);
    setSelected('');
    setStage('上传参考图');
    setLogs((items) => [...items, `提交 ${mode === 'single' ? '单图' : '四视图'} 建模任务`]);

    const body = new FormData();
    if (mode === 'single') body.append('image', single!);
    else (Object.keys(viewLabels) as ViewKey[]).forEach((key) => body.append(key, views[key]!));
    body.append('texture_resolution', options.textureResolution);
    body.append('foreground_ratio', options.foregroundRatio);
    body.append('vertex_count', options.vertexCount);
    body.append('remove_bg', String(options.removeBackground));
    body.append('separate_parts', 'true');

    try {
      setStage('重建与 PartField 拆件');
      const response = await fetch(mode === 'single' ? '/api/models/jobs/single-image' : '/api/models/jobs/multiview', { method: 'POST', credentials: 'include', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `生成失败：${response.status}`);
      if (!data.job?.id) throw new Error('服务未返回建模任务编号');
      setLogs((items) => [...items, `任务编号：${data.job.id}`, '正在生成原始 GLB']);

      let finished: Result | null = null;
      for (let attempt = 0; attempt < 600; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, attempt < 4 ? 1000 : 2000));
        const poll = await fetch(`/api/models/jobs/${data.job.id}`, { credentials: 'include' });
        const state = await poll.json().catch(() => ({}));
        if (!poll.ok) throw new Error(state.message || '任务状态读取失败');
        if (state.job?.status === 'failed') throw new Error(state.job.error || '建模任务失败');
        if (state.job?.status === 'completed' && state.model) {
          finished = state.model;
          break;
        }
      }
      if (!finished) throw new Error('建模任务处理超时，请稍后查看模型记录');
      setStage('生成完成');
      setResult(finished);
      const segmentation = finished.segmentation?.provider || 'geometric';
      setLogs((items) => [...items, `生成完成：${finished.parts.length} 个部件`, `拆件：${segmentation} / ${finished.segmentation?.status || 'fallback'}`]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '模型生成失败';
      setStage('生成失败');
      setError(message);
      setLogs((items) => [...items, `失败：${message}`]);
    } finally {
      setBusy(false);
    }
  };

  const partKey = (part: Part) => part.partKey || part.name;
  const togglePart = (part: Part) => setHidden((current) => (current.includes(partKey(part)) ? current.filter((key) => key !== partKey(part)) : [...current, partKey(part)]));
  const isolatePart = (part: Part) => setHidden((result?.parts || []).filter((item) => partKey(item) !== partKey(part)).map(partKey));
  const warnings = Array.from(new Set([...(result?.warnings || []), ...(result?.segmentation?.warnings || []), ...(result?.separation?.warnings || [])]));
  const ready = Boolean(engine?.blenderAvailable && (mode === 'single' ? engine.singleImage?.available : engine.multiview?.available));
  const segmentationAvailable = Boolean(engine?.segmentation?.available);
  const licenseText = engine?.segmentation?.license || result?.segmentation?.license || 'PartField non-commercial research/education license';

  return (
    <section className="integrated-modeling sf3d-workbench">
      <aside className="modeling-controls">
        <div className="modeling-controls-head">
          <button type="button" className="modeling-back" onClick={onBack}><ChevronLeft size={17} />课堂</button>
          <span className={`modeling-status ${ready ? 'ready' : ''}`}><i />{ready ? '服务就绪' : '检查服务'}</span>
        </div>

        <div className="modeling-title">
          <span className="eyebrow">3D ASSET LAB</span>
          <h1>图像生成 3D</h1>
          <p>本地重建后优先使用 PartField 拆件；不可用时回退到几何拆分。</p>
        </div>

        <section className="sf3d-card">
          <h2><span>01</span>服务状态</h2>
          <div className="sf3d-service-state"><Server size={15} /><span>{engine?.provider || 'local'}</span><b>{engine?.blenderAvailable ? 'Blender 已连接' : 'Blender 未连接'}</b></div>
          <div className={`partfield-license ${segmentationAvailable ? 'ready' : ''}`}>
            <Layers3 size={15} />
            <span>PartField {segmentationAvailable ? '可用' : '几何兜底'}</span>
            <small>{licenseText}。仅限非商业研究/教育使用。</small>
          </div>
        </section>

        <section className="sf3d-card">
          <h2><span>02</span>输入参数</h2>
          <div className="modeling-tabs">
            <button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>单张图片</button>
            <button type="button" className={mode === 'multiview' ? 'active' : ''} onClick={() => setMode('multiview')}>四视图</button>
          </div>

          {mode === 'single' ? (
            <label className="single-drop">
              <ImagePlus size={24} />
              <strong>{single?.name || '上传参考图片'}</strong>
              <small>PNG / JPG / WebP，最大 12MB</small>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0], 'single')} />
            </label>
          ) : (
            <div className="view-upload-grid">
              {(Object.keys(viewLabels) as ViewKey[]).map((key) => (
                <label key={key} className={`view-slot ${views[key] ? 'ready' : ''}`}>
                  <UploadCloud size={16} />
                  <strong>{viewLabels[key]}</strong>
                  <small>{views[key]?.name || '选择图片'}</small>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0], key)} />
                </label>
              ))}
            </div>
          )}

          <div className="sf3d-parameter-grid">
            <label>贴图分辨率<select value={options.textureResolution} onChange={(event) => setOptions((current) => ({ ...current, textureResolution: event.target.value }))}>{['512', '1024', '1536', '2048'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>前景占比<input type="number" min="0.5" max="1" step="0.05" value={options.foregroundRatio} onChange={(event) => setOptions((current) => ({ ...current, foregroundRatio: event.target.value }))} /></label>
            <label>目标顶点数<input type="number" value={options.vertexCount} onChange={(event) => setOptions((current) => ({ ...current, vertexCount: event.target.value }))} /></label>
            <label className="sf3d-checkbox"><input type="checkbox" checked={options.removeBackground} onChange={(event) => setOptions((current) => ({ ...current, removeBackground: event.target.checked }))} />自动移除背景</label>
          </div>

          {mode === 'multiview' && <p className="modeling-local-note">当前重建仍以前视图为主，四视图会随任务归档，不标记为真正多视图融合。</p>}
          {error && <div className="modeling-error">{error}</div>}
          <button type="button" className="modeling-generate" disabled={busy || !ready} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={17} /> : <Box size={17} />}{busy ? stage : '开始生成'}</button>
        </section>
      </aside>

      <main className="modeling-stage">
        <div className="modeling-stage-toolbar">
          <span><Box size={15} />生成结果</span>
          <div>
            <button type="button" onClick={() => setShowGrid((value) => !value)}>地面网格</button>
            <button type="button" onClick={() => { setHidden([]); setSelected(''); setExploded(false); }}><RotateCcw size={14} />复位</button>
          </div>
        </div>
        {result?.glbUrl ? <Preview url={result.glbUrl} hidden={hidden} exploded={exploded} showGrid={showGrid} selected={selected} /> : <div className="modeling-empty"><Box size={52} /><strong>{busy ? stage : '尚未生成'}</strong><span>上传图片后开始生成，模型会显示在这里</span></div>}
        {result && (
          <div className="sf3d-result-meta">
            <span><CheckCircle2 size={14} />{result.segmentation?.provider || result.engine || 'geometric'}</span>
            <span>{result.segmentation?.status || result.separation?.status || result.status}</span>
            <span>{result.parts.length} 个部件</span>
          </div>
        )}
      </main>

      <aside className="modeling-parts">
        <div className="parts-head">
          <div><span className="eyebrow">PART TREE</span><h2>部件树</h2></div>
          <button type="button" disabled={!result || result.parts.length < 2} onClick={() => setExploded((value) => !value)}>{exploded ? '组合' : '拆解'}</button>
        </div>
        {result ? (
          <>
            <p className={`separation-note ${result.segmentation?.status === 'completed' ? 'good' : 'warn'}`}>{result.message}</p>
            {warnings.map((warning) => <p className="separation-note warn" key={warning}>{warning}</p>)}
            <div className="parts-list">
              {result.parts.map((part) => (
                <div className={selected === partKey(part) ? 'selected' : ''} key={partKey(part)}>
                  <button type="button" onClick={() => setSelected(partKey(part))}><b>{part.partLabel || part.name}</b><small>{Math.round((part.confidence || 0) * 100)}%</small></button>
                  <button type="button" title="隐藏或显示部件" onClick={() => togglePart(part)}>{hidden.includes(partKey(part)) ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  <button type="button" title="仅显示该部件" onClick={() => isolatePart(part)}>单独</button>
                </div>
              ))}
            </div>
            <div className="artifact-list">
              {result.glbUrl && <a href={result.glbUrl} download><Download size={15} />下载 GLB</a>}
              {result.blendUrl && <a href={result.blendUrl} download><FileArchive size={15} />下载 Blender</a>}
              {result.previewUrl && <a href={result.previewUrl} download><Download size={15} />下载预览图</a>}
            </div>
            {onUseModel && result.glbUrl && <button type="button" className="use-model" onClick={() => onUseModel(result.glbUrl)}>加载到课堂</button>}
          </>
        ) : (
          <div className="parts-empty">生成完成后，这里显示可隐藏、隔离和拆解查看的独立部件。</div>
        )}
      </aside>

      <div className={`modeling-log-drawer ${logsOpen ? 'open' : ''}`}>
        <button type="button" onClick={() => setLogsOpen((value) => !value)}>
          <ChevronUp size={15} />
          请求日志
          <span>{logs.length}</span>
        </button>
        <div>{logs.map((entry, index) => <p key={`${entry}-${index}`}><time>{String(index + 1).padStart(2, '0')}</time>{entry}</p>)}</div>
      </div>
    </section>
  );
}
