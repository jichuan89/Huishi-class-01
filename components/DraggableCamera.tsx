import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Position = { x: number; y: number };
const storageKey = 'classroom-camera-position';

export default function DraggableCamera({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointer: number; x: number; y: number; origin: Position } | null>(null);
  const [position, setPosition] = useState<Position | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null;
    } catch { return null; }
  });
  const positionRef = useRef(position);
  const constrain = (desired: Position | null) => {
    const element = elementRef.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const maxX = Math.max(0, parent.clientWidth - element.offsetWidth - 8);
    const maxY = Math.max(0, parent.clientHeight - element.offsetHeight - 84);
    const next = {
      x: Math.max(0, Math.min(maxX, desired?.x ?? maxX - 16)),
      y: Math.max(0, Math.min(maxY, desired?.y ?? maxY)),
    };
    positionRef.current = next;
    setPosition(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
  };
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element?.parentElement) return;
    const observer = new ResizeObserver(() => {
      dragRef.current = null;
      constrain(positionRef.current);
    });
    observer.observe(element.parentElement);
    observer.observe(element);
    constrain(positionRef.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={elementRef} className={`draggable-camera${hidden ? ' is-hidden' : ''}`}
    style={{ left: position?.x ?? 0, top: position?.y ?? 0 }}
    onPointerDown={(event) => {
      event.stopPropagation();
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      dragRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: positionRef.current || { x: 0, y: 0 } };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      event.stopPropagation();
      const drag = dragRef.current;
      if (!drag || drag.pointer !== event.pointerId) return;
      constrain({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y });
    }}
    onPointerUp={(event) => {
      event.stopPropagation();
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { dragRef.current = null; }}
    onLostPointerCapture={() => { dragRef.current = null; }}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()}>
    {children}
  </div>;
}
