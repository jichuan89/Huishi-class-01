import React, { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import XiaozhiMascot from './XiaozhiMascot';

interface KnowledgeNarrationPanelProps {
  content: string;
  isStreaming: boolean;
  isNarrating: boolean;
  narrationCharIndex: number | null;
  structureImage?: string;
  structureImageButtonRef?: React.Ref<HTMLButtonElement>;
  onStructureImageClick?: () => void;
  onClose?: () => void;
}

const KnowledgeNarrationPanel: React.FC<KnowledgeNarrationPanelProps> = ({
  content,
  isStreaming,
  isNarrating,
  narrationCharIndex,
  structureImage,
  structureImageButtonRef,
  onStructureImageClick,
  onClose,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const activeTokenRef = useRef<HTMLSpanElement>(null);
  const manualScrollUntilRef = useRef(0);

  const tokens = useMemo(() => {
    const result: Array<{ text: string; start: number; end: number }> = [];
    let text = '';
    let start = 0;
    let isLatinWord = false;
    let offset = 0;
    const flush = () => {
      if (text) result.push({ text, start, end: offset });
      text = '';
      isLatinWord = false;
    };

    for (const character of [...content]) {
      const characterLength = character.length;
      const nextIsLatinWord = /[A-Za-z0-9_+%°./-]/.test(character);
      if (!text || nextIsLatinWord !== isLatinWord || !nextIsLatinWord) {
        flush();
        start = offset;
        isLatinWord = nextIsLatinWord;
      }
      text += character;
      offset += characterLength;
      if (!nextIsLatinWord) flush();
    }
    flush();
    return result;
  }, [content]);

  const activeTokenIndex = useMemo(() => {
    if (!isNarrating || narrationCharIndex === null) return -1;
    return tokens.findIndex((token) => narrationCharIndex >= token.start && narrationCharIndex < token.end);
  }, [isNarrating, narrationCharIndex, tokens]);

  useEffect(() => {
    const container = contentRef.current;
    const activeToken = activeTokenRef.current;
    if (!container || !activeToken || activeTokenIndex < 0 || Date.now() < manualScrollUntilRef.current) return;

    const containerBounds = container.getBoundingClientRect();
    const tokenBounds = activeToken.getBoundingClientRect();
    const tokenTop = container.scrollTop + tokenBounds.top - containerBounds.top;
    const tokenBottom = tokenTop + tokenBounds.height;
    const visibleTop = container.scrollTop + container.clientHeight * 0.2;
    const visibleBottom = container.scrollTop + container.clientHeight * 0.72;
    if (tokenTop >= visibleTop && tokenBottom <= visibleBottom) return;

    // Progress events can arrive every 100 ms. Direct positioning keeps those
    // updates from repeatedly cancelling an in-flight smooth scroll animation.
    container.scrollTop = Math.max(0, tokenTop - container.clientHeight * 0.36);
  }, [activeTokenIndex]);

  const deferAutoScroll = () => {
    manualScrollUntilRef.current = Date.now() + 1_200;
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden text-slate-100" aria-label="知识讲解">
      <div className="flex h-full min-h-0 flex-col px-5 py-5">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line/[0.07] pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200">
              <XiaozhiMascot
                state={isNarrating ? 'explaining' : isStreaming ? 'analyzing' : 'complete'}
                size={38}
                motion={isNarrating || isStreaming ? 'stateful' : 'subtle'}
                speaking={isNarrating}
                ariaLabel={isNarrating ? '小智正在讲解' : isStreaming ? '小智正在生成讲解' : '小智已完成讲解'}
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[clamp(18px,1.25vw,25px)] font-black tracking-wide text-amber-100">
                知识讲解
              </h2>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
                <span className={`h-1.5 w-1.5 rounded-full ${isStreaming || isNarrating ? 'animate-pulse bg-amber-300' : 'bg-emerald-300'}`} />
                {isNarrating ? '正在播报' : isStreaming ? '内容生成中' : '讲解已生成'}
              </div>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-amber-300/20 hover:bg-amber-300/[0.08] hover:text-amber-200"
              aria-label="关闭知识讲解"
              title="关闭知识讲解"
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div
          ref={contentRef}
          onWheel={deferAutoScroll}
          onTouchStart={deferAutoScroll}
          onPointerDown={deferAutoScroll}
          onKeyDown={deferAutoScroll}
          tabIndex={0}
          aria-label="知识讲解正文，可上下滚动"
          className="knowledge-narration-scroll h-0 min-h-0 flex-1 overflow-y-auto pb-2 pt-4 pr-2 [scrollbar-color:rgba(251,191,36,0.42)_transparent]"
        >
          {structureImage && (
            <button
              ref={structureImageButtonRef}
              type="button"
              onClick={onStructureImageClick}
              className="group mx-auto flex h-[clamp(84px,14vh,132px)] w-full max-w-[180px] shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-2xl border border-line/10 bg-white/90 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.24)] transition hover:border-amber-300/35 hover:bg-white active:scale-[0.98]"
              aria-label="放大结构图"
              title="放大结构图"
            >
              <img
                src={structureImage}
                alt="结构图"
                className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
              />
            </button>
          )}

          <p className={`${structureImage ? 'mt-4' : ''} whitespace-pre-wrap text-[clamp(16px,1.15vw,21px)] font-medium leading-[1.75] text-slate-200`}>
            {tokens.map((token, index) => (
              <span
                key={`${token.start}-${token.end}`}
                ref={index === activeTokenIndex ? activeTokenRef : undefined}
              >
                {token.text}
              </span>
            ))}
            {isStreaming && <span className="ml-1 animate-pulse text-amber-300">|</span>}
          </p>
        </div>
      </div>
    </section>
  );
};

export default KnowledgeNarrationPanel;
