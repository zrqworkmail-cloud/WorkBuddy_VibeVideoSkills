import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';

/**
 * s6 · 三个半规管，两个耳石器
 *
 * 为什么这镜该用代码渲染而不是 I2V：
 *   它讲的是空间结构，几何关系本身就是信息。I2V 只能给"像那么回事"的近似。
 *
 * 关键：不能画成三个同心椭圆。
 *   同心环看起来是原子模型（第一版就栽在这），而真实半规管是
 *   **三条管子从同一个前庭长出去、各自弯成一个环，再回到前庭**。
 *   所以每条管都是一条"从基点出发 → 绕一圈 → 回到基点"的闭合曲线，
 *   三个环共用同一个附着点，旁边接两个耳石器。
 */

const CYAN = '#57DFFF';
const CYAN_SOFT = '#9BE8FF';

type Canal = {
  angle: number;    // 从基点出发的方向（度，-90 为正上方）
  len: number;      // 环的长度
  width: number;    // 环的宽度
  phase: number;    // 光点初相
  speed: number;    // 光点角速度
  tilt: number;     // 透视倾斜，制造三维感
};

// 三条管：水平、前、后。方向刻意不对称，避免"三瓣花"的对称感。
const CANALS: Canal[] = [
  { angle: 6,    len: 296, width: 82, phase: 0.2, speed: 0.95, tilt: 0.34 },  // 水平半规管
  { angle: -99,  len: 330, width: 116, phase: 2.3, speed: 0.80, tilt: 0.20 },  // 上半规管
  { angle: -53,  len: 312, width: 108, phase: 4.1, speed: 0.88, tilt: 0.26 },  // 后半规管
];

type P = { x: number; y: number };
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k });

// 一条管的四个控制点：从 base 出发 → 绕出去 → 回到 base
const canalPath = (base: P, c: Canal) => {
  const a = (c.angle * Math.PI) / 180;
  const dir: P = { x: Math.cos(a), y: Math.sin(a) };
  const perp: P = { x: -dir.y * c.tilt, y: dir.x }; // 倾斜后的法线，制造透视
  const tip = add(base, mul(dir, c.len));
  const w = c.width;
  const p1 = add(base, add(mul(dir, c.len * 0.42), mul(perp, w)));
  const p2 = add(tip, mul(perp, w * 0.55));
  const p3 = add(tip, mul(perp, -w * 0.55));
  const p4 = add(base, add(mul(dir, c.len * 0.42), mul(perp, -w)));
  return `M ${base.x} ${base.y}
          C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${tip.x} ${tip.y}
          C ${p3.x} ${p3.y} ${p4.x} ${p4.y} ${base.x} ${base.y}`;
};

// 沿同一条贝塞尔求点，用于放置流动光点（两段三次贝塞尔，参数 0..1 走完整个环）
const bezier = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
};

const pointOnCanal = (base: P, c: Canal, t: number): P => {
  const a = (c.angle * Math.PI) / 180;
  const dir: P = { x: Math.cos(a), y: Math.sin(a) };
  const perp: P = { x: -dir.y * c.tilt, y: dir.x };
  const tip = add(base, mul(dir, c.len));
  const w = c.width;
  const p1 = add(base, add(mul(dir, c.len * 0.42), mul(perp, w)));
  const p2 = add(tip, mul(perp, w * 0.55));
  const p3 = add(tip, mul(perp, -w * 0.55));
  const p4 = add(base, add(mul(dir, c.len * 0.42), mul(perp, -w)));
  return t < 0.5
    ? bezier(base, p1, p2, tip, t * 2)
    : bezier(tip, p3, p4, base, (t - 0.5) * 2);
};

export const SixCanals: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;

  // 整组缓慢转正 + 轻微推近，保证画面一直在变
  const driftRot = interpolate(t, [0, 1], [-6, 3]);
  const driftScale = interpolate(t, [0, 1], [1.02, 1.10]);
  const driftY = interpolate(t, [0, 1], [14, -10]);

  const base: P = { x: 352, y: 792 };

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(118% 88% at 50% 40%, #0A1622 0%, #05080D 60%, #020407 100%)' }}>
      <svg width={704} height={1280} viewBox="0 0 704 1280">
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="soft" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <radialGradient id="sacGrad" cx="40%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#EAFBFF" stopOpacity="0.92" />
            <stop offset="58%" stopColor={CYAN_SOFT} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2A8CA8" stopOpacity="0.10" />
          </radialGradient>
          <linearGradient id="tube" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EAFBFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <g transform={`translate(0 ${driftY}) rotate(${driftRot} 352 620) translate(352 620) scale(${driftScale}) translate(-352 -620)`}>
          {/* 三条半规管 */}
          {CANALS.map((c, i) => {
            const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 2 * 1.5 + i * 2.0);
            const head = (c.phase / (Math.PI * 2) + t * c.speed) % 1;
            const p0 = pointOnCanal(base, c, head);
            const p1 = pointOnCanal(base, c, (head - 0.05 + 1) % 1);
            const p2 = pointOnCanal(base, c, (head - 0.10 + 1) % 1);
            const ampT = 0.06; // 壶腹靠近基部
            const amp = pointOnCanal(base, c, ampT);
            return (
              <g key={i}>
                <path d={canalPath(base, c)} fill="none" stroke={CYAN}
                      strokeWidth={11} strokeOpacity={0.26 + 0.22 * pulse}
                      strokeLinecap="round" filter="url(#glow)" />
                <path d={canalPath(base, c)} fill="none" stroke="url(#tube)"
                      strokeWidth={3.4} strokeOpacity={0.5 + 0.35 * pulse}
                      strokeLinecap="round" />
                {/* 壶腹：靠近前庭的膨大 */}
                <circle cx={amp.x} cy={amp.y} r={13} fill={CYAN}
                        fillOpacity={0.26 + 0.2 * pulse} stroke={CYAN_SOFT}
                        strokeWidth={2} strokeOpacity={0.8} />
                {/* 淋巴液流动光点 + 尾迹 */}
                <circle cx={p2.x} cy={p2.y} r={3.6} fill={CYAN} opacity={0.22} />
                <circle cx={p1.x} cy={p1.y} r={5.4} fill={CYAN} opacity={0.5} />
                <circle cx={p0.x} cy={p0.y} r={8.4} fill="#FFFFFF" opacity={0.95} filter="url(#glow)" />
              </g>
            );
          })}

          {/* 前庭：三条管的共同附着点 */}
          <ellipse cx={base.x} cy={base.y} rx={64} ry={48}
                   fill={CYAN} opacity={0.13} filter="url(#soft)" />
          <ellipse cx={base.x} cy={base.y} rx={42} ry={30}
                   fill="url(#sacGrad)" stroke={CYAN_SOFT} strokeWidth={2}
                   strokeOpacity={0.6} />

          {/* 两个耳石器：椭圆囊 + 球囊，挂在前庭下方 */}
          {[
            { x: base.x - 74, y: base.y + 74, rx: 52, ry: 37, ph: 0 },
            { x: base.x + 78, y: base.y + 92, rx: 43, ry: 31, ph: 1.7 },
          ].map((o, i) => {
            const br = 0.8 + 0.2 * Math.sin(t * Math.PI * 2 * 1.15 + o.ph);
            return (
              <g key={`o${i}`}>
                <ellipse cx={o.x} cy={o.y} rx={o.rx * 1.6} ry={o.ry * 1.6}
                         fill={CYAN} opacity={0.09 * br} filter="url(#soft)" />
                <ellipse cx={o.x} cy={o.y} rx={o.rx} ry={o.ry}
                         fill="url(#sacGrad)" stroke={CYAN_SOFT} strokeWidth={2}
                         strokeOpacity={0.55} />
                {[0, 1, 2, 3, 4].map((k) => {
                  const ang = (k / 5) * Math.PI * 2 + t * Math.PI * 1.3 + o.ph;
                  return (
                    <circle key={k}
                            cx={o.x + Math.cos(ang) * o.rx * 0.5}
                            cy={o.y + Math.sin(ang) * o.ry * 0.5}
                            r={3.2} fill="#FFFFFF" opacity={0.5 + 0.4 * br} />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
