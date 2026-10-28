import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from 'remotion';

/**
 * 《黄袍加身之前》· 横版 1920×1080 · 224s · 22 幕
 *
 * 本版针对反馈重做：
 *  - 字幕：底部安全区 + 渐变底板（不再与画面重叠）+ 上移淡入（90px + easeOut）
 *  - 右上角「条件成熟度」倒计时，随剧情递增到 100%
 *  - 新增地图（高平之战形势 / 开封—陈桥 40 里）、14 帝破碎时间条、旗帜换倒
 *  - 实体动效：人物动作 / 旗帜 / 火 / 骑兵 / 转圈 / 钥匙 / 窗口，不用背景粒子
 *  - 人物绘制补全手臂；点检作天子文字贴合木牌角度
 *  - 结尾文案改口，避免"鼓励造反"的误读
 */

// ---------- 色板 ----------
const GOLD = '#E8B34B';
const GOLD_D = '#B8862B';
const VERM = '#C23B2E';
const PAPER = '#F2E8D5';
const INK1 = '#101830';
const INK2 = '#1B2745';
const INK3 = '#2A3A63';
const GREY = '#8C97B5';
const RED = '#E0322B';
const JADE = '#4E9E8A';
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

const lerpC = (a: number[], b: number[], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// 上移淡入（字幕统一动效：90px + easeOut）
const up = (f: number, delay = 0, dur = 18, dist = 90) => {
  const t = interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const e = easeOut(t);
  return { opacity: e, transform: `translateY(${(1 - e) * dist}px)` };
};

// ---------- 字幕系统（底部安全区 + 底板，绝不压画面） ----------
const Sub: React.FC<{ f: number; lines: string[]; sub?: string[]; accent?: string; delay?: number }> =
  ({ f, lines, sub, accent = GOLD, delay = 2 }) => (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(4,6,13,0) 0%, rgba(4,6,13,0.62) 30%, rgba(4,6,13,0.9) 68%, rgba(4,6,13,0.96) 100%)',
      }} />
      <div style={{ position: 'absolute', left: 110, right: 110, bottom: 44, textAlign: 'center' }}>
        {lines.map((t, i) => (
          <div key={i} style={{
            ...up(f, delay + i * 12, 18, 90),
            fontSize: 56, fontWeight: 900, lineHeight: 1.34, color: PAPER,
            textShadow: `0 0 26px ${accent}99, 0 2px 6px rgba(0,0,0,0.8)`,
          }}>{t}</div>
        ))}
        {sub?.map((s, i) => (
          <div key={'s' + i} style={{
            ...up(f, delay + 22 + i * 14, 18, 70),
            marginTop: 12, fontSize: 32, fontWeight: 700, color: '#D9D3C2',
            textShadow: '0 2px 6px rgba(0,0,0,0.85)',
          }}>{s}</div>
        ))}
      </div>
    </div>
  );

const ChapterTag: React.FC<{ text: string; color?: string }> = ({ text, color = GOLD }) => (
  <div style={{
    position: 'absolute', left: 48, top: 44, fontFamily: FONT,
    fontSize: 25, fontWeight: 800, letterSpacing: 5, color,
    border: `3px solid ${color}88`, borderRadius: 999, padding: '9px 26px',
    background: 'rgba(8,11,22,0.72)',
  }}>{text}</div>
);

const EraTag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: 'absolute', right: 48, top: 44, fontFamily: FONT,
    fontSize: 25, fontWeight: 800, letterSpacing: 5, color: GOLD,
    border: `3px solid ${GOLD_D}`, borderRadius: 999, padding: '9px 26px',
    background: 'rgba(8,11,22,0.72)',
  }}>{text}</div>
);

// ---------- 基础插画 ----------
const Stars: React.FC<{ n?: number; h?: number }> = ({ n = 54, h = 420 }) => {
  const f = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const x = ((i * 173) % 1860) + 30;
        const y = ((i * 53) % (h - 30)) + 20;
        const o = 0.18 + 0.5 * Math.abs(Math.sin(i * 1.7 + f * 0.05));
        return <circle key={i} cx={x} cy={y} r={1 + (i % 3)} fill="#DFE8FF" opacity={o} />;
      })}
    </g>
  );
};

const Ridge: React.FC<{ baseY: number; amp: number; color: string; seed: number; shift?: number }> =
  ({ baseY, amp, color, seed, shift = 0 }) => {
    let d = `M -60 1180 L -60 ${baseY}`;
    for (let x = -60; x <= 1980; x += 30) {
      const yy = baseY + amp * Math.sin((x + shift) * 0.006 + seed) + amp * 0.45 * Math.sin((x + shift) * 0.017 + seed * 2.3);
      d += ` L ${x} ${yy.toFixed(1)}`;
    }
    d += ' L 1980 1180 Z';
    return <path d={d} fill={color} />;
  };

const Fire: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => {
  const f = useCurrentFrame();
  const k = Math.sin(f * 0.55) * 0.16 + Math.sin(f * 0.9 + 1.3) * 0.1;
  const k2 = Math.sin(f * 0.7 + 0.6) * 0.2;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={0} cy={-34} r={110} fill="#FF9C3F" opacity={0.09 + 0.05 * Math.sin(f * 0.8)} />
      <g transform={`scale(${1 + k2 * 0.3})`}>
        <path d="M 0 0 C -26 -18 -20 -52 0 -80 C 20 -52 26 -18 0 0 Z" fill="#E8762C" />
      </g>
      <g transform={`translate(0 4) scale(${0.72 + k * 0.25})`}>
        <path d="M 0 0 C -18 -14 -14 -40 0 -62 C 14 -40 18 -14 0 0 Z" fill="#FFB84D" />
      </g>
      <g transform={`translate(0 6) scale(${0.45 + k * 0.3})`}>
        <path d="M 0 0 C -10 -10 -8 -26 0 -42 C 8 -26 10 -10 0 0 Z" fill="#FFE8A3" />
      </g>
      <line x1={-38} y1={8} x2={38} y2={-4} stroke="#3A2C1E" strokeWidth={9} strokeLinecap="round" />
      <line x1={-38} y1={-4} x2={38} y2={8} stroke="#2C2016" strokeWidth={9} strokeLinecap="round" />
    </g>
  );
};

const Flag: React.FC<{ x: number; y: number; label: string; up: number; fall: number; color?: string; h?: number }> =
  ({ x, y, label, up, fall, color = '#7A2E24', h = 170 }) => (
    <g transform={`translate(${x} ${y}) rotate(${fall * 76})`}>
      <line x1={0} y1={0} x2={0} y2={-h * Math.max(up, 0.001)} stroke="#3A2C18" strokeWidth={6} />
      <g opacity={Math.min(up, 1)} transform={`translate(0 ${-h * up})`}>
        <path d="M 0 -34 L 92 -24 L 0 -14 Z" fill={color} stroke={GOLD_D} strokeWidth={3} />
        <text x={32} y={-20} textAnchor="middle" fontFamily={FONT} fontSize={21} fontWeight={900} fill={PAPER}>{label}</text>
      </g>
    </g>
  );

const Soldier: React.FC<{ x: number; y: number; s?: number; phase: number; color?: string; flag?: boolean }> =
  ({ x, y, s = 1, phase, color = '#0B1122', flag = true }) => {
    const f = useCurrentFrame();
    const sw = Math.sin(f * 0.35 + phase);
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cx={0} cy={-58} r={12} fill={color} />
        <line x1={0} y1={-46} x2={0} y2={-10} stroke={color} strokeWidth={11} strokeLinecap="round" />
        <line x1={0} y1={-10} x2={-13 + sw * 8} y2={12} stroke={color} strokeWidth={9} strokeLinecap="round" />
        <line x1={0} y1={-10} x2={13 - sw * 8} y2={12} stroke={color} strokeWidth={9} strokeLinecap="round" />
        <line x1={0} y1={-40} x2={-15} y2={-16 - sw * 4} stroke={color} strokeWidth={7} strokeLinecap="round" />
        <line x1={0} y1={-40} x2={15} y2={-16 + sw * 4} stroke={color} strokeWidth={7} strokeLinecap="round" />
        <line x1={22} y1={-92 - sw * 2} x2={26} y2={8} stroke={color} strokeWidth={4} strokeLinecap="round" />
        {flag && <path d={`M ${22} ${-92 - sw * 2} q 16 3 22 12`} stroke={VERM} strokeWidth={4} fill="none" />}
      </g>
    );
  };

const Cheerer: React.FC<{ x: number; y: number; s?: number; phase: number }> = ({ x, y, s = 1, phase }) => {
  const f = useCurrentFrame();
  const b = Math.abs(Math.sin(f * 0.25 + phase)) * 7;
  return (
    <g transform={`translate(${x} ${y - b}) scale(${s})`}>
      <circle cx={0} cy={-58} r={12} fill="#0B1122" />
      <line x1={0} y1={-46} x2={0} y2={-10} stroke="#0B1122" strokeWidth={11} strokeLinecap="round" />
      <line x1={0} y1={-40} x2={-26} y2={-78} stroke="#0B1122" strokeWidth={8} strokeLinecap="round" />
      <line x1={0} y1={-40} x2={26} y2={-78} stroke="#0B1122" strokeWidth={8} strokeLinecap="round" />
      <line x1={0} y1={-10} x2={-14} y2={12} stroke="#0B1122" strokeWidth={9} strokeLinecap="round" />
      <line x1={0} y1={-10} x2={14} y2={12} stroke="#0B1122" strokeWidth={9} strokeLinecap="round" />
    </g>
  );
};

const Rider: React.FC<{ x: number; y: number; s?: number; gold?: boolean }> = ({ x, y, s = 1, gold = false }) => {
  const f = useCurrentFrame();
  const c = gold ? GOLD : '#0B1122';
  const g = Math.sin(f * 0.5);
  const legs = [Math.sin(f * 0.5) * 26, Math.sin(f * 0.5 + 1.4) * 26, Math.sin(f * 0.5 + 2.8) * 26, Math.sin(f * 0.5 + 4.2) * 26];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {!gold && <><circle cx={-64 - g * 6} cy={26} r={14} fill="#3A3050" opacity={0.5} /><circle cx={-88} cy={20} r={9} fill="#3A3050" opacity={0.35} /></>}
      <ellipse cx={0} cy={-6} rx={44} ry={19} fill={c} />
      <path d="M 34 -14 C 46 -30 52 -40 54 -52 L 72 -46 C 66 -30 60 -18 52 -6 Z" fill={c} />
      <circle cx={74} cy={-50} r={9} fill={c} />
      <path d={`M -42 -10 q ${-16 + g * 5} 14 ${-22} 26`} stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" />
      {legs.map((a, i) => (
        <line key={i} x1={i < 2 ? -26 : 26} y1={4} x2={(i < 2 ? -26 : 26) + a * 0.6} y2={40} stroke={c} strokeWidth={7} strokeLinecap="round" />
      ))}
      <circle cx={-4} cy={-52} r={10} fill={c} />
      <path d="M -4 -42 C -2 -30 6 -24 16 -20" stroke={c} strokeWidth={7} fill="none" strokeLinecap="round" />
      <line x1={6} y1={-62} x2={44} y2={-92} stroke={c} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
};

// 完整人物（有手臂、腰带、发髻）
const FullFigure: React.FC<{ x: number; y: number; s?: number; robe?: number; armUp?: number }> =
  ({ x, y, s = 1, robe = 0, armUp = 0 }) => {
    const f = useCurrentFrame();
    const sway = Math.sin(f * 0.09) * 1.6;
    return (
      <g transform={`translate(${x} ${y}) scale(${s}) rotate(${sway})`}>
        <path d="M -18 40 L -26 132 L -8 132 L 0 46 L 8 132 L 26 132 L 18 40 Z" fill="#0C1224" />
        <path d="M -34 -70 L 34 -70 L 30 44 L -30 44 Z" fill="#141C34" />
        <path d={`M -32 -62 L -48 ${-8 - armUp * 46} L -42 ${20 - armUp * 78}`} stroke="#141C34" strokeWidth={17} strokeLinecap="round" fill="none" />
        <path d={`M 32 -62 L 48 ${-8 - armUp * 46} L 42 ${20 - armUp * 78}`} stroke="#141C34" strokeWidth={17} strokeLinecap="round" fill="none" />
        <circle cx={-42} cy={20 - armUp * 78} r={8} fill="#C9A27A" />
        <circle cx={42} cy={20 - armUp * 78} r={8} fill="#C9A27A" />
        <rect x={-9} y={-86} width={18} height={18} fill="#C9A27A" />
        <circle cx={0} cy={-104} r={22} fill="#C9A27A" />
        <path d="M -22 -110 A 22 22 0 0 1 22 -110 L 18 -122 L -18 -122 Z" fill="#161A26" />
        <rect x={-12} y={-138} width={24} height={16} rx={6} fill="#161A26" />
        <g opacity={Math.min(robe * 1.4, 1)}>
          <path d="M -34 -70 L 34 -70 L 40 46 L 78 132 L -78 132 L -40 46 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={4}
            transform={`translate(0 ${-70 * (1 - Math.min(robe, 1))}) scale(1 ${Math.max(Math.min(robe, 1), 0.001)})`} />
          <path d={`M -32 -62 L -50 ${-6 - armUp * 46} L -44 ${26 - armUp * 78}`} stroke={GOLD} strokeWidth={19} strokeLinecap="round" fill="none"
            opacity={Math.min(robe, 1)} />
          <path d={`M 32 -62 L 50 ${-6 - armUp * 46} L 44 ${26 - armUp * 78}`} stroke={GOLD} strokeWidth={19} strokeLinecap="round" fill="none"
            opacity={Math.min(robe, 1)} />
          <rect x={-36} y={18} width={72} height={14} fill={VERM} opacity={Math.min(robe, 1)} />
        </g>
      </g>
    );
  };

const RobeOnly: React.FC<{ x: number; y: number; s?: number; p: number }> = ({ x, y, s = 1, p }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g opacity={0.45 * p}>
        {Array.from({ length: 12 }).map((_, i) => (
          <path key={i} d="M 0 -150 L 16 -330 L -16 -330 Z" fill={GOLD}
            transform={`rotate(${i * 30}) scale(${0.72 + 0.28 * Math.sin(f * 0.1 + i * 0.9)})`} opacity={0.3} />
        ))}
      </g>
      <g transform={`scale(1 ${Math.max(p, 0.001)})`} opacity={p}>
        <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z"
          fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
        <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
        <path d="M 44 -152 C 38 -50 58 60 70 152 L 94 152 C 82 40 58 -80 58 -152 Z" fill={GOLD_D} opacity={0.38} />
      </g>
    </g>
  );
};

const Seal: React.FC<{ x: number; y: number; s?: number; p: number; char: string }> = ({ x, y, s = 1, p, char }) => (
  <g transform={`translate(${x} ${y}) rotate(${-9 * (1 - p)}) scale(${s * Math.max(p, 0.001)})`}>
    <rect x={-70} y={-70} width={140} height={140} rx={14} fill={VERM} opacity={0.92} />
    <rect x={-56} y={-56} width={112} height={112} rx={10} fill="none" stroke={PAPER} strokeWidth={6} />
    <text x={0} y={6} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT}
      fontSize={char.length > 1 ? 52 : 82} fontWeight={900} fill={PAPER}>{char}</text>
  </g>
);

const MapBase: React.FC<{ x?: number; y?: number; w?: number; h?: number; label?: string }> =
  ({ x = 140, y = 170, w = 1640, h = 600, label }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={w} height={h} rx={18} fill="#0D1426" stroke="#2A3A5F" strokeWidth={3} />
      <path d={`M 40 ${h * 0.35} Q ${w * 0.3} ${h * 0.22} ${w * 0.55} ${h * 0.33} T ${w - 40} ${h * 0.28}`} stroke="#1C2A48" strokeWidth={26} fill="none" opacity={0.7} />
      <path d={`M 30 ${h * 0.62} C ${w * 0.22} ${h * 0.54} ${w * 0.4} ${h * 0.68} ${w * 0.6} ${h * 0.6} S ${w * 0.85} ${h * 0.5} ${w - 20} ${h * 0.56}`}
        stroke="#39607C" strokeWidth={15} fill="none" strokeLinecap="round" opacity={0.9} />
      <text x={w * 0.13} y={h * 0.585} fontFamily={FONT} fontSize={24} fontWeight={800} fill="#6FA3C4" letterSpacing={6}>黄河</text>
      {label && <text x={w - 30} y={h - 24} textAnchor="end" fontFamily={FONT} fontSize={24} fill={GREY} letterSpacing={4}>{label}</text>}
    </g>
  );

const City: React.FC<{ x: number; y: number; name: string; color?: string; big?: boolean }> = ({ x, y, name, color = PAPER, big = false }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx={0} cy={0} r={big ? 13 : 8} fill={color} />
    <circle cx={0} cy={0} r={big ? 22 : 14} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
    <text x={0} y={big ? 46 : 34} textAnchor="middle" fontFamily={FONT} fontSize={big ? 30 : 24} fontWeight={800} fill={color}>{name}</text>
  </g>
);

const GrowArrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; color: string; w?: number }> =
  ({ x1, y1, x2, y2, p, color, w = 9 }) => {
    const cx = x1 + (x2 - x1) * p, cy = y1 + (y2 - y1) * p;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    return (
      <g>
        <line x1={x1} y1={y1} x2={cx} y2={cy} stroke={color} strokeWidth={w} strokeLinecap="round" />
        <path d={`M ${cx} ${cy} L ${cx - 22 * Math.cos(ang - 0.42)} ${cy - 22 * Math.sin(ang - 0.42)} L ${cx - 22 * Math.cos(ang + 0.42)} ${cy - 22 * Math.sin(ang + 0.42)} Z`} fill={color} />
      </g>
    );
  };

// ================= 幕 =================

// S1 钩子：53 年 / 14 帝破碎时间条
const S1: React.FC = () => {
  const f = useCurrentFrame();
  const nP = spring({ frame: f - 2, fps: 24, config: { damping: 9, stiffness: 170 } });
  const bands = interpolate(f, [40, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dim = interpolate(f, [150, 176], [1, 0.1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const robeP = spring({ frame: f - 162, fps: 24, config: { damping: 12, stiffness: 90 } });
  const REIGN = [5, 1, 10, 3, 7, 1, 2, 6, 5, 1, 2, 3, 5, 1];
  const COLORS = ['#8E3B2E', '#8E3B2E', '#8E3B2E', '#3E6E5A', '#3E6E5E', '#3E6E5E', '#3E6E5E', '#4A5A8E', '#4A5A8E', '#6E4A7A', '#6E4A7A', '#B8862B', '#B8862B', '#B8862B'];
  const totalW = 1500;
  const totalYears = REIGN.reduce((a, b) => a + b, 0);
  let acc = 0;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 18%, #1A1230 0%, #0A0F22 52%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={50} h={340} />
        <g opacity={dim}>
          <text x={930} y={300} textAnchor="middle" fontFamily={FONT} fontSize={190} fontWeight={900} fill={PAPER}
            opacity={Math.min(nP, 1)}>53</text>
          <text x={1130} y={300} textAnchor="middle" fontFamily={FONT} fontSize={70} fontWeight={900} fill={PAPER} opacity={Math.min(nP, 1)}>年</text>
          <text x={960} y={370} textAnchor="middle" fontFamily={FONT} fontSize={40} fontWeight={800} fill={GREY} opacity={Math.min(nP, 1)} letterSpacing={6}>
            五个朝代 · 八个姓氏 · 十四位皇帝
          </text>
          <g transform="translate(210 470)">
            <rect x={-16} y={-18} width={totalW + 32} height={86} rx={12} fill="#0C1224" stroke="#233355" strokeWidth={2} />
            {REIGN.map((yrs, i) => {
              const wSeg = (yrs / totalYears) * totalW;
              const xSeg = (acc / totalYears) * totalW;
              acc += yrs;
              const grow = interpolate(bands, [i * 0.055, i * 0.055 + 0.18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return (
                <g key={i}>
                  <rect x={xSeg + 2} y={0} width={Math.max(wSeg - 4, 3) * grow} height={50} fill={COLORS[i]} opacity={0.95} rx={2} />
                  <text x={xSeg + wSeg / 2} y={78} textAnchor="middle" fontFamily={FONT} fontSize={18} fontWeight={700} fill={GREY} opacity={grow}>{yrs}</text>
                </g>
              );
            })}
            <text x={-30} y={-34} fontFamily={FONT} fontSize={26} fontWeight={800} fill={GOLD} letterSpacing={4}>五代的 53 年 · 每段是一位皇帝的在位年数</text>
          </g>
          <text x={960} y={640} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={VERM}
            opacity={interpolate(f, [100, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            最长的不过十年，最短的只有一年
          </text>
        </g>
        <g opacity={1 - dim}>
          <RobeOnly x={960} y={500} s={0.6} p={Math.max(robeP, 0)} />
        </g>
      </svg>
      {f >= 150 && (
        <Sub f={f} delay={152} lines={['公元 960 年正月初三，又一件黄袍', '披上了一个人的肩膀']}
          sub={['所有人都在赌：他还能撑几年？']} />
      )}
      {f >= 150 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 300, textAlign: 'center', ...up(f, 176, 16, 60) }}>
          <span style={{ fontSize: 64, fontWeight: 900, color: GOLD, letterSpacing: 14, textShadow: `0 0 30px ${GOLD}99` }}>赵匡胤</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// S2 乱世规则（旗帜 + 名言重排版）
const S2: React.FC = () => {
  const f = useCurrentFrame();
  const q1 = interpolate(f, [40, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const q2 = interpolate(f, [62, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dyn = [{ l: '梁', y: '907' }, { l: '唐', y: '923' }, { l: '晋', y: '936' }, { l: '汉', y: '947' }, { l: '周', y: '951' }];
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #191330 0%, #100D22 55%, #06050F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={36} h={260} />
        <Ridge baseY={760} amp={26} color={INK2} seed={5.5} />
        {dyn.map((d, i) => {
          const up1 = interpolate(f, [6 + i * 8, 20 + i * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const fall = interpolate(f, [96 + i * 10, 110 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <g key={i}>
              <Flag x={300 + i * 330} y={700} label={d.l} up={up1} fall={fall} h={170} />
              <text x={300 + i * 330} y={740} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill={GREY} opacity={0.7}>{d.y}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, textAlign: 'center' }}>
        <div style={{ ...up(f, 4, 16, 40), fontSize: 28, fontWeight: 800, color: GREY, letterSpacing: 8 }}>
          五十三年间，皇位更迭的唯一规则
        </div>
        <div style={{ position: 'relative', display: 'inline-block', marginTop: 30 }}>
          <span style={{ position: 'absolute', left: -76, top: -10, fontSize: 96, color: GOLD_D, fontWeight: 900, opacity: 0.5 * q1 }}>「</span>
          <span style={{ position: 'absolute', right: -76, bottom: -52, fontSize: 96, color: GOLD_D, fontWeight: 900, opacity: 0.5 * q2 }}>」</span>
          <div style={{ ...up(f, 40, 16, 60), opacity: q1, fontSize: 78, fontWeight: 900, color: PAPER, lineHeight: 1.3, textShadow: `0 0 30px ${VERM}88` }}>
            天子宁有种耶？
          </div>
          <div style={{ ...up(f, 62, 16, 60), opacity: q2, marginTop: 8, fontSize: 62, fontWeight: 900, color: PAPER, lineHeight: 1.3, letterSpacing: 3, textShadow: `0 0 30px ${VERM}66` }}>
            兵强马壮者为之尔
          </div>
        </div>
        <div style={{ ...up(f, 86, 14, 40), marginTop: 20, fontSize: 28, fontWeight: 700, color: GREY }}>
          —— 五代 · 安重荣
        </div>
      </div>
      <EraTag text="五代 · 907–960" />
      <Sub f={f} delay={118} lines={['皇帝，是当时的高危职业']} sub={['十三位君主死于非命：被弑、被杀、自焚、被掳']} />
    </AbsoluteFill>
  );
};

// S3 高平之战：地图 + 救柴荣
const S3: React.FC = () => {
  const f = useCurrentFrame();
  const route1 = interpolate(f, [30, 76], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const route2 = interpolate(f, [46, 92], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rescue = interpolate(f, [150, 210], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const heroX = interpolate(f, [150, 205], [1480, 980], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scatter = interpolate(f, [196, 226], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #241B36 0%, #171226 55%, #08060F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={200} />
        <g opacity={interpolate(f, [120, 140], [1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          <MapBase x={150} y={130} w={1620} h={520} label="高平之战 · 954 年" />
          <g transform="translate(520 560)">
            <rect x={-90} y={-30} width={180} height={54} rx={10} fill="#173A2E" stroke={JADE} strokeWidth={2} />
            <text x={0} y={8} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={900} fill={JADE}>后周</text>
          </g>
          <g transform="translate(880 250)">
            <rect x={-90} y={-30} width={180} height={54} rx={10} fill="#3A1620" stroke={VERM} strokeWidth={2} />
            <text x={0} y={8} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={900} fill="#E08C86">北汉</text>
          </g>
          <g transform="translate(1480 250)">
            <rect x={-90} y={-30} width={180} height={54} rx={10} fill="#2A2236" stroke="#8E7AA8" strokeWidth={2} />
            <text x={0} y={8} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={900} fill="#B9A8D0">辽</text>
          </g>
          <City x={520} y={560} name="开封" color={JADE} />
          <City x={880} y={330} name="太原" color="#E08C86" />
          <City x={1010} y={440} name="高平" color={GOLD} big />
          <City x={1480} y={330} name="幽州" color="#B9A8D0" />
          <GrowArrow x1={540} y1={540} x2={980} y2={462} p={route1} color={JADE} />
          <GrowArrow x1={880} y1={352} x2={1000} y2={424} p={route2} color={VERM} />
          <GrowArrow x1={1450} y1={340} x2={1060} y2={430} p={route2} color="#8E7AA8" />
        </g>
        {/* 救柴荣 */}
        <g opacity={interpolate(f, [140, 156], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          <rect x={0} y={660} width={1920} height={420} fill="#0A0E1C" />
          <g transform="translate(900 900)">
            <circle cx={0} cy={-96} r={16} fill="#C9A27A" />
            <path d="M 0 -80 L 0 -16 M 0 -16 L -16 30 M 0 -16 L 16 30 M 0 -62 L -26 -30 M 0 -62 L 26 -30"
              stroke="#2A3A5F" strokeWidth={11} strokeLinecap="round" fill="none" />
            <text x={0} y={62} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill="#8FB8D8">柴荣</text>
          </g>
          {[[760, 860], [1040, 850], [800, 960], [1010, 965], [700, 905], [1100, 905]].map(([bx, by], i) => {
            const dx = (bx - 960) * scatter * 2.2;
            const rot = scatter * (i % 2 ? 1 : -1) * 70;
            return (
              <g key={i} transform={`translate(${bx + dx} ${by}) rotate(${rot})`} opacity={1 - scatter * 0.55}>
                <circle cx={0} cy={-70} r={13} fill="#3A1620" />
                <path d="M 0 -56 L 0 -4 M 0 -4 L -12 30 M 0 -4 L 12 30" stroke="#3A1620" strokeWidth={9} strokeLinecap="round" fill="none" />
                <line x1={18} y1={-96} x2={22} y2={16} stroke="#3A1620" strokeWidth={4} />
              </g>
            );
          })}
          <g transform={`translate(${heroX} 900) scale(${1 + 0.06 * Math.sin(f * 0.4)})`} opacity={rescue}>
            <circle cx={-6} cy={-104} r={17} fill="#C9A27A" />
            <path d="M -6 -88 L -6 -20 M -6 -20 L -26 34 M -6 -20 L 14 34 M -6 -70 L -32 -44 M -6 -70 L 26 -78"
              stroke={GOLD} strokeWidth={12} strokeLinecap="round" fill="none" />
            <line x1={30} y1={-140} x2={54} y2={-30} stroke={GOLD} strokeWidth={6} strokeLinecap="round" />
            <text x={0} y={64} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill={GOLD}>赵匡胤</text>
          </g>
        </g>
      </svg>
      <EraTag text="显德元年 · 954" />
      <Sub f={f} delay={100} lines={['高平之战 · 他冲进包围圈救出柴荣']}
        sub={['后周 vs 北汉 + 辽，战场在泽州高平；这一战让他进入权力核心']} />
    </AbsoluteFill>
  );
};

// S4 柴荣病逝
const S4: React.FC = () => {
  const f = useCurrentFrame();
  const dim = interpolate(f, [40, 90], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const candle = 0.45 + 0.55 * Math.abs(Math.sin(f * 0.18));
  const childTremble = Math.sin(f * 0.9) * 2;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0B1130 0%, #0D1330 55%, #0A0E20 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={40} h={300} />
        <circle cx={330} cy={170} r={50} fill="#E8E2C8" opacity={0.85 * (1 - dim)} />
        <circle cx={312} cy={158} r={40} fill="#0D1330" opacity={0.5} />
        <g transform="translate(1240 520) scale(1.05)">
          <path d="M -240 0 C -170 -52 -90 -66 0 -70 C 90 -66 170 -52 240 0 L 196 0 C 150 -34 76 -46 0 -46 C -76 -46 -150 -34 -196 0 Z" fill={INK1} />
          <rect x={-150} y={0} width={300} height={150} fill={INK2} />
          <path d="M -168 0 L 0 -34 L 168 0 Z" fill={INK1} />
          <rect x={-96} y={38} width={54} height={70} rx={6} fill="#FFB84D" opacity={0.15 + candle * 0.25} />
          <rect x={42} y={38} width={54} height={70} rx={6} fill="#FFB84D" opacity={0.12 + (1 - candle) * 0.2} />
          <rect x={-26} y={30} width={52} height={120} rx={6} fill="#060A16" />
        </g>
        <g transform={`translate(1050 760) translate(${childTremble} 0)`}>
          <circle cx={0} cy={-46} r={13} fill="#0B1122" />
          <path d="M 0 -33 L 0 16 M 0 16 L -12 58 M 0 16 L 12 58 M 0 -22 L -16 6 M 0 -22 L 16 6"
            stroke="#0B1122" strokeWidth={8} strokeLinecap="round" fill="none" />
        </g>
        <g transform="translate(1250 790)">
          <circle cx={0} cy={-52} r={14} fill="#0B1122" />
          <path d="M 0 -38 L 0 20 M 0 20 L -16 62 M 0 20 L 16 62 M 0 -26 L -22 -6 M 0 -26 L 20 -8"
            stroke="#0B1122" strokeWidth={9} strokeLinecap="round" fill="none" />
        </g>
        <g transform="translate(760 800)">
          <rect x={-6} y={-120} width={12} height={120} fill="#5A4428" />
          <rect x={-22} y={0} width={44} height={10} rx={4} fill="#5A4428" />
          <Fire x={0} y={-126} s={0.42} />
        </g>
        <Ridge baseY={880} amp={26} color={INK2} seed={2.1} />
        <rect x={0} y={0} width={1920} height={1080} fill="#04060D" opacity={dim} />
      </svg>
      <EraTag text="显德六年 · 959" />
      <Sub f={f} delay={46} lines={['柴荣病逝 · 只有 39 岁']} sub={['7 岁的儿子即位，主少国疑', '禁军将士，只认殿前都点检的脸']} />
    </AbsoluteFill>
  );
};

// S5 木牌（文字贴合牌面角度）
const S5: React.FC = () => {
  const f = useCurrentFrame();
  const plank = spring({ frame: f - 8, fps: 24, config: { damping: 12, stiffness: 90 } });
  const rot = interpolate(plank, [0, 1], [-9, -4]);
  const carve = interpolate(f, [36, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 32%, #171F3E 0%, #0B1024 55%, #05070F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={260} />
        <g transform={`translate(960 450) rotate(${rot}) scale(${Math.max(plank, 0.001)})`}>
          <line x1={-120} y1={-170} x2={0} y2={-260} stroke="#3A2C18" strokeWidth={7} />
          <line x1={120} y1={-170} x2={0} y2={-260} stroke="#3A2C18" strokeWidth={7} />
          <rect x={-330} y={-170} width={660} height={300} rx={16} fill="#7A5C38" stroke="#54401F" strokeWidth={10} />
          <rect x={-310} y={-150} width={620} height={260} rx={10} fill="none" stroke="#63481F" strokeWidth={4} opacity={0.8} />
          <path d="M -290 -96 q 150 12 300 0 M -290 -18 q 160 -10 320 0 M -280 62 q 130 10 260 0" stroke="#63481F" strokeWidth={4} fill="none" opacity={0.55} />
          <g opacity={carve}>
            <text x={2} y={-16} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={84} fontWeight={900} fill="#241708" letterSpacing={10}>点检作天子</text>
            <text x={0} y={-20} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={84} fontWeight={900} fill="#F5E2B8" letterSpacing={10} opacity={0.3}>点检作天子</text>
          </g>
        </g>
        <Ridge baseY={880} amp={22} color={INK2} seed={6.4} />
      </svg>
      <EraTag text="北伐途中" />
      <Sub f={f} delay={100} lines={['军中惊现一块木牌：点检作天子']}
        sub={['殿前都点检张永德随即被撤，接任的，叫赵匡胤']} />
    </AbsoluteFill>
  );
};

// S6 边关急报
const S6: React.FC = () => {
  const f = useCurrentFrame();
  const riderX = interpolate(f, [0, 84], [-240, 2160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const docP = spring({ frame: f - 90, fps: 24, config: { damping: 12, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #2A1E36 0%, #3A2430 48%, #1A1220 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={220} />
        <Ridge baseY={700} amp={44} color={INK3} seed={4.2} />
        <Ridge baseY={790} amp={36} color={INK2} seed={7.7} />
        <rect x={0} y={860} width={1920} height={220} fill={INK1} />
        <path d="M -40 910 C 500 888 1300 934 1960 900" stroke="#0E1428" strokeWidth={24} fill="none" strokeLinecap="round" />
        <g transform="translate(1640 560)">
          <rect x={-36} y={0} width={72} height={200} fill={INK2} />
          <rect x={-46} y={-20} width={92} height={24} fill={INK2} />
          <Fire x={0} y={-26} s={0.6} />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={0} cy={-70 - ((f * 1.6 + i * 40) % 120)} r={16 + i * 6} fill="#6A5A70" opacity={0.28 - i * 0.06} />
          ))}
        </g>
        <g transform={`translate(${riderX} 800) scale(1.25)`}><Rider x={0} y={0} /></g>
        <g transform={`translate(960 300) scale(${Math.max(docP, 0.001)})`} opacity={docP}>
          <rect x={-220} y={-120} width={440} height={240} rx={10} fill="#E8DCC0" stroke="#B8A47C" strokeWidth={4} />
          <path d="M -190 -70 h 380 M -190 -20 h 380 M -190 30 h 300 M -190 80 h 340" stroke="#8A7A5A" strokeWidth={5} />
          <circle cx={170} cy={86} r={30} fill={VERM} opacity={0.9} />
          <text x={170} y={96} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={900} fill={PAPER}>急</text>
        </g>
      </svg>
      <EraTag text="正月初一" />
      <Sub f={f} delay={92} lines={['边关急报：辽与北汉联军南下']}
        sub={['镇州、定州同日告警——消息真假，至今存疑']} />
    </AbsoluteFill>
  );
};

// S7 出征 + 40 里 + 天有二日
const S7: React.FC = () => {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, 180], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const top = lerpC([46, 32, 74], [10, 15, 34], t);
  const mid = lerpC([186, 110, 58], [14, 21, 44], t);
  const sunY = 200 + t * 220;
  const route = interpolate(f, [40, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const march = interpolate(f, [110, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 58%, #0B0F22 100%)`, fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <g opacity={1 - t * 0.95}>
          <circle cx={1440} cy={sunY} r={88} fill="#FFC85F" opacity={0.2} />
          <circle cx={1440} cy={sunY} r={48} fill="#FFD98A" />
          <circle cx={1508} cy={sunY + 70} r={36} fill="#FFB85C" opacity={0.9} />
          <text x={1440} y={sunY + 150} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill="#FFE2A8" opacity={0.85}>
            天有二日 · 一日克一日
          </text>
        </g>
        <Stars n={30} h={360} />
        <Ridge baseY={700} amp={40} color={INK3} seed={2.6} shift={-f * 0.8} />
        <Ridge baseY={790} amp={34} color={INK2} seed={5.1} shift={-f * 1.6} />
        <rect x={0} y={860} width={1920} height={220} fill={INK1} />
        <g opacity={march} transform="translate(120 590)">
          <rect x={-10} y={-40} width={520} height={190} rx={14} fill="rgba(8,12,24,0.82)" stroke="#2A3A5F" strokeWidth={2} />
          <City x={40} y={90} name="开封" color={JADE} />
          <City x={420} y={40} name="陈桥驿" color={GOLD} big />
          <GrowArrow x1={52} y1={78} x2={406} y2={34} p={route} color={GOLD} w={5} />
          <text x={210} y={128} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill={PAPER}>40 里 · 一天的路</text>
        </g>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} opacity={interpolate(f, [110 + i * 4, 124 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            <Soldier x={1080 + i * 130 + ((f * 1.1) % 40)} y={760} s={1.02} phase={i * 1.1} />
          </g>
        ))}
        <Fire x={880} y={868} s={0.85} />
      </svg>
      <EraTag text="正月初二" />
      <Sub f={f} delay={40} lines={['大军北上，夜宿陈桥驿']} sub={['距开封只有 40 里 · 进可回城，退可观望']} />
    </AbsoluteFill>
  );
};

// S8 夜议
const S8: React.FC = () => {
  const f = useCurrentFrame();
  const b1 = interpolate(f, [12, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b2 = interpolate(f, [34, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 55%, #131B36 0%, #090D1E 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <path d="M 200 840 L 960 200 L 1720 840 Z" fill="#0A0F22" stroke={INK3} strokeWidth={4} />
        {[[660, 800], [850, 850], [1080, 850], [1270, 795]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <ellipse cx={0} cy={0} rx={54} ry={64} fill="#070B16" />
            <circle cx={0} cy={-64} r={22} fill="#070B16" />
          </g>
        ))}
        <Fire x={960} y={812} s={1.2} />
        <g opacity={b1}>
          <rect x={340} y={330} width={400} height={88} rx={22} fill="#101A36" stroke={INK3} strokeWidth={3} />
          <path d="M 510 418 l 24 32 l 18 -32 Z" fill="#101A36" />
          <text x={540} y={386} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={PAPER}>主少国疑……</text>
        </g>
        <g opacity={b2}>
          <rect x={980} y={450} width={580} height={88} rx={22} fill="#16223F" stroke={GOLD_D} strokeWidth={3} />
          <path d="M 1150 538 l 24 32 l 18 -32 Z" fill="#16223F" />
          <text x={1270} y={506} textAnchor="middle" fontFamily={FONT} fontSize={36} fontWeight={900} fill={GOLD}>不如立点检为天子</text>
        </g>
      </svg>
      <EraTag text="当夜 · 军帐" />
      <Sub f={f} delay={54} lines={['帐中议论到深夜']} sub={['赵匡义、赵普主谋 · 他假装不知道，先睡了']} />
    </AbsoluteFill>
  );
};

// S9 黄袍加身（完整人物）
const S9: React.FC = () => {
  const f = useCurrentFrame();
  const dawnT = interpolate(f, [0, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const robeP = spring({ frame: f - 30, fps: 24, config: { damping: 12, stiffness: 90 } });
  const armP = interpolate(f, [60, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${lerpC([16, 24, 56], [44, 56, 104], dawnT)} 0%, ${lerpC([22, 28, 54], [180, 132, 66], dawnT)} 62%, #0B0F22 100%)`, fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={20} h={200} />
        <Ridge baseY={880} amp={24} color={INK1} seed={3.3} />
        {[120, 260, 400, 540, 1380, 1520, 1660, 1800].map((x, i) => (
          <Cheerer key={i} x={x} y={840} s={0.95 + (i % 3) * 0.06} phase={i * 0.9} />
        ))}
        <g transform="translate(960 700) scale(1.5)">
          <FullFigure x={0} y={0} s={1} robe={Math.max(robeP, 0)} armUp={armP} />
        </g>
        {[0, 1, 2].map((i) => {
          const p = interpolate(f, [70 + i * 12, 86 + i * 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const fade = interpolate(f, [100 + i * 12, 130 + i * 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <text key={i} x={420 + i * 540} y={250 + (i % 2) * 100} textAnchor="middle"
              fontFamily={FONT} fontSize={58} fontWeight={900} fill={GOLD}
              opacity={p * fade} transform={`translate(0 ${(1 - p) * 40})`}>万岁</text>
          );
        })}
      </svg>
      <EraTag text="正月初三 · 黎明" />
      <Sub f={f} delay={96} lines={['天亮了 · 黄袍加身']} sub={['将士山呼万岁，他"被迫"受了这件袍子']} />
    </AbsoluteFill>
  );
};

// S10 回师开封（城门向内开 + 正确路线）
const S10: React.FC = () => {
  const f = useCurrentFrame();
  const gateP = interpolate(f, [30, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chips = ['不犯太后幼主', '不凌公卿', '不掠市府'];
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #2A3458 0%, #46404F 55%, #5E4C3C 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <rect key={i} x={20 + i * 80} y={430} width={46} height={40} fill={INK1} />
        ))}
        <rect x={0} y={470} width={1920} height={610} fill={INK1} />
        <path d="M 700 470 L 760 350 L 1160 350 L 1220 470 Z" fill="#0C1326" stroke="#243458" strokeWidth={3} />
        <path d="M 790 1080 L 790 640 Q 960 552 1130 640 L 1130 1080 Z" fill="#04060D" />
        {/* 两扇门：以铰链为轴向内开（宽度按 cos 收缩，向内侧偏移） */}
        <g transform={`translate(${790 + 170 * (1 - Math.cos(gateP * 1.35))} 0)`}>
          <rect x={0} y={640} width={Math.max(170 * Math.cos(gateP * 1.35), 2)} height={440} fill="#5A4428" stroke="#3A2C18" strokeWidth={3} />
        </g>
        <g transform={`translate(${1130 - 170 * (1 - Math.cos(gateP * 1.35))} 0)`}>
          <rect x={-Math.max(170 * Math.cos(gateP * 1.35), 2)} y={640} width={Math.max(170 * Math.cos(gateP * 1.35), 2)} height={440} fill="#4A3820" stroke="#3A2C18" strokeWidth={3} />
        </g>
        {/* 队伍：从右上（东北陈桥方向）沿路走向城门 */}
        {[0, 1, 2, 3, 4].map((i) => {
          const p = interpolate(f, [20 + i * 8, 130 + i * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const px = 1760 - p * 700;
          const py = 520 + p * 240;
          return (
            <g key={i} transform={`translate(${px} ${py}) scale(0.95)`}>
              <Soldier x={0} y={0} s={1} phase={i * 1.3} flag={i === 0} />
            </g>
          );
        })}
        <path d="M 1800 500 C 1620 560 1420 640 1180 760" stroke={GOLD} strokeWidth={4} strokeDasharray="12 14" fill="none" opacity={0.5} />
      </svg>
      <EraTag text="初三 · 回师" />
      <div style={{ position: 'absolute', top: 96, left: 120, right: 120, display: 'flex', justifyContent: 'center', gap: 26 }}>
        {chips.map((c, i) => {
          const p = spring({ frame: f - 8 - i * 10, fps: 24, config: { damping: 12, stiffness: 110 } });
          return (
            <div key={i} style={{
              opacity: p, transform: `scale(${Math.max(p, 0.001)})`,
              background: 'rgba(8,11,22,0.8)', border: `3px solid ${GOLD_D}`, borderRadius: 999,
              padding: '14px 32px', fontSize: 32, fontWeight: 900, color: GOLD,
            }}>{c}</div>
          );
        })}
      </div>
      <Sub f={f} delay={110} lines={['回师开封 · 守将开门内应']} sub={['约法三章，几乎兵不血刃']} />
    </AbsoluteFill>
  );
};

// S11 四连问
const S11: React.FC = () => {
  const f = useCurrentFrame();
  const qs = ['条件，为何已经成熟？', '兵变，为何能成功？', '他，特殊在哪里？', '宋，为何能做 319 年？'];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 30%, #131B3C 0%, #0A0F22 55%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={40} h={700} />
      </svg>
      <div style={{ position: 'absolute', top: '12%', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...up(f, 2, 16, 50), fontSize: 52, fontWeight: 900, color: PAPER, textShadow: `0 0 24px ${GOLD}88` }}>
          故事讲完了。四个问题，一个个拆
        </div>
      </div>
      <div style={{ position: 'absolute', top: '32%', left: 380, right: 380 }}>
        {qs.map((q, i) => {
          const p = spring({ frame: f - 14 - i * 12, fps: 24, config: { damping: 11, stiffness: 130 } });
          return (
            <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * 90}px)`, display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ width: 58, height: 58, borderRadius: 14, background: VERM, color: PAPER, fontWeight: 900, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 28, flexShrink: 0 }}>
                {['一', '二', '三', '四'][i]}
              </div>
              <div style={{ fontSize: 46, fontWeight: 900, color: PAPER }}>{q}</div>
            </div>
          );
        })}
      </div>
      <ChapterTag text="转场 · 四连问" />
    </AbsoluteFill>
  );
};

// S12 条件一 · 位置（开国皇帝闪过 + 禁军 + 都点检）
const S12: React.FC = () => {
  const f = useCurrentFrame();
  const founders = [
    { n: '朱温', d: '后梁', y: '907' },
    { n: '李存勖', d: '后唐', y: '923' },
    { n: '石敬瑭', d: '后晋', y: '936' },
    { n: '刘知远', d: '后汉', y: '947' },
    { n: '郭威', d: '后周', y: '951' },
  ];
  const flash = (i: number) => {
    const st = 20 + i * 34;
    return interpolate(f, [st, st + 6, st + 26, st + 34], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  };
  const armyP = interpolate(f, [200, 236], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tokenP = spring({ frame: f - 262, fps: 24, config: { damping: 11, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 34% 30%, #15203E 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={600} />
        {founders.map((e, i) => {
          const p = flash(i);
          if (p <= 0.01) return null;
          return (
            <g key={i} opacity={p} transform={`translate(340 400) scale(${0.94 + 0.06 * p})`}>
              <circle cx={0} cy={0} r={96} fill="#101A36" stroke={GOLD_D} strokeWidth={4} />
              <circle cx={0} cy={-18} r={30} fill="#C9A27A" />
              <path d="M -26 -34 A 30 30 0 0 1 26 -34 L 22 -50 L -22 -50 Z" fill="#161A26" />
              <path d="M -30 30 L 30 30 L 24 78 L -24 78 Z" fill="#243052" />
              <text x={0} y={150} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={900} fill={PAPER}>{e.n}</text>
              <text x={0} y={192} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill={GREY}>{e.d} · {e.y}</text>
              <text x={0} y={-124} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={800} fill={GOLD}>开国皇帝</text>
            </g>
          );
        })}
        <g opacity={armyP}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Soldier key={i} x={720 + i * 92} y={620} s={0.95} phase={i * 0.9} />
          ))}
          <g transform={`translate(1000 380) scale(${Math.max(tokenP, 0.001)})`}>
            <path d="M -70 -60 L 70 -60 L 70 60 L -70 60 Z" fill="#3A2C18" stroke={GOLD_D} strokeWidth={4} />
            <path d="M -70 -60 L 0 -10 L 70 -60" stroke={GOLD} strokeWidth={4} fill="none" />
            <text x={0} y={22} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={900} fill={GOLD}>兵符</text>
          </g>
        </g>
        <g opacity={interpolate(f, [236, 268], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} transform="translate(1540 420)">
          <Seal x={0} y={0} s={1.15} p={Math.max(tokenP, 0)} char="点检" />
          <text x={0} y={130} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={900} fill={PAPER}>殿前都点检</text>
          <text x={0} y={170} textAnchor="middle" fontFamily={FONT} fontSize={23} fontWeight={700} fill={GREY}>禁军最高统帅</text>
        </g>
      </svg>
      <ChapterTag text="条件一 · 位置" />
      <Sub f={f} delay={196} lines={['五代的皇位，来自兵权']}
        sub={['五位开国皇帝，全是握兵的军人；而赵匡胤，正握着禁军最高军职']} />
    </AbsoluteFill>
  );
};

// S13 只差有人去拧（钥匙与锁）
const S13: React.FC = () => {
  const f = useCurrentFrame();
  const insert = interpolate(f, [20, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const turn = interpolate(f, [66, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowP = interpolate(f, [90, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(100% 90% at 50% 40%, #141C38 0%, #0A0F22 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={520} />
        <g transform="translate(960 380)">
          <circle cx={0} cy={0} r={170} fill="#1A2338" stroke="#3A4A6E" strokeWidth={8} />
          <circle cx={0} cy={0} r={140} fill="#0E1628" stroke="#2A3A5F" strokeWidth={3} />
          <circle cx={0} cy={-20} r={26} fill="#04060D" />
          <path d="M -12 0 L 12 0 L 8 56 L -8 56 Z" fill="#04060D" />
          <g transform={`translate(${-260 + insert * 260} 0) rotate(${turn * 90})`}>
            <rect x={-8} y={-34} width={16} height={120} rx={4} fill={GOLD} />
            <circle cx={0} cy={-56} r={26} fill="none" stroke={GOLD} strokeWidth={12} />
            <rect x={8} y={58} width={30} height={12} fill={GOLD} />
            <rect x={8} y={30} width={22} height={12} fill={GOLD} />
          </g>
          <circle cx={0} cy={0} r={190 + glowP * 40} fill="none" stroke={GOLD} strokeWidth={3} opacity={glowP * 0.7} />
          <circle cx={0} cy={0} r={140} fill={GOLD} opacity={glowP * 0.16} />
        </g>
      </svg>
      <ChapterTag text="条件一 · 最后一步" />
      <Sub f={f} delay={60} lines={['钥匙已经插在锁上']} sub={['不是胆子大，是位置对——只差有人去拧这一下']} />
    </AbsoluteFill>
  );
};

// S14 条件二 · 人望（九人环绕赵匡胤旋转）
const S14: React.FC = () => {
  const f = useCurrentFrame();
  const rot = f * 0.55;
  const names = ['石守信', '王审琦', '李继勋', '杨光义', '刘庆义', '刘守忠', '韩重赟', '王政忠', '刘延让'];
  const R = 300;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 44%, #15203E 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={620} />
        <g transform="translate(960 400)">
          {names.map((n, i) => {
            const a = (i / names.length) * Math.PI * 2 + (rot * Math.PI) / 180;
            const px = Math.cos(a) * R, py = Math.sin(a) * R * 0.42;
            const p = spring({ frame: f - 8 - i * 4, fps: 24, config: { damping: 9, stiffness: 220 } });
            return (
              <g key={i} transform={`translate(${px} ${py}) scale(${Math.max(p, 0.001)})`} opacity={p}>
                <circle cx={0} cy={-46} r={17} fill="#C9A27A" />
                <path d="M -18 -62 A 18 18 0 0 1 18 -62 L 15 -74 L -15 -74 Z" fill="#161A26" />
                <path d="M 0 -28 L 0 18 M 0 18 L -14 52 M 0 18 L 14 52 M 0 -14 L -20 8 M 0 -14 L 20 8"
                  stroke="#2A3A5F" strokeWidth={9} strokeLinecap="round" fill="none" />
                <text x={0} y={86} textAnchor="middle" fontFamily={FONT} fontSize={25} fontWeight={800} fill={PAPER}>{n}</text>
              </g>
            );
          })}
          <g>
            <circle cx={0} cy={0} r={96} fill={GOLD} opacity={0.12} />
            <circle cx={0} cy={-64} r={26} fill="#C9A27A" />
            <path d="M -22 -80 A 26 26 0 0 1 22 -80 L 18 -96 L -18 -96 Z" fill="#161A26" />
            <path d="M 0 -38 L 0 32 M 0 32 L -22 86 M 0 32 L 22 86 M 0 -18 L -30 14 M 0 -18 L 30 14"
              stroke={GOLD} strokeWidth={13} strokeLinecap="round" fill="none" />
            <text x={0} y={-108} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={900} fill={GOLD}>赵匡胤</text>
          </g>
        </g>
      </svg>
      <ChapterTag text="条件二 · 人望" />
      <Sub f={f} delay={40} lines={['义社十兄弟：他，和九个军中兄弟']}
        sub={['兵变当晚，京城内外防务的关键位置，坐的全是自己人']} />
    </AbsoluteFill>
  );
};

// S15 条件三 · 主少国疑 / 权力真空
const S15: React.FC = () => {
  const f = useCurrentFrame();
  const throne = interpolate(f, [20, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const whisper = 0.55 + 0.45 * Math.sin(f * 0.3);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 40%, #131A32 0%, #0A0F22 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={420} />
        <g transform="translate(960 450)" opacity={throne}>
          <path d="M -120 120 L -120 -60 L -80 -100 L 80 -100 L 120 -60 L 120 120 Z" fill="#1A2338" stroke={GOLD_D} strokeWidth={5} />
          <path d="M -120 -60 L 0 -120 L 120 -60" stroke={GOLD} strokeWidth={6} fill="none" />
          <rect x={-84} y={-40} width={168} height={130} rx={8} fill="#0E1628" stroke="#2A3A5F" strokeWidth={3} />
          <circle cx={0} cy={-96} r={34} fill="none" stroke={GOLD} strokeWidth={3} strokeDasharray="8 10" opacity={0.75} />
          <text x={0} y={190} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={900} fill={GOLD} opacity={0.9}>龙椅 · 无人坐稳</text>
        </g>
        <g transform="translate(520 700)">
          <circle cx={0} cy={-44} r={14} fill="#C9A27A" />
          <path d="M 0 -30 L 0 20 M 0 20 L -13 60 M 0 20 L 13 60 M 0 -18 L -18 8 M 0 -18 L 18 8"
            stroke="#2A3A5F" strokeWidth={9} strokeLinecap="round" fill="none" />
          <text x={0} y={96} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill={PAPER}>7 岁幼帝</text>
        </g>
        {[[300, 760], [1420, 740], [1620, 780]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`} opacity={whisper}>
            <circle cx={0} cy={-52} r={15} fill="#0B1122" />
            <path d="M 0 -38 L 0 18 M 0 18 L -16 60 M 0 18 L 16 60 M 0 -26 L -22 -4 M 0 -26 L 22 -6"
              stroke="#0B1122" strokeWidth={10} strokeLinecap="round" fill="none" />
          </g>
        ))}
        <Ridge baseY={900} amp={20} color={INK2} seed={1.4} />
      </svg>
      <ChapterTag text="条件三 · 时机" />
      <Sub f={f} delay={40} lines={['主少国疑 · 权力出现真空']}
        sub={['39 岁的雄主骤逝，7 岁的孩子坐上龙椅——五代人知道，这种局面只有一种结局']} />
    </AbsoluteFill>
  );
};

// S16 时机 · 窗口
const S16: React.FC = () => {
  const f = useCurrentFrame();
  const open = interpolate(f, [20, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const step = interpolate(f, [80, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cw = 120 * Math.cos(open * 1.4);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(100% 90% at 50% 40%, #16203C 0%, #0A0F22 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={22} h={460} />
        <g transform="translate(960 380)">
          <rect x={-260} y={-230} width={520} height={460} rx={10} fill="#0A0F22" stroke="#3A4A6E" strokeWidth={10} />
          <rect x={-240} y={-210} width={480} height={420} fill="#070B16" />
          <rect x={-240 + (1 - open) * 240} y={-210} width={480 * open} height={420} fill="#FFD98A" opacity={0.16 * open} />
          <path d={`M ${-240 + (1 - open) * 240} -210 L ${-240 + (1 - open) * 240 + 480 * open} -210 L ${-60} 210 L ${60} 210 Z`} fill="#FFE8A3" opacity={0.1 * open} />
          <g transform={`translate(${-240 + 120 * (1 - Math.cos(open * 1.4))} 0)`}>
            <rect x={0} y={-210} width={Math.max(cw, 2)} height={420} fill="#2A3450" stroke="#3A4A6E" strokeWidth={4} />
          </g>
          <g transform={`translate(${240 - 120 * (1 - Math.cos(open * 1.4))} 0)`}>
            <rect x={-Math.max(cw, 2)} y={-210} width={Math.max(cw, 2)} height={420} fill="#2A3450" stroke="#3A4A6E" strokeWidth={4} />
          </g>
          <g transform={`translate(0 ${140 - step * 120}) scale(${0.9 - step * 0.2})`} opacity={0.85}>
            <circle cx={0} cy={-46} r={15} fill="#0B1122" />
            <path d="M 0 -32 L 0 18 M 0 18 L -14 54 M 0 18 L 14 54 M 0 -20 L -20 4 M 0 -20 L 20 4"
              stroke="#0B1122" strokeWidth={10} strokeLinecap="round" fill="none" />
          </g>
          <text x={0} y={300} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={800} fill={GOLD} opacity={0.85}>
            窗口打开的时间，只有这一夜
          </text>
        </g>
      </svg>
      <ChapterTag text="条件三 · 窗口" />
      <Sub f={f} delay={60} lines={['一纸急报，给了他合法出城的窗口']}
        sub={['带着禁军主力离开京城——兵变最难的一步，被这道边警解决了']} />
    </AbsoluteFill>
  );
};

// S17 特殊性一 · 死法（旗帜被红叉划掉）
const S17: React.FC = () => {
  const f = useCurrentFrame();
  const list = [
    { d: '梁', n: '朱温', how: '死于亲子之手' },
    { d: '唐', n: '李存勖', how: '乱兵所杀' },
    { d: '唐', n: '李从珂', how: '自焚而亡' },
    { d: '晋', n: '石重贵', how: '被掳北上' },
    { d: '汉', n: '刘承祐', how: '逃亡被杀' },
  ];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 36%, #2A1420 0%, #120A16 55%, #06040A 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={300} />
        {list.map((e, i) => {
          const st = 20 + i * 40;
          const rise = interpolate(f, [st, st + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const cross = interpolate(f, [st + 26, st + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const fall = interpolate(f, [st + 42, st + 56], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const x = 250 + i * 350;
          return (
            <g key={i}>
              <g transform={`translate(${x} 560) rotate(${fall * 70})`}>
                <line x1={0} y1={0} x2={0} y2={-200 * Math.max(rise, 0.001)} stroke="#3A2C18" strokeWidth={7} />
                <g opacity={rise}>
                  <path d="M 0 -196 L 150 -180 L 0 -164 Z" fill="#5A2A24" stroke={GOLD_D} strokeWidth={3} />
                  <text x={52} y={-172} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={900} fill={PAPER}>{e.d}</text>
                </g>
              </g>
              <g transform={`translate(${x} 600)`} opacity={rise}>
                <text x={0} y={0} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={900} fill={PAPER}>{e.d} · {e.n}</text>
                <text x={0} y={44} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={700} fill={GREY}>{e.how}</text>
                <g opacity={cross}>
                  <line x1={-110} y1={-40} x2={110} y2={40} stroke={RED} strokeWidth={10} strokeLinecap="round" />
                  <line x1={110} y1={-40} x2={-110} y2={40} stroke={RED} strokeWidth={10} strokeLinecap="round" />
                </g>
              </g>
            </g>
          );
        })}
        <Ridge baseY={900} amp={18} color="#1A1020" seed={2.8} />
      </svg>
      <ChapterTag text="特殊性一 · 不杀" />
      <Sub f={f} delay={30} lines={['在他之前，皇帝几乎没有善终']}
        sub={['换旗、杀人、再被换旗——这就是五代五十三年循环的全部内容']} />
    </AbsoluteFill>
  );
};

// S18 特殊性一 · 三条做法（中央播放 → 右侧排列）
const S18: React.FC = () => {
  const f = useCurrentFrame();
  const items = [
    { t: '入城约法', d: '不犯太后幼主 · 不凌公卿 · 不掠市府', icon: 'scroll' },
    { t: '优待柴氏', d: '恭帝封郑王、得以善终，柴氏世代受礼遇', icon: 'seal' },
    { t: '文臣不换血', d: '后周旧臣原班留用，统治机器照常运转', icon: 'hat' },
  ];
  const slotY = [230, 420, 610];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 40% 34%, #15203E 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={700} />
      </svg>
      {items.map((it, i) => {
        const st = 10 + i * 76;
        const appear = spring({ frame: f - st, fps: 24, config: { damping: 12, stiffness: 110 } });
        const move = interpolate(f, [st + 64, st + 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const x = 960 + move * 500;
        const y = 480 + (slotY[i] - 480) * move;
        const sc = 1 - move * 0.42;
        return (
          <div key={i} style={{
            position: 'absolute', left: x - 330, top: y - 90, width: 660, height: 180,
            opacity: appear, transform: `scale(${Math.max(appear, 0.001) * sc})`,
            background: 'rgba(12,19,40,0.9)', border: `3px solid ${GOLD_D}66`, borderRadius: 22,
            display: 'flex', alignItems: 'center', padding: '0 30px', gap: 24,
          }}>
            <svg width={90} height={90} viewBox="0 0 90 90">
              {it.icon === 'scroll' && (
                <g><rect x={14} y={20} width={62} height={50} rx={4} fill="#E8DCC0" /><path d="M 22 34 h 46 M 22 44 h 46 M 22 54 h 32" stroke="#8A7A5A" strokeWidth={3} /><rect x={10} y={16} width={8} height={58} rx={3} fill={GOLD_D} /><rect x={72} y={16} width={8} height={58} rx={3} fill={GOLD_D} /></g>
              )}
              {it.icon === 'seal' && (
                <g><rect x={20} y={20} width={50} height={50} rx={8} fill={VERM} /><rect x={28} y={28} width={34} height={34} rx={5} fill="none" stroke={PAPER} strokeWidth={3} /><text x={45} y={54} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={900} fill={PAPER}>柴</text></g>
              )}
              {it.icon === 'hat' && (
                <g><path d="M 20 52 L 70 52 L 62 30 L 28 30 Z" fill="#1A2338" stroke={GOLD_D} strokeWidth={3} /><rect x={14} y={52} width={62} height={9} rx={4} fill={GOLD_D} /><path d="M 34 30 L 45 14 L 56 30" fill="none" stroke={GOLD_D} strokeWidth={4} /></g>
              )}
            </svg>
            <div>
              <div style={{ fontSize: 38, fontWeight: 900, color: GOLD, marginBottom: 8 }}>{it.t}</div>
              <div style={{ fontSize: 27, fontWeight: 700, color: PAPER, lineHeight: 1.45 }}>{it.d}</div>
            </div>
          </div>
        );
      })}
      <ChapterTag text="特殊性一 · 三件事" />
      <Sub f={f} delay={252} lines={['他用克制，换来了整个官僚系统的合作']}
        sub={['马上得天下，不能马上治天下']} />
    </AbsoluteFill>
  );
};

// S19 杯酒释兵权
const S19: React.FC = () => {
  const f = useCurrentFrame();
  const cupP = spring({ frame: f - 10, fps: 24, config: { damping: 11, stiffness: 100 } });
  const handP = interpolate(f, [60, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tokenP = interpolate(f, [110, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(100% 90% at 50% 38%, #1C1A30 0%, #0C0C1C 58%, #04040A 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={22} h={420} />
        <rect x={560} y={600} width={800} height={26} rx={8} fill="#4A3820" stroke="#3A2C18" strokeWidth={3} />
        <g transform={`translate(860 540) scale(${Math.max(cupP, 0.001)})`}>
          <path d="M -70 0 L 70 0 L 52 56 L -52 56 Z" fill="#C9B06A" stroke={GOLD_D} strokeWidth={5} />
          <path d="M -70 0 Q -84 34 -54 56 M 70 0 Q 84 34 54 56" stroke={GOLD_D} strokeWidth={5} fill="none" />
          <ellipse cx={0} cy={2} rx={70} ry={12} fill="#8A6B2A" />
          <ellipse cx={0} cy={2} rx={56} ry={8} fill="#FFE8A3" opacity={0.9} />
        </g>
        <g transform={`translate(1120 560) translate(0 ${(1 - tokenP) * 60})`} opacity={tokenP}>
          <path d="M -56 -46 L 56 -46 L 56 46 L -56 46 Z" fill="#3A2C18" stroke={GOLD_D} strokeWidth={4} />
          <path d="M -56 -46 L 0 -6 L 56 -46" stroke={GOLD} strokeWidth={4} fill="none" />
          <text x={0} y={18} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={900} fill={GOLD}>兵符</text>
        </g>
        <g opacity={handP}>
          <path d="M 700 640 Q 780 600 820 576" stroke="#C9A27A" strokeWidth={20} strokeLinecap="round" fill="none" />
          <path d="M 1220 640 Q 1140 600 1100 576" stroke="#C9A27A" strokeWidth={20} strokeLinecap="round" fill="none" />
        </g>
      </svg>
      <ChapterTag text="特殊性二 · 杯酒" />
      <Sub f={f} delay={70} lines={['建隆二年，一场酒席']} sub={['请老兄弟们交出兵权、回家享福——没有杀一个人']} />
    </AbsoluteFill>
  );
};

// S20 立制度（三画面）
const S20: React.FC = () => {
  const f = useCurrentFrame();
  const items = [
    { k: '收精兵', st: 20 },
    { k: '制钱谷', st: 96 },
    { k: '文官治国', st: 172 },
  ];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 36%, #14203C 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={560} />
        {items.map((it, i) => {
          const p = spring({ frame: f - it.st, fps: 24, config: { damping: 12, stiffness: 110 } });
          const x = 200 + i * 540;
          return (
            <g key={i} transform={`translate(${x} 300)`} opacity={p}>
              <rect x={0} y={0} width={440} height={330} rx={18} fill="rgba(10,16,32,0.9)" stroke={`${GOLD_D}66`} strokeWidth={3} />
              {i === 0 && (
                <g transform="translate(220 150)">
                  {[0, 1, 2].map((k) => (
                    <g key={k} transform={`translate(${-150 + k * 55 + ((f * 1.2) % 40)} 40)`}>
                      <circle cx={0} cy={-40} r={9} fill="#2A3A5F" />
                      <path d="M 0 -30 L 0 6 M 0 6 L -9 28 M 0 6 L 9 28" stroke="#2A3A5F" strokeWidth={6} strokeLinecap="round" fill="none" />
                    </g>
                  ))}
                  <path d="M -150 0 L 110 0" stroke={GOLD} strokeWidth={4} strokeDasharray="10 10" />
                  <path d="M 110 0 l -18 -10 l 0 20 Z" fill={GOLD} />
                  <rect x={110} y={-40} width={80} height={80} rx={8} fill="#1A2338" stroke={GOLD} strokeWidth={3} />
                  <text x={150} y={6} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={900} fill={GOLD}>禁军</text>
                </g>
              )}
              {i === 1 && (
                <g transform="translate(220 150)">
                  {[0, 1, 2, 3].map((k) => {
                    const cx = -160 + k * 50 + ((f * 1.4 + k * 20) % 60);
                    return (
                      <g key={k}>
                        <circle cx={cx} cy={-10} r={18} fill="#C9B06A" stroke={GOLD_D} strokeWidth={3} />
                        <rect x={cx - 6} y={-16} width={12} height={12} fill="#0A1020" />
                      </g>
                    );
                  })}
                  <path d="M -170 40 L 120 40" stroke={GOLD} strokeWidth={4} strokeDasharray="10 10" />
                  <rect x={120} y={-50} width={80} height={100} rx={8} fill="#1A2338" stroke={GOLD} strokeWidth={3} />
                  <text x={160} y={8} textAnchor="middle" fontFamily={FONT} fontSize={20} fontWeight={900} fill={GOLD}>中央</text>
                </g>
              )}
              {i === 2 && (
                <g transform="translate(220 150)">
                  <circle cx={-60} cy={-40} r={20} fill="#C9A27A" />
                  <path d="M -80 -52 L 40 -52 L 30 -70 L -70 -70 Z" fill="#1A2338" stroke={GOLD_D} strokeWidth={3} />
                  <path d="M -60 -18 L -60 40 M -60 40 L -76 80 M -60 40 L -44 80" stroke="#2A3A5F" strokeWidth={10} strokeLinecap="round" fill="none" />
                  <rect x={20} y={-20} width={90} height={60} rx={4} fill="#E8DCC0" />
                  <path d="M 32 -4 h 66 M 32 12 h 66 M 32 28 h 46" stroke="#8A7A5A" strokeWidth={3} />
                </g>
              )}
              <text x={220} y={300} textAnchor="middle" fontFamily={FONT} fontSize={32} fontWeight={900} fill={GOLD}>{it.k}</text>
            </g>
          );
        })}
      </svg>
      <ChapterTag text="特殊性二 · 立制度" />
      <Sub f={f} delay={60} lines={['别人只换龙椅上的姓，他拆掉了那台机器']}
        sub={['收精兵 · 制钱谷 · 文官治国——从制度上关掉「兵强马壮者为之」的循环']} />
    </AbsoluteFill>
  );
};

// S21 答案：53 vs 319
const S21: React.FC = () => {
  const f = useCurrentFrame();
  const b1 = interpolate(f, [10, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b2 = interpolate(f, [46, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rows = 6;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 30%, #131C3E 0%, #0A0F22 55%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={520} />
        <g transform="translate(260 300)" opacity={b1}>
          <text x={0} y={-24} fontFamily={FONT} fontSize={30} fontWeight={800} fill={GREY}>五代 · 53 年 · 五朝十四帝</text>
          <rect x={0} y={0} width={520 * b1} height={44} rx={8} fill={RED} opacity={0.85} />
          <text x={520 * b1 + 20} y={32} fontFamily={FONT} fontSize={32} fontWeight={900} fill={RED}>53</text>
        </g>
        <g transform="translate(260 430)">
          <text x={0} y={-24} fontFamily={FONT} fontSize={30} fontWeight={800} fill={GREY}>两宋 · 319 年 · 十八帝</text>
          {Array.from({ length: rows }).map((_, i) => {
            const p = interpolate(b2, [i * 0.12, i * 0.12 + 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return <rect key={i} x={0} y={i * 50} width={520 * p} height={38} rx={7} fill={GOLD} opacity={0.9 - i * 0.04} />;
          })}
          <text x={520 * b2 + 20} y={40} fontFamily={FONT} fontSize={32} fontWeight={900} fill={GOLD}>319</text>
        </g>
        <text x={1400} y={480} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={PAPER} opacity={b2}>
          五代 1 条
        </text>
        <text x={1400} y={540} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={PAPER} opacity={b2}>
          ≈ 两宋 6 条
        </text>
      </svg>
      <ChapterTag text="答案" />
      <Sub f={f} delay={120} lines={['黄袍加身只是开门']} sub={['不杀与立制度，才是让王朝活 319 年的原因']} />
    </AbsoluteFill>
  );
};

// S22 收尾（文案改口）
const S22: React.FC = () => {
  const f = useCurrentFrame();
  const p = spring({ frame: f - 4, fps: 24, config: { damping: 13, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 16%, #141C3A 0%, #0A0F22 55%, #05070F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={44} h={480} />
        <g transform={`translate(960 300) scale(${0.42 * Math.max(p, 0.001)})`} opacity={p}>
          <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
          <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
        </g>
      </svg>
      <div style={{ position: 'absolute', top: '44%', left: 120, right: 120, textAlign: 'center' }}>
        <div style={{ ...up(f, 4, 18, 80), fontSize: 50, fontWeight: 900, lineHeight: 1.5, color: PAPER, textShadow: `0 0 26px ${GOLD}88` }}>
          愿你看懂每一次「水到渠成」：
        </div>
        <div style={{ ...up(f, 14, 18, 80), marginTop: 16, fontSize: 40, fontWeight: 900, color: GOLD, lineHeight: 1.5 }}>
          机会来时有准备，握权时有分寸，做事时有章法
        </div>
      </div>
      <div style={{ ...up(f, 26, 16, 50), position: 'absolute', bottom: 300, left: 0, right: 0, textAlign: 'center', fontSize: 28, color: GREY, fontWeight: 700 }}>
        第 1 集 · 一件黄袍 ｜ 下一支 · 杯酒释兵权
      </div>
      <div style={{ ...up(f, 34, 16, 50), position: 'absolute', bottom: 200, left: 0, right: 0, textAlign: 'center', fontSize: 34, color: GOLD, fontWeight: 900 }}>
        关注我 · 每天一个历史真相
      </div>
    </AbsoluteFill>
  );
};

// ================= 条件成熟度倒计时 =================
const Meter: React.FC = () => {
  const g = useCurrentFrame();
  if (g < 240 || g > 2520) return null;
  const p = interpolate(g, [240, 432, 720, 912, 1104, 1296, 1584, 1776, 2064, 2304, 2448],
    [0, 8, 15, 25, 32, 40, 52, 60, 72, 85, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = interpolate(g, [240, 270, 2448, 2520], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', right: 48, top: 108, width: 300, opacity: fade }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 22, color: GOLD, fontWeight: 900, letterSpacing: 3 }}>条件成熟度</span>
        <span style={{ fontSize: 22, color: PAPER, fontWeight: 900 }}>{Math.round(p)}%</span>
      </div>
      <div style={{ height: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: `linear-gradient(90deg, ${GOLD_D}, ${GOLD})`, borderRadius: 6 }} />
      </div>
    </div>
  );
};

// ================= 时间轴 =================
const DURS = [240, 192, 288, 192, 192, 192, 288, 192, 288, 240, 144, 336, 144, 288, 240, 192, 336, 336, 240, 336, 288, 192];
const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22];

export const Chenqiao: React.FC = () => {
  let acc = 0;
  const seqs: React.ReactNode[] = [];
  SCENES.forEach((C, i) => {
    seqs.push(<Sequence key={i} from={acc} durationInFrames={DURS[i]}><C /></Sequence>);
    acc += DURS[i];
  });
  return (
    <AbsoluteFill style={{ background: '#05070F' }}>
      {seqs}
      <Meter />
    </AbsoluteFill>
  );
};
