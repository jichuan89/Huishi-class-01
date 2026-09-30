import React, { useEffect, useId } from 'react';
import { animate, motion as Motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';

export type XiaozhiVisualState =
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'executing'
  | 'explaining'
  | 'questioning'
  | 'complete'
  | 'error';

export type XiaozhiMascotMotion = 'stateful' | 'subtle' | 'static';

export const XIAOZHI_STATE_META: Record<XiaozhiVisualState, { label: string; accent: string }> = {
  idle: { label: '待命中', accent: '#22d3ee' },
  analyzing: { label: '理解中', accent: '#60a5fa' },
  planning: { label: '规划中', accent: '#fbbf24' },
  executing: { label: '执行中', accent: '#34d399' },
  explaining: { label: '讲解中', accent: '#67e8f9' },
  questioning: { label: '出题中', accent: '#f9a8d4' },
  complete: { label: '完成啦', accent: '#e879f9' },
  error: { label: '需要帮忙', accent: '#fb7185' },
};

export interface XiaozhiMascotProps {
  state?: XiaozhiVisualState;
  size?: number;
  motion?: XiaozhiMascotMotion;
  speaking?: boolean;
  className?: string;
  ariaLabel?: string;
}

const roundedStarPath = 'M58 10 Q60 7 62 10 C65 28 70 37 84 43 C94 47 102 52 109 58 Q111 60 109 62 C102 68 94 73 84 77 C70 83 65 92 62 110 Q60 113 58 110 C55 92 50 83 36 77 C26 73 18 68 11 62 Q9 60 11 58 C18 52 26 47 36 43 C50 37 55 28 58 10 Z';
const ORBITING_STATES = new Set<XiaozhiVisualState>(['analyzing', 'planning', 'executing', 'explaining', 'questioning']);
const ORBIT_NODE_SECONDS = 5.5;
const ORBIT_RING_SECONDS = 12;
const ORBIT_SETTLE_SECONDS = 0.35;
const ORBIT_CENTER_X = 60;
const ORBIT_CENTER_Y = 64;
const ORBIT_RADIUS_X = 56;
const ORBIT_RADIUS_Y = 19;
const ORBIT_TILT_DEGREES = -16;
const ORBIT_START_DEGREES = 135;

const getOrbitPoint = (angleDegrees: number) => {
  const angle = angleDegrees * (Math.PI / 180);
  const tilt = ORBIT_TILT_DEGREES * (Math.PI / 180);
  const ellipseX = ORBIT_RADIUS_X * Math.cos(angle);
  const ellipseY = ORBIT_RADIUS_Y * Math.sin(angle);

  return {
    x: ORBIT_CENTER_X + ellipseX * Math.cos(tilt) - ellipseY * Math.sin(tilt),
    y: ORBIT_CENTER_Y + ellipseX * Math.sin(tilt) + ellipseY * Math.cos(tilt),
  };
};

const isOrbitFront = (angleDegrees: number) => {
  const normalized = ((angleDegrees % 360) + 360) % 360;
  return normalized < 180;
};

const XiaozhiMascot: React.FC<XiaozhiMascotProps> = ({
  state = 'idle',
  size = 96,
  motion: motionMode = 'stateful',
  speaking,
  className = '',
  ariaLabel,
}: XiaozhiMascotProps) => {
  const reduceMotion = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const meta = XIAOZHI_STATE_META[state];
  const compact = size <= 38;
  const stateful = !reduceMotion && motionMode === 'stateful';
  const subtle = !reduceMotion && motionMode !== 'static';
  const orbitAngle = useMotionValue(ORBIT_START_DEGREES);
  const ringRotation = useMotionValue(0);
  const visualState: XiaozhiVisualState = state;
  const orbitShouldRotate = stateful && ORBITING_STATES.has(visualState);
  const orbitNodeX = useTransform(orbitAngle, (angle) => getOrbitPoint(angle).x);
  const orbitNodeY = useTransform(orbitAngle, (angle) => getOrbitPoint(angle).y);
  const orbitNodeBackOpacity = useTransform(orbitAngle, (angle) => (isOrbitFront(angle) ? 0 : 0.76));
  const orbitNodeFrontOpacity = useTransform(orbitAngle, (angle) => (isOrbitFront(angle) ? 0.92 : 0));

  useEffect(() => {
    if (!orbitShouldRotate) return undefined;

    const rotation = animate(orbitAngle, orbitAngle.get() + 360, {
      duration: ORBIT_NODE_SECONDS,
      ease: 'linear',
      repeat: Infinity,
    });

    return () => rotation.stop();
  }, [orbitAngle, orbitShouldRotate]);

  useEffect(() => {
    if (orbitShouldRotate) {
      const rotation = animate(ringRotation, ringRotation.get() + 360, {
        duration: ORBIT_RING_SECONDS,
        ease: 'linear',
        repeat: Infinity,
      });

      return () => rotation.stop();
    }

    const restingRotation = Math.round(ringRotation.get() / 360) * 360;
    if (reduceMotion || motionMode === 'static') {
      ringRotation.set(restingRotation);
      return undefined;
    }

    const settle = animate(ringRotation, restingRotation, {
      duration: ORBIT_SETTLE_SECONDS,
      ease: 'easeOut',
    });

    return () => settle.stop();
  }, [motionMode, orbitShouldRotate, reduceMotion, ringRotation]);

  const bodyAnimate = (() => {
    if (!subtle) {
      if (state === 'questioning') return { rotate: -5, y: 0, x: 0, scale: 1 };
      if (state === 'error') return { rotate: 0, y: 1, x: 0, scale: 0.97 };
      return { rotate: 0, y: 0, x: 0, scale: 1 };
    }

    switch (state) {
      case 'idle':
        return { y: [0, -1.5, 0], scale: [1, 1.025, 1], rotate: 0, x: 0 };
      case 'analyzing':
        return { y: [0, -1, 0], scale: [1, 1.02, 1], rotate: 0, x: 0 };
      case 'planning':
        return { rotate: [0, -2, 2, 0], y: 0, x: 0, scale: 1 };
      case 'executing':
        return { x: [0, 3, 0], rotate: [0, 2, 0], y: 0, scale: 1 };
      case 'explaining':
        return stateful && speaking !== false
          ? { scale: [1, 1.035, 1], y: [0, -1, 0], rotate: 0, x: 0 }
          : { scale: 1, y: 0, rotate: 0, x: 0 };
      case 'questioning':
        return stateful
          ? { rotate: [-5, -2, -5], y: [0, -1, 0], x: 0, scale: 1 }
          : { rotate: -5, y: 0, x: 0, scale: 1 };
      case 'complete':
        return stateful
          ? { y: [0, -10, 0], scale: [1, 1.1, 1], rotate: [0, 4, 0], x: 0 }
          : { y: 0, scale: 1, rotate: 0, x: 0 };
      case 'error':
        return stateful
          ? { x: [0, -3, 3, -2, 2, 0], scale: [1, 0.97], y: 1, rotate: 0 }
          : { x: 0, scale: 0.97, y: 1, rotate: 0 };
    }
  })();

  const bodyTransition = (() => {
    if (!subtle) return { duration: 0.16 };
    if (state === 'complete') return { duration: 0.68, ease: 'easeOut' as const };
    if (state === 'error') return { duration: 0.46, ease: 'easeOut' as const };
    if (!stateful && state !== 'idle' && state !== 'analyzing') return { duration: 0.2 };
    const duration = state === 'idle' ? 4.2 : state === 'planning' ? 2.8 : state === 'executing' ? 1.7 : state === 'explaining' ? 1.35 : 2.2;
    return { duration, repeat: Infinity, ease: 'easeInOut' as const };
  })();

  const eyeHeight = state === 'analyzing' ? 13 : state === 'error' ? 9 : 15;
  const eyeY = state === 'error' ? 54 : 50;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} focusable="false" className="overflow-visible">
        <defs>
          <linearGradient id={`${id}-body`} x1="24" y1="22" x2="96" y2="98" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3ee7ff" />
            <stop offset="0.5" stopColor="#6d8cff" />
            <stop offset="1" stopColor="#d87bea" />
          </linearGradient>
          <radialGradient id={`${id}-shine`} cx="0" cy="0" r="1" gradientTransform="translate(42 34) rotate(49) scale(63)">
            <stop stopColor="#ffffff" stopOpacity="0.72" />
            <stop offset="0.38" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-orb`} cx="0" cy="0" r="1" gradientTransform="translate(93 27) rotate(53) scale(15)">
            <stop stopColor="#ffffff" />
            <stop offset="0.28" stopColor="#c7f6ff" />
            <stop offset="0.62" stopColor="#9385ff" />
            <stop offset="1" stopColor="#db76ee" />
          </radialGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={compact ? 2 : 4} result="blur" />
          </filter>
          <clipPath id={`${id}-orbit-front`} clipPathUnits="userSpaceOnUse">
            <rect
              x="-10"
              y={ORBIT_CENTER_Y}
              width="140"
              height="70"
              transform={`rotate(${ORBIT_TILT_DEGREES} ${ORBIT_CENTER_X} ${ORBIT_CENTER_Y})`}
            />
          </clipPath>
        </defs>

        {!compact && (
          <ellipse cx="60" cy="101" rx="24" ry="5" fill={meta.accent} opacity="0.15" filter={`url(#${id}-glow)`} />
        )}

        {state === 'executing' && !compact && (
          <Motion.g
            fill="none"
            stroke={meta.accent}
            strokeLinecap="round"
            animate={stateful ? { opacity: [0.15, 0.7, 0.15], x: [-1, -5, -1] } : { opacity: 0.45, x: 0 }}
            transition={stateful ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.15 }}
          >
            <path d="M10 54 H27" strokeWidth="3" />
            <path d="M15 66 H27" strokeWidth="2" opacity="0.65" />
          </Motion.g>
        )}

        <Motion.g
          style={{ rotate: ringRotation, transformBox: 'view-box', transformOrigin: `${ORBIT_CENTER_X}px ${ORBIT_CENTER_Y}px` }}
        >
          <Motion.ellipse
            cx={ORBIT_CENTER_X}
            cy={ORBIT_CENTER_Y}
            rx={ORBIT_RADIUS_X}
            ry={ORBIT_RADIUS_Y}
            transform={`rotate(${ORBIT_TILT_DEGREES} ${ORBIT_CENTER_X} ${ORBIT_CENTER_Y})`}
            fill="none"
            stroke={meta.accent}
            strokeWidth={compact ? 2.1 : 1.65}
            strokeLinecap="round"
            opacity="0.48"
            animate={state === 'analyzing' && stateful ? { opacity: [0.32, 0.72, 0.32] } : { opacity: 0.48 }}
            transition={state === 'analyzing' && stateful ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          />

          <Motion.circle
            cx={orbitNodeX}
            cy={orbitNodeY}
            r={compact ? 3.4 : 3.1}
            fill={`url(#${id}-orb)`}
            stroke="#dffbff"
            strokeWidth={compact ? 0.9 : 0.7}
            initial={false}
            animate={state === 'analyzing' && stateful ? { scale: [0.8, 1.18, 0.8] } : { scale: 1 }}
            transition={state === 'analyzing' && stateful ? { duration: 1.35, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            style={{ opacity: orbitNodeBackOpacity, transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </Motion.g>

        <Motion.g
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={bodyAnimate}
          transition={bodyTransition}
        >
          <path d={roundedStarPath} fill={`url(#${id}-body)`} />
          <path d={roundedStarPath} fill={`url(#${id}-shine)`} opacity="0.75" />
          <path d={roundedStarPath} fill="none" stroke="#bff7ff" strokeOpacity="0.42" strokeWidth="1.2" />

          <Motion.g
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={state === 'idle' && stateful ? { scaleY: [1, 1, 1, 0.14, 1, 1] } : { scaleY: 1 }}
            transition={state === 'idle' && stateful
              ? { duration: 4.8, times: [0, 0.82, 0.88, 0.91, 0.95, 1], repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.15 }}
          >
            {state === 'error' ? (
              <path d="M47 56 L54 63 M54 56 L47 63 M66 56 L73 63 M73 56 L66 63" fill="none" stroke="#fff5f6" strokeWidth="2.8" strokeLinecap="round" />
            ) : (
              <>
                <rect x="46" y={eyeY} width="8" height={eyeHeight} rx="4" fill="#f3fdff" />
                <rect x="66" y={state === 'questioning' ? eyeY + 2 : eyeY} width="8" height={eyeHeight} rx="4" fill="#f3fdff" />
              </>
            )}
          </Motion.g>
        </Motion.g>

        <Motion.g
          style={{ rotate: ringRotation, transformBox: 'view-box', transformOrigin: `${ORBIT_CENTER_X}px ${ORBIT_CENTER_Y}px` }}
        >
          <Motion.ellipse
            cx={ORBIT_CENTER_X}
            cy={ORBIT_CENTER_Y}
            rx={ORBIT_RADIUS_X}
            ry={ORBIT_RADIUS_Y}
            transform={`rotate(${ORBIT_TILT_DEGREES} ${ORBIT_CENTER_X} ${ORBIT_CENTER_Y})`}
            fill="none"
            stroke={meta.accent}
            strokeWidth={compact ? 2.1 : 1.75}
            strokeLinecap="round"
            opacity="0.88"
            clipPath={`url(#${id}-orbit-front)`}
            animate={state === 'analyzing' && stateful ? { opacity: [0.58, 1, 0.58] } : { opacity: 0.88 }}
            transition={state === 'analyzing' && stateful ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          />

          <Motion.circle
            cx={orbitNodeX}
            cy={orbitNodeY}
            r={compact ? 3.4 : 3.1}
            fill={`url(#${id}-orb)`}
            stroke="#dffbff"
            strokeWidth={compact ? 0.9 : 0.7}
            initial={false}
            animate={state === 'analyzing' && stateful ? { scale: [0.8, 1.18, 0.8] } : { scale: 1 }}
            transition={state === 'analyzing' && stateful ? { duration: 1.35, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            style={{ opacity: orbitNodeFrontOpacity, transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </Motion.g>

        {!compact && (
          <Motion.g
            initial={false}
            animate={subtle ? { y: [0, -1.5, 0], scale: [1, 1.04, 1] } : { y: 0, scale: 1 }}
            transition={subtle ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            style={{ transformOrigin: '96px 31px' }}
          >
            <circle cx="96" cy="31" r="7.2" fill={`url(#${id}-orb)`} stroke="#dffbff" strokeWidth="0.9" />
            <circle cx="93.5" cy="28.5" r="1.8" fill="#ffffff" opacity="0.88" />
          </Motion.g>
        )}

        {state === 'planning' && !compact && [0, 1, 2].map((index) => (
          <Motion.circle
            key={index}
            cx={48 + index * 12}
            cy={24 - Math.abs(1 - index) * 4}
            r={index === 1 ? 3.4 : 2.7}
            fill={meta.accent}
            animate={stateful ? { opacity: [0.28, 1, 0.28], y: [0, -2, 0] } : { opacity: 0.8, y: 0 }}
            transition={stateful ? { duration: 1.35, repeat: Infinity, delay: index * 0.18, ease: 'easeInOut' } : { duration: 0.15 }}
          />
        ))}

        {state === 'questioning' && !compact && (
          <Motion.g
            fill="none"
            stroke={meta.accent}
            strokeLinecap="round"
            animate={stateful ? { opacity: [0.55, 1, 0.55], y: [0, -1, 0] } : { opacity: 0.9, y: 0 }}
            transition={stateful ? { duration: 1.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.15 }}
          >
            <path d="M89 33 C89 27 99 27 99 34 C99 39 94 39 94 43" strokeWidth="2.4" />
            <circle cx="94" cy="49" r="1.8" fill={meta.accent} stroke="none" />
          </Motion.g>
        )}

        {state === 'complete' && !compact && (
          <Motion.g
            fill={meta.accent}
            initial={stateful ? { opacity: 0, scale: 0.5 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: stateful ? 0.38 : 0.15, delay: stateful ? 0.18 : 0 }}
            style={{ transformOrigin: '60px 60px' }}
          >
            <path d="M24 31 l2.2 5.2 5.2 2.2-5.2 2.2-2.2 5.2-2.2-5.2-5.2-2.2 5.2-2.2z" />
            <path d="M97 45 l1.7 4 4 1.7-4 1.7-1.7 4-1.7-4-4-1.7 4-1.7z" />
            <circle cx="91" cy="26" r="2.2" />
          </Motion.g>
        )}

        {state === 'error' && !compact && (
          <g fill={meta.accent}>
            <path d="M91 30 l6 10 h-12z" opacity="0.9" />
            <circle cx="91" cy="37" r="1" fill="#fff" />
          </g>
        )}
      </svg>
    </span>
  );
};

export default XiaozhiMascot;
