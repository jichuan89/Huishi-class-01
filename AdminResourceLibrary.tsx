import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Atom,
  Box,
  Check,
  FileBox,
  FlaskConical,
  FolderOpen,
  Globe2,
  HeartPulse,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  fetchResourceLibrary,
  type ResourceIconKey,
  type ResourceModel,
  type ResourceTag,
} from './services/resourceLibrary';

interface AdminResourceLibraryProps {
  refreshKey: number;
}

const ICON_OPTIONS: Array<{
  key: ResourceIconKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'box', label: '通用', icon: Box },
  { key: 'flask', label: '化学', icon: FlaskConical },
  { key: 'heart', label: '生物', icon: HeartPulse },
  { key: 'globe', label: '地理', icon: Globe2 },
  { key: 'atom', label: '科学', icon: Atom },
];

const ICONS = Object.fromEntries(
  ICON_OPTIONS.map((option) => [option.key, option.icon]),
) as Record<ResourceIconKey, React.ComponentType<{ className?: string }>>;

async function readError(response: Response) {
  try {
    const data = await response.json();
    return data.message || '请求失败';
  } catch {
    return '请求失败';
  }
}

function formatSize(size: number) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const AdminResourceLibrary: React.FC<AdminResourceLibraryProps> = ({ refreshKey }) => {
  const [tags, setTags] = useState<ResourceTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagIcon, setNewTagIcon] = useState<ResourceIconKey>('box');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [editingModelName, setEditingModelName] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextTags = await fetchResourceLibrary();
      setTags(nextTags);
      setSelectedTagId((current) => (
        current && nextTags.some((tag) => tag.id === current) ? current : nextTags[0]?.id || null
      ));
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '资源库加载失败',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary, refreshKey]);

  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedTagId) || null,
    [selectedTagId, tags],
  );

  const createTag = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    setBusyKey('create-tag');
    setNotice(null);
    try {
      const response = await fetch('/api/admin/resource-tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, iconKey: newTagIcon }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setNewTagName('');
      setNewTagIcon('box');
      await loadLibrary();
      setSelectedTagId(data.tag.id);
      setNotice({ type: 'success', text: `标签“${data.tag.name}”已创建` });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : '标签创建失败' });
    } finally {
      setBusyKey(null);
    }
  };

  const saveTagName = async (tag: ResourceTag) => {
    const name = editingTagName.trim();
    if (!name) return;
    setBusyKey(`tag-${tag.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/resource-tags/${tag.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setEditingTagId(null);
      await loadLibrary();
      setNotice({ type: 'success', text: '标签名称已更新' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : '标签更新失败' });
    } finally {
      setBusyKey(null);
    }
  };

  const deleteTag = async (tag: ResourceTag) => {
    if (tag.models.length > 0) return;
    if (!window.confirm(`确定删除标签“${tag.name}”吗？`)) return;
    setBusyKey(`tag-${tag.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/resource-tags/${tag.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await readError(response));
      await loadLibrary();
      setNotice({ type: 'success', text: '标签已删除' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : '标签删除失败' });
    } finally {
      setBusyKey(null);
    }
  };

  const uploadModel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTag) return;
    const primaryFile = modelFiles.find((file) => /\.(glb|gltf|fbx)$/i.test(file.name));
    if (!primaryFile) {
      setNotice({ type: 'error', text: '请选择 GLB、GLTF 或 FBX 主模型文件' });
      return;
    }

    const formData = new FormData();
    formData.set('tagId', String(selectedTag.id));
    formData.set('name', modelName.trim() || primaryFile.name.replace(/\.[^.]+$/, ''));
    formData.set('primaryFileName', primaryFile.name);
    modelFiles.forEach((file) => formData.append('files', file));

    setBusyKey('upload-model');
    setNotice(null);
    try {
      const response = await fetch('/api/admin/resource-models', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setModelName('');
      setModelFiles([]);
      setFileInputKey((current) => current + 1);
      await loadLibrary();
      setSelectedTagId(selectedTag.id);
      setNotice({ type: 'success', text: `模型“${data.model.name}”已添加` });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : '模型上传失败' });
    } finally {
      setBusyKey(null);
    }
  };

  const updateModel = async (model: ResourceModel, patch: { name?: string; tagId?: number }) => {
    setBusyKey(`model-${model.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/resource-models/${model.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(await readError(response));
      setEditingModelId(null);
      await loadLibrary();
      setNotice({ type: 'success', text: patch.tagId ? '模型已移动' : '模型名称已更新' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : '模型更新失败' });
    } finally {
      setBusyKey(null);
    }
  };

  const deleteModel = async (model: ResourceModel) => {
    if (!window.confirm(`确定删除模型“${model.name}”吗？`)) return;
    setBusyKey(`model-${model.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/resource-models/${model.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await readError(response));
      await loadLibrary();
      setNotice({ type: 'success', text: '模型已删除' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : '模型删除失败' });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-line/10 bg-white/[0.03] shadow-2xl shadow-black/25">
      {notice && (
        <div className={`border-b px-5 py-3 text-sm ${notice.type === 'error' ? 'border-red-300/20 bg-red-500/10 text-red-100' : 'border-emerald-300/20 bg-emerald-500/10 text-emerald-700'}`}>
          {notice.text}
        </div>
      )}

      <div className="grid min-h-[620px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-line/10 bg-cyan/10 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink">资源标签</h2>
            <span className="text-xs text-ink/55">{tags.length}</span>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-md border border-violet-300/15 bg-violet-300/[0.06] px-3 py-2.5 text-sm text-violet-700">
            <FolderOpen className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate font-semibold">我的模型</span>
            <LockKeyhole className="h-3.5 w-3.5 text-violet-200/50" aria-label="浏览器本地固定标签" />
          </div>

          <div className="space-y-1">
            {isLoading && tags.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink/45">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在加载
              </div>
            ) : tags.map((tag) => {
              const TagIcon = ICONS[tag.iconKey] || Box;
              const isEditing = editingTagId === tag.id;
              return (
                <div key={tag.id} className={`rounded-md border ${selectedTagId === tag.id ? 'border-cyan/25 bg-cyan-300/10' : 'border-transparent hover:bg-white/[0.04]'}`}>
                  {isEditing ? (
                    <div className="flex items-center gap-1 p-1.5">
                      <input
                        autoFocus
                        value={editingTagName}
                        onChange={(event) => setEditingTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void saveTagName(tag);
                          if (event.key === 'Escape') setEditingTagId(null);
                        }}
                        className="h-8 min-w-0 flex-1 rounded-md border border-line/15 bg-cyan/25 px-2 text-sm text-ink outline-none focus:border-cyan/50"
                      />
                      <button type="button" onClick={() => void saveTagName(tag)} className="grid h-8 w-8 place-items-center rounded-md text-emerald-200 hover:bg-emerald-300/10" title="保存">
                        <Check className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditingTagId(null)} className="grid h-8 w-8 place-items-center rounded-md text-ink/50 hover:bg-white/10" title="取消">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 p-1">
                      <button type="button" onClick={() => setSelectedTagId(tag.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm">
                        <TagIcon className="h-4 w-4 shrink-0 text-cyan/80" />
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink/80">{tag.name}</span>
                        <span className="text-xs text-ink/35">{tag.models.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagId(tag.id);
                          setEditingTagName(tag.name);
                        }}
                        disabled={busyKey !== null}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink/35 hover:bg-white/10 hover:text-ink/75 disabled:opacity-40"
                        title="重命名标签"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTag(tag)}
                        disabled={tag.models.length > 0 || busyKey !== null}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink/35 hover:bg-red-400/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-25"
                        title={tag.models.length > 0 ? '请先移动或删除标签内模型' : '删除标签'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={createTag} className="mt-4 space-y-2 border-t border-line/10 pt-4">
            <input
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder="新标签名称"
              maxLength={64}
              className="h-10 w-full rounded-md border border-line/10 bg-cyan/20 px-3 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-cyan/45"
            />
            <div className="flex gap-2">
              <select
                value={newTagIcon}
                onChange={(event) => setNewTagIcon(event.target.value as ResourceIconKey)}
                className="h-10 min-w-0 flex-1 rounded-md border border-line/10 bg-cyan-50 px-2 text-sm text-ink/70 outline-none focus:border-cyan/45"
              >
                {ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              <button
                type="submit"
                disabled={!newTagName.trim() || busyKey !== null}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-cyan/20 bg-cyan-300/10 px-3 text-sm font-bold text-cyan transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> 添加
              </button>
            </div>
          </form>
        </aside>

        <div className="min-w-0 p-5 lg:p-6">
          {!selectedTag ? (
            <div className="grid min-h-[480px] place-items-center text-sm text-ink/55">请先添加资源标签</div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">{selectedTag.name}</h2>
                  <p className="mt-1 text-sm text-ink/55">{selectedTag.models.length} 个模型</p>
                </div>
              </div>

              <form onSubmit={uploadModel} className="mb-6 grid gap-3 rounded-lg border border-line/10 bg-cyan/15 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-semibold text-ink/45">模型名称</span>
                  <input
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder="默认使用文件名"
                    maxLength={64}
                    className="h-10 w-full rounded-md border border-line/10 bg-cyan/20 px-3 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-cyan/45"
                  />
                </label>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-line/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink/65 transition hover:bg-white/[0.08] hover:text-ink">
                  <Upload className="h-4 w-4" />
                  <span className="max-w-[180px] truncate">{modelFiles.length > 0 ? `已选 ${modelFiles.length} 个文件` : '选择模型文件'}</span>
                  <input
                    key={fileInputKey}
                    type="file"
                    multiple
                    accept=".glb,.gltf,.fbx,.bin,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tga,.ktx,.ktx2,.dds"
                    className="hidden"
                    onChange={(event) => {
                      const files: File[] = event.target.files ? [...event.target.files] : [];
                      setModelFiles(files);
                      const primaryFile = files.find((file) => /\.(glb|gltf|fbx)$/i.test(file.name));
                      if (primaryFile && !modelName.trim()) setModelName(primaryFile.name.replace(/\.[^.]+$/, ''));
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={modelFiles.length === 0 || busyKey !== null}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-bold text-[#06212a] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyKey === 'upload-model' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  添加模型
                </button>
              </form>

              <div className="overflow-x-auto rounded-lg border border-line/10">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[minmax(220px,1.5fr)_90px_100px_170px_100px] gap-3 border-b border-line/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-ink/55">
                    <span>模型</span>
                    <span>格式</span>
                    <span>大小</span>
                    <span>标签</span>
                    <span className="text-right">操作</span>
                  </div>
                  {selectedTag.models.length === 0 ? (
                    <div className="px-4 py-14 text-center text-sm text-ink/55">暂无模型</div>
                  ) : (
                    <div className="divide-y divide-white/8">
                      {selectedTag.models.map((model) => {
                        const isEditing = editingModelId === model.id;
                        return (
                          <div key={model.id} className="grid grid-cols-[minmax(220px,1.5fr)_90px_100px_170px_100px] items-center gap-3 px-4 py-3 text-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cyan-300/10 text-cyan">
                                <FileBox className="h-4 w-4" />
                              </span>
                              {isEditing ? (
                                <div className="flex min-w-0 flex-1 gap-1">
                                  <input
                                    autoFocus
                                    value={editingModelName}
                                    onChange={(event) => setEditingModelName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' && editingModelName.trim()) void updateModel(model, { name: editingModelName.trim() });
                                      if (event.key === 'Escape') setEditingModelId(null);
                                    }}
                                    className="h-8 min-w-0 flex-1 rounded-md border border-line/15 bg-cyan/25 px-2 text-sm text-ink outline-none focus:border-cyan/50"
                                  />
                                  <button type="button" onClick={() => void updateModel(model, { name: editingModelName.trim() })} className="grid h-8 w-8 place-items-center rounded-md text-emerald-200 hover:bg-emerald-300/10" title="保存">
                                    <Check className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-ink/85" title={model.name}>{model.name}</div>
                                  <div className="mt-0.5 text-xs text-ink/35">{model.sourceKind === 'builtin' ? '内置资源' : '管理员上传'}</div>
                                </div>
                              )}
                            </div>
                            <span className="font-mono text-xs uppercase text-cyan/70">{model.type}</span>
                            <span className="text-xs text-ink/45">{formatSize(model.size)}</span>
                            <select
                              value={model.tagId}
                              disabled={busyKey !== null}
                              onChange={(event) => void updateModel(model, { tagId: Number(event.target.value) })}
                              className="h-9 w-full rounded-md border border-line/10 bg-cyan-50 px-2 text-xs text-ink/70 outline-none focus:border-cyan/45 disabled:opacity-40"
                            >
                              {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                            </select>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingModelId(model.id);
                                  setEditingModelName(model.name);
                                }}
                                disabled={busyKey !== null}
                                className="grid h-8 w-8 place-items-center rounded-md text-ink/55 hover:bg-white/10 hover:text-ink disabled:opacity-40"
                                title="重命名模型"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteModel(model)}
                                disabled={busyKey !== null}
                                className="grid h-8 w-8 place-items-center rounded-md text-ink/55 hover:bg-red-400/10 hover:text-red-600 disabled:opacity-40"
                                title="删除模型"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminResourceLibrary;

