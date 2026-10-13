import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { DragEvent } from 'react';
import { Bounds, Center, Grid, OrbitControls, useGLTF } from '@react-three/drei';
import {
  Box,
  CheckCircle2,
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
type SeparationMode = 'geometric' | 'anatomical';
type PreviewMode = 'appearance' | 'anatomy' | 'overlay' | 'cutaway';
type ViewKey = 'front' | 'left' | 'right' | 'back';
type Part = {
  name: string;
  partKey?: string;
  partLabel?: string;
  method?: string;
  confidence?: number;
  faceCount?: number;
  vertexCount?: number;
  labelEn?: string;
  layer?: string;
  group?: 'myocardium' | 'chambers' | 'septa' | 'vessels' | 'valves';
  semantic?: boolean;
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
  fullGlbUrl?: string;
  appearanceUrl?: string;
  blendUrl: string;
  previewUrl: string;
  parts: Part[];
  warnings?: string[];
  segmentation?: SegmentationResult | null;
  separation?: { status: string; warnings?: string[] };
  engine?: string;
  modelKind?: string;
  organType?: string;
  anatomyProfile?: string;
  layers?: string[];
  registration?: { status: 'aligned' | 'low_confidence'; confidence: number } | null;
  references?: Array<{ title: string; sourceUrl?: string; license?: string }>;
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

const groupLabels: Record<string, string> = {
  myocardium: '心肌',
  chambers: '心腔',
  septa: '间隔',
  vessels: '血管',
  valves: '瓣膜',
};

function UploadedModel({ url, hidden, exploded, selected, previewMode }: { url: string; hidden: string[]; exploded: boolean; selected: string; previewMode: PreviewMode }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((item) => item.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.userData.baseOpacity = material.opacity;
        material.userData.baseTransparent = material.transparent;
        material.userData.baseDepthWrite = material.depthWrite;
      });
      object.userData.basePosition = object.position.clone();
    });
    return cloned;
  }, [scene]);

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    const inLayer = (object: THREE.Object3D, layer: 'appearance' | 'anatomy') => {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current.userData.layer === layer || current.name.startsWith(layer === 'anatomy' ? 'Anatomy' : 'Appearance')) return true;
        current = current.parent;
      }
      return false;
    };
    meshes.forEach((object) => object.position.copy(object.userData.basePosition as THREE.Vector3));
    const anatomyMeshes = meshes.filter((object) => object.userData.layer === 'anatomy' || Boolean(object.userData.semantic) || inLayer(object, 'anatomy'));
    const anatomyBox = new THREE.Box3();
    anatomyMeshes.forEach((object) => anatomyBox.expandByObject(object));
    const anatomyCenter = anatomyBox.isEmpty() ? new THREE.Vector3() : anatomyBox.getCenter(new THREE.Vector3());
    const cutPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    meshes.forEach((object, index) => {
      const key = String(object.userData.partKey || object.name || `part_${index}`);
      const isAnatomy = object.userData.layer === 'anatomy' || Boolean(object.userData.semantic) || inLayer(object, 'anatomy');
      const isAppearance = object.userData.layer === 'appearance' || (!isAnatomy && inLayer(object, 'appearance'));
      const modeVisible = previewMode === 'appearance' ? isAppearance : previewMode === 'anatomy' ? isAnatomy : true;
      object.visible = modeVisible && (!isAnatomy || !hidden.some((item) => key.includes(item) || item.includes(key)));
      const base = object.userData.basePosition as THREE.Vector3;
      object.position.copy(base);
      if (exploded && isAnatomy) {
        const objectCenter = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
        const direction = objectCenter.sub(anatomyCenter).normalize();
        if (direction.lengthSq() < 0.01) direction.set((index % 3) - 1, (index % 2) - 0.5, 0.5).normalize();
        object.position.add(direction.multiplyScalar(0.72));
      }
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      materials.forEach((material) => {
        const baseOpacity = Number(material.userData.baseOpacity ?? 1);
        material.transparent = previewMode === 'overlay' && isAppearance ? true : Boolean(material.userData.baseTransparent || baseOpacity < 1);
        material.opacity = previewMode === 'overlay' && isAppearance ? 0.24 : baseOpacity;
        material.depthWrite = previewMode === 'overlay' && isAppearance ? false : Boolean(material.userData.baseDepthWrite ?? true);
        material.clippingPlanes = previewMode === 'cutaway' && (isAppearance || key === 'myocardium') ? [cutPlane] : [];
        material.needsUpdate = true;
        if ('emissive' in material) {
          (material as THREE.MeshStandardMaterial).emissive.set(selected && (key.includes(selected) || selected.includes(key)) ? '#216b69' : '#000000');
        }
      });
    });
  }, [copy, hidden, exploded, selected, previewMode]);

  return <primitive object={copy} />;
}
function Preview({ url, hidden, exploded, showGrid, selected, previewMode }: { url: string; hidden: string[]; exploded: boolean; showGrid: boolean; selected: string; previewMode: PreviewMode }) {
  return (
    <div className="modeling-preview-canvas">
      <Canvas camera={{ position: [0.2, -5, 1], fov: 42 }} gl={{ localClippingEnabled: true }}>
        <color attach="background" args={['#0b0d11']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 7, 4]} intensity={2.2} />
        <directionalLight position={[-4, 2, -4]} intensity={0.8} />
        {showGrid && <Grid args={[30, 30]} cellSize={0.5} cellThickness={0.7} cellColor="#29333b" sectionSize={2.5} sectionThickness={1.2} sectionColor="#3b4a55" fadeDistance={24} position={[0, -1.25, 0]} />}
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.25}>
            <Center>
              <UploadedModel url={url} hidden={hidden} exploded={exploded} selected={selected} previewMode={previewMode} />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
}

export default function IntegratedModelingStudio({ onBack: _onBack, onUseModel }: { onBack: () => void; onUseModel?: (url: string) => void }) {
  const [mode, setMode] = useState<Mode>('single');
  const [separationMode, setSeparationMode] = useState<SeparationMode>('anatomical');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('appearance');
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
  const [dragTarget, setDragTarget] = useState<string | null>(null);

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
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) return setError('仅支持 PNG、JPG 或 WebP 图片');
    if (file.size > 12 * 1024 * 1024) return setError('单张图片不能超过 12MB');
    setError('');
    if (key === 'single') setSingle(file);
    else setViews((current) => ({ ...current, [key]: file }));
    setLogs((items) => [...items, `已选择 ${key === 'single' ? '参考图' : viewLabels[key]}：${file.name}`]);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (target: string) => {
    setDragTarget(target);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragTarget(null);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, target: ViewKey | 'single') => {
    event.preventDefault();
    setDragTarget(null);
    choose(event.dataTransfer.files?.[0], target);
  };

  const submit = async () => {
    if (mode === 'single' && !single) return setError('请先上传一张图片');
    if (mode === 'multiview' && (Object.keys(viewLabels) as ViewKey[]).some((key) => !views[key])) return setError('请补齐正面、左侧、右侧和背面四张图片');
    setBusy(true);
    setError('');
    setResult(null);
    setHidden([]);
    setSelected('');
    setPreviewMode(separationMode === 'anatomical' ? 'appearance' : 'overlay');
    setStage('上传参考图');
    setLogs((items) => [...items, `提交 ${mode === 'single' ? '单图' : '四视角'} 生成任务`]);

    const body = new FormData();
    if (mode === 'single') body.append('image', single!);
    else (Object.keys(viewLabels) as ViewKey[]).forEach((key) => body.append(key, views[key]!));
    body.append('texture_resolution', options.textureResolution);
    body.append('foreground_ratio', options.foregroundRatio);
    body.append('vertex_count', options.vertexCount);
    body.append('remove_bg', String(options.removeBackground));
    body.append('separate_parts', 'true');
    body.append('separationMode', separationMode);
    if (separationMode === 'anatomical') {
      body.append('organType', 'heart');
      body.append('anatomyProfile', 'heart-v2');
    }

    try {
      setStage('混元 3D 正在生成高面数纹理模型');
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
      if (finished.appearanceUrl) {
        finished = {
          ...finished,
          fullGlbUrl: finished.glbUrl,
          glbUrl: finished.appearanceUrl,
          parts: [],
          modelKind: 'hunyuan3d-appearance',
        };
      }
      if (!finished.engine?.startsWith('hunyuan3d')) throw new Error('结果来源不是混元 3D，已阻止加载');
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
  const ready = Boolean(mode === 'single' ? engine?.singleImage?.available : engine?.multiview?.available);
  const segmentationAvailable = Boolean(engine?.segmentation?.available);
  const licenseText = engine?.segmentation?.license || result?.segmentation?.license || 'PartField non-commercial research/education license';
  const groupedParts = useMemo(() => {
    const groups = new Map<string, Part[]>();
    (result?.parts || []).forEach((part) => {
      const group = part.group || 'geometric';
      groups.set(group, [...(groups.get(group) || []), part]);
    });
    return Array.from(groups.entries());
  }, [result]);

  return (
    <section className="integrated-modeling sf3d-workbench">
      <aside className="modeling-controls">
        <div className="modeling-controls-head">
          <span className="modeling-module-label">模型生成工作区</span>
          <span className={`modeling-status ${ready ? 'ready' : ''}`}><i />{ready ? '服务就绪' : '检查服务'}</span>
        </div>

        <div className="modeling-title">
          <span className="eyebrow">3D ASSET LAB</span>
          <h1>图像生成 3D</h1>
          <p>{separationMode === 'anatomical' ? '使用混元生成完整外观，不附加内置解剖模板。' : '普通物体使用 PartField 几何拆件，不标记为医学语义。'}</p>
        </div>

        <section className="sf3d-card">
          <h2><span>01</span>服务状态</h2>
          <div className="sf3d-service-state"><Server size={15} /><span>{engine?.provider || 'local'}</span><b>{engine?.blenderAvailable ? 'Blender 已连接' : 'Blender 未连接'}</b></div>
          <div className={`partfield-license ${segmentationAvailable ? 'ready' : ''}`}>
            <Layers3 size={15} />
            <span>{separationMode === 'anatomical' ? '混元原始网格与材质' : `PartField ${segmentationAvailable ? '可用' : '几何兜底'}`}</span>
            <small>{separationMode === 'anatomical' ? '教学展示用途，结构与纹理需人工检查' : `${licenseText}。仅限非商业研究/教育使用。`}</small>
          </div>
        </section>

        <section className="sf3d-card">
          <h2><span>02</span>输入参数</h2>
          <div className="modeling-tabs">
            <button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>单张图片</button>
            <button type="button" className={mode === 'multiview' ? 'active' : ''} onClick={() => setMode('multiview')}>四视角生成</button>
          </div>

          <div className="anatomy-mode-selector" aria-label="拆解方式">
            <button type="button" className={separationMode === 'geometric' ? 'active' : ''} onClick={() => setSeparationMode('geometric')}>普通几何拆件</button>
            <button type="button" className={separationMode === 'anatomical' ? 'active' : ''} onClick={() => setSeparationMode('anatomical')}>器官解剖拆解</button>
          </div>
          {separationMode === 'anatomical' && (
            <div className="anatomy-profile-row">
              <label>器官类型<select value="heart" disabled><option value="heart">心脏</option></select></label>
              <label>详细度<select value="heart-v2" disabled><option value="heart-v2">标准教学级</option></select></label>
            </div>
          )}

          {mode === 'single' ? (
            <label
              className={`single-drop ${dragTarget === 'single' ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter('single')}
              onDragLeave={handleDragLeave}
              onDrop={(event) => handleDrop(event, 'single')}
            >
              <ImagePlus size={24} />
              <strong>{single?.name || '上传参考图片'}</strong>
              <small>点击选择，或直接拖入 PNG / JPG / WebP（最大 12MB）</small>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0], 'single')} />
            </label>
          ) : (
            <div className="view-upload-grid">
              {(Object.keys(viewLabels) as ViewKey[]).map((key) => (
                <label
                  key={key}
                  className={`view-slot ${views[key] ? 'ready' : ''} ${dragTarget === key ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragEnter={() => handleDragEnter(key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(event) => handleDrop(event, key)}
                >
                  <UploadCloud size={16} />
                  <strong>{viewLabels[key]}</strong>
                  <small>{views[key]?.name || '点击选择或拖入图片'}</small>
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

          {mode === 'multiview' && <p className="modeling-local-note">使用混元 3D 3.1 四视角输入：正面、左侧、右侧和背面。模型支持更多视角时，本页面仍只提交这四张。</p>}
          {error && <div className="modeling-error">{error}</div>}
          <button type="button" className="modeling-generate" disabled={busy || !ready} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={17} /> : <Box size={17} />}{busy ? stage : '开始生成'}</button>
        </section>
      </aside>

      <main className="modeling-stage">
        <div className="modeling-stage-toolbar">
          <span><Box size={15} />生成结果</span>
          <div>
            {result?.modelKind === 'dual-layer-anatomy' && (
              <div className="anatomy-preview-modes">
                {([['appearance', '外观'], ['anatomy', '解剖'], ['overlay', '叠加'], ['cutaway', '剖切']] as Array<[PreviewMode, string]>).map(([key, label]) => (
                  <button type="button" className={previewMode === key ? 'active' : ''} key={key} onClick={() => setPreviewMode(key)}>{label}</button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowGrid((value) => !value)}>地面网格</button>
            <button type="button" onClick={() => { setHidden([]); setSelected(''); setExploded(false); }}><RotateCcw size={14} />复位</button>
          </div>
        </div>
        {result?.glbUrl ? <Preview url={result.glbUrl} hidden={hidden} exploded={exploded} showGrid={showGrid} selected={selected} previewMode={previewMode} /> : <div className="modeling-empty"><Box size={52} /><strong>{busy ? stage : '尚未生成'}</strong><span>上传图片后开始生成，模型会显示在这里</span></div>}
        {result && (
          <div className="sf3d-result-meta">
            <span><CheckCircle2 size={14} />{result.segmentation?.provider || result.engine || 'geometric'}</span>
            <span>{result.segmentation?.status || result.separation?.status || result.status}</span>
            <span>{result.parts.length ? `${result.parts.length} 个可显示部件` : '仅显示混元 3D 外观'}</span>
            {result.registration && <span>配准 {Math.round(result.registration.confidence * 100)}%</span>}
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
            {result.parts.length > 0 ? <div className="parts-list">
              {groupedParts.map(([group, parts]) => (
                <section className="part-group" key={group}>
                  <h3>{groupLabels[group] || '几何部件'}<span>{parts.length}</span></h3>
                  {parts.map((part) => (
                    <div className={selected === partKey(part) ? 'selected' : ''} key={partKey(part)}>
                      <button type="button" onClick={() => setSelected(partKey(part))}><b>{part.partLabel || part.name}</b><small>{part.labelEn || `${Math.round((part.confidence || 0) * 100)}%`}</small></button>
                      <button type="button" title="隐藏或显示部件" onClick={() => togglePart(part)}>{hidden.includes(partKey(part)) ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button type="button" title="仅显示该部件" onClick={() => isolatePart(part)}>单独</button>
                    </div>
                  ))}
                </section>
              ))}
            </div> : <div className="parts-empty">当前仅显示 混元 3D 生成的完整外观，不显示低质量解剖模板部件。</div>}
            {result.references?.map((reference) => <p className="model-reference" key={reference.title}>来源：{reference.title} · {reference.license || '未标注许可'}</p>)}
            <div className="artifact-list">
              {(result.fullGlbUrl || result.glbUrl) && <a href={result.fullGlbUrl || result.glbUrl} download><Download size={15} />下载 GLB</a>}
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
