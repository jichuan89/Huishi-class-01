import React, { useEffect, useState } from 'react';
import { BookOpen, Lightbulb, Microscope } from 'lucide-react';
import type { ModelInfoProfile } from '../services/modelInfoProfiles';

interface ModelInfoCardProps {
  profile: ModelInfoProfile;
}

const CATEGORY_STYLES: Record<ModelInfoProfile['category'], string> = {
  化学: 'bg-violet-500/15 text-violet-200 border-violet-300/20',
  生物: 'bg-rose-500/15 text-rose-200 border-rose-300/20',
  地理: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/20',
};

const FALLBACK_ILLUSTRATIONS: Record<ModelInfoProfile['category'], string> = {
  化学: '/images/diamond-structure.png',
  生物: '/images/heart-structure.png',
  地理: '/images/earth-layers-diagram.png',
};

const ModelInfoCard: React.FC<ModelInfoCardProps> = ({ profile }) => {
  const [illustration, setIllustration] = useState(profile.illustration || FALLBACK_ILLUSTRATIONS[profile.category]);
  const disassemblyAvailable = profile.capabilities.disassemblyAvailable ?? profile.capabilities.organTools;
  const wireframeAvailable = profile.capabilities.wireframeAvailable !== false;
  const labelsAvailable = profile.seedKey.startsWith('geo-');

  useEffect(() => {
    setIllustration(profile.illustration || FALLBACK_ILLUSTRATIONS[profile.category]);
  }, [profile]);

  return (
  <section className="flex min-h-0 flex-1 flex-col" aria-label={`${profile.title}模型说明`}>
      <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-black ${CATEGORY_STYLES[profile.category]}`}>
            {profile.category}模型
          </span>
          <h2 className="mt-3 break-words text-2xl font-black text-white">{profile.title}</h2>
          <p className="mt-1 break-words text-xs font-bold text-cyan-200">{profile.subtitle}</p>
        </div>
        <img
          src={illustration}
          alt={`${profile.title}示意图`}
          onError={() => setIllustration(FALLBACK_ILLUSTRATIONS[profile.category])}
          className="h-[88px] w-[88px] shrink-0 rounded-full bg-white/5 object-contain p-2"
        />
      </header>

    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6 pt-4 [scrollbar-color:rgba(34,211,238,0.24)_transparent]">
      <p className="text-sm leading-7 text-slate-300">{profile.description}</p>

      <section aria-label="模型能力" className="space-y-2">
        {[
          { label: '真实拆解', available: disassemblyAvailable, detail: disassemblyAvailable ? '可按部件拆开展示结构关系' : '当前为单网格模型，暂不支持部件拆解' },
          { label: '线框观察', available: wireframeAvailable, detail: wireframeAvailable ? '可从网格层面辅助观察模型形态' : '当前模型未提供线框观察数据' },
          { label: '教学标签', available: labelsAvailable, detail: labelsAvailable ? '可显示模型内置的课堂提示标签' : '当前模型没有预设教学标签' },
        ].map((capability) => (
          <div key={capability.label} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${capability.available ? 'bg-cyan-300' : 'bg-slate-500'}`} />
            <span className="min-w-0"><b className="mr-2 text-slate-200">{capability.label}</b><span className="text-slate-400">{capability.detail}</span></span>
          </div>
        ))}
      </section>

      <section aria-label="关键数据">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
          <BookOpen size={13} /> 关键数据
        </div>
        <dl className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
          {profile.metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3">
              <dt className="text-[10px] font-bold tracking-wider text-slate-400">{metric.label}</dt>
              <dd className="mt-1 text-xs font-semibold leading-5 text-slate-200">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2" aria-label="知识提示">
        {profile.tips.map((tip, index) => {
          const Icon = index === 0 ? Microscope : Lightbulb;
          return (
            <div key={tip.title} className="flex gap-3 rounded-xl border border-cyan/10 bg-cyan-400/[0.05] p-3.5">
              <Icon size={15} className="mt-0.5 shrink-0 text-cyan-300" />
              <p className="text-xs leading-5 text-slate-300"><b className="mr-1 text-cyan-300">{tip.title}</b>{tip.content}</p>
            </div>
          );
        })}
      </section>
    </div>
  </section>
  );
};

export default ModelInfoCard;
