import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from 'remotion';

/**
 * 《黄袍加身之前》· 横版 1920×1080 · 213s · 22 幕（含 3s 黑场起幅）
 *
 * 本版修复：开场不再仓促（黑场起幅）；人物按身份精修（冕冠/铠甲/展脚幞头/总角/布巾，交领右衽、靴）；
 * 龙袍带纹样；万岁从士兵头顶冒出且满屏；士兵欢呼；城门上下相接、匾额在城墙、门钉随门扇透视移动；
 * 钥匙用蒙版插入（去转动）；五帝不设光环、以褪色示死、死因在下方同步；虎符改为虎形兵符；
 * 人望圆环按前后遮挡排序；龙椅重绘、幼帝居中坐椅、太后与闪动群臣；窗棂优化；
 * 宴会分上位下位、赵匡胤举杯；矩阵改一年一格；结尾删「第 1 集 · 一件黄袍」。
 */

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
const up = (f: number, delay = 0, dur = 18, dist = 90) => {
  const t = interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const e = easeOut(t);
  return { opacity: e, transform: `translateY(${(1 - e) * dist}px)` };
};

const Sub: React.FC<{ f: number; lines: string[]; sub?: string[]; accent?: string; delay?: number }> =
  ({ f, lines, sub, accent = GOLD, delay = 2 }) => (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 290 }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(4,6,13,0) 0%, rgba(4,6,13,0.6) 30%, rgba(4,6,13,0.9) 68%, rgba(4,6,13,0.96) 100%)',
      }} />
      <div style={{ position: 'absolute', left: 110, right: 110, bottom: 40, textAlign: 'center' }}>
        {lines.map((t, i) => (
          <div key={i} style={{
            ...up(f, delay + i * 12, 18, 90),
            fontSize: 54, fontWeight: 900, lineHeight: 1.34, color: PAPER,
            textShadow: `0 0 26px ${accent}99, 0 2px 6px rgba(0,0,0,0.8)`,
          }}>{t}</div>
        ))}
        {sub?.map((s, i) => (
          <div key={'s' + i} style={{
            ...up(f, delay + 22 + i * 14, 18, 70),
            marginTop: 10, fontSize: 31, fontWeight: 700, color: '#D9D3C2',
            textShadow: '0 2px 6px rgba(0,0,0,0.85)',
          }}>{s}</div>
        ))}
      </div>
    </div>
  );

const ChapterTag: React.FC<{ text: string; color?: string }> = ({ text, color = GOLD }) => (
  <div style={{
    position: 'absolute', left: 48, top: 44, fontFamily: FONT, fontSize: 25, fontWeight: 800,
    letterSpacing: 5, color, border: `3px solid ${color}88`, borderRadius: 999,
    padding: '9px 26px', background: 'rgba(8,11,22,0.72)',
  }}>{text}</div>
);

const EraTag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: 'absolute', right: 48, top: 44, fontFamily: FONT, fontSize: 25, fontWeight: 800,
    letterSpacing: 5, color: GOLD, border: `3px solid ${GOLD_D}`, borderRadius: 999,
    padding: '9px 26px', background: 'rgba(8,11,22,0.72)',
  }}>{text}</div>
);

const Stars: React.FC<{ n?: number; h?: number; fade?: number }> = ({ n = 50, h = 400, fade = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g opacity={fade}>
      {Array.from({ length: n }).map((_, i) => {
        const x = ((i * 173) % 1860) + 30;
        const y = ((i * 53) % (h - 30)) + 20;
        const o = 0.16 + 0.44 * Math.abs(Math.sin(i * 1.7 + f * 0.05));
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

const Steam: React.FC<{ x: number; y: number; s?: number; n?: number }> = ({ x, y, s = 1, n = 4 }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: n }).map((_, i) => {
        const prog = ((f * 2.2 + i * 46) % 150) / 150;
        return (
          <ellipse key={i} cx={Math.sin(f * 0.05 + i) * 14} cy={-prog * 130}
            rx={12 + prog * 22} ry={9 + prog * 14} fill="#D8D2C2" opacity={0.24 * (1 - prog)} />
        );
      })}
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

// 帐篷
const Tent: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <line x1={0} y1={-84} x2={0} y2={-104} stroke={INK3} strokeWidth={4} />
    <path d="M 0 -104 q 24 4 34 20" stroke={VERM} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M -92 0 L 0 -84 L 92 0 Z" fill="#0F1730" stroke={INK3} strokeWidth={3} />
    <path d="M -20 0 L 0 -36 L 20 0 Z" fill="#060A16" />
  </g>
);

// ---------- 人物（历史向精修） ----------
type Role = 'emperor' | 'general' | 'soldier' | 'official' | 'child' | 'empress' | 'civilian';
const ROLE: Record<Role, { robe: string; robe2: string; trim: string; skin: string }> = {
  emperor: { robe: '#D9B04A', robe2: '#B8862B', trim: '#7A1B16', skin: '#E2BE96' },
  empress: { robe: '#8E3B52', robe2: '#6A2A3E', trim: '#D9B04A', skin: '#EFD3AE' },
  general: { robe: '#5E6E88', robe2: '#3E4C64', trim: '#8A1F1A', skin: '#E2BE96' },
  soldier: { robe: '#2E3E60', robe2: '#1E2A44', trim: '#4A5A7F', skin: '#D9B58C' },
  official: { robe: '#22304F', robe2: '#161F35', trim: '#7A6A3A', skin: '#E2BE96' },
  child: { robe: '#8A4A5A', robe2: '#6A3444', trim: '#C9A227', skin: '#EFD3AE' },
  civilian: { robe: '#4A3B2E', robe2: '#33281F', trim: '#6A5A4A', skin: '#D9B58C' },
};

const Person: React.FC<{
  x: number; y: number; s?: number; role?: Role; walk?: number; flip?: boolean; armUp?: number; grey?: number; bow?: number;
}> = ({ x, y, s = 1, role = 'civilian', walk, flip = false, armUp = 0, grey = 0, bow = 0 }) => {
  const f = useCurrentFrame();
  const c = ROLE[role];
  // 关键修复：walk 未传入时腿部完全静止（此前会一直抖）
  const step = walk === undefined ? 0 : Math.sin(f * 0.3 + walk * 2);
  const breathe = Math.sin(f * 0.09 + (walk ?? 0)) * 1.2;
  const headY = -104 + breathe + bow * 14;
  const armSwing = walk === undefined ? 0 : step * 0.5;
  const L = -44 - armSwing * 12;
  const R = 44 + armSwing * 12;
  const LY = -6 - armUp * 56;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} style={{ filter: grey > 0 ? `grayscale(${grey}) brightness(${1 - grey * 0.42})` : undefined }}>
      {/* 靴 */}
      <path d={`M ${-8 - step * 10} 88 l -14 8 l 0 8 l 26 0 Z`} fill="#141018" />
      <path d={`M ${8 + step * 10} 88 l -14 8 l 0 8 l 26 0 Z`} fill="#141018" />
      {/* 腿 */}
      <line x1={-8} y1={36} x2={-8 - step * 10} y2={92} stroke={c.robe2} strokeWidth={14} strokeLinecap="round" />
      <line x1={8} y1={36} x2={8 + step * 10} y2={92} stroke={c.robe2} strokeWidth={14} strokeLinecap="round" />
      {/* 袍身（下摆微张） */}
      <path d="M -30 -70 L 30 -70 L 40 44 L -40 44 Z" fill={c.robe} />
      <path d="M -30 -70 L 0 -50 L 30 -70 L 30 -60 L 0 -40 L -30 -60 Z" fill={c.robe2} opacity={0.9} />
      {/* 交领右衽：两片衣襟交叉压叠（不是挂绳） */}
      <path d="M -15 -70 L 5 -28" stroke={c.trim} strokeWidth={7} strokeLinecap="round" />
      <path d="M 15 -70 L -5 -28" stroke={c.robe2} strokeWidth={7} strokeLinecap="round" />
      {/* 腰带 */}
      <rect x={-34} y={14} width={68} height={12} fill={c.trim} />
      <rect x={-10} y={12} width={20} height={16} rx={3} fill={GOLD_D} opacity={0.9} />
      {/* 臂：袖身 + 袖口 + 手（抬高时仍可辨识为手臂） */}
      <line x1={-28} y1={-62} x2={L} y2={LY} stroke={c.robe} strokeWidth={17} strokeLinecap="round" />
      <line x1={28} y1={-62} x2={R} y2={LY} stroke={c.robe} strokeWidth={17} strokeLinecap="round" />
      <line x1={-28} y1={-62} x2={L} y2={LY} stroke={c.robe2} strokeWidth={6} strokeLinecap="round" opacity={0.55} />
      <line x1={28} y1={-62} x2={R} y2={LY} stroke={c.robe2} strokeWidth={6} strokeLinecap="round" opacity={0.55} />
      <circle cx={L * 0.94} cy={LY * 0.94} r={9} fill={c.robe2} />
      <circle cx={R * 0.94} cy={LY * 0.94} r={9} fill={c.robe2} />
      <ellipse cx={L} cy={LY} rx={7} ry={9} fill={c.skin} />
      <ellipse cx={R} cy={LY} rx={7} ry={9} fill={c.skin} />
      {/* 颈头 */}
      <rect x={-7} y={-84} width={14} height={16} fill={c.skin} />
      <circle cx={0} cy={headY} r={20} fill={c.skin} />
      {/* 身份头饰 */}
      {role === 'emperor' && (
        <g>
          <rect x={-30} y={headY - 34} width={60} height={8} rx={2} fill="#141018" />
          <rect x={-16} y={headY - 26} width={32} height={12} fill="#141018" />
          {[-24, -12, 0, 12, 24].map((dx, i) => (
            <g key={i}>
              <line x1={dx} y1={headY - 26} x2={dx} y2={headY - 8} stroke={GOLD} strokeWidth={2} opacity={0.9} />
              <circle cx={dx} cy={headY - 6} r={2.6} fill={GOLD} />
            </g>
          ))}
          {/* 袍前团龙纹（在腹部，不是胸前挂牌） */}
          <circle cx={0} cy={6} r={11} fill="none" stroke={GOLD_D} strokeWidth={2} opacity={0.5} />
          <path d="M -6 6 q 6 -7 12 0 q -6 7 -12 0" stroke={GOLD_D} strokeWidth={1.8} fill="none" opacity={0.55} />
        </g>
      )}
      {role === 'empress' && (
        <g>
          <path d={`M -22 ${headY - 14} Q 0 ${headY - 40} 22 ${headY - 14}`} fill="#141018" />
          <circle cx={0} cy={headY - 32} r={6} fill={GOLD} />
          <path d={`M -20 ${headY - 6} l -8 14 M 20 ${headY - 6} l 8 14`} stroke={GOLD_D} strokeWidth={2} />
        </g>
      )}
      {role === 'general' && (
        <g>
          <path d={`M -21 ${headY - 12} Q 0 ${headY - 36} 21 ${headY - 12} Z`} fill="#6E7A92" stroke="#98A6BE" strokeWidth={2} />
          <path d={`M 0 ${headY - 32} q 5 -16 0 -26`} stroke={VERM} strokeWidth={5} fill="none" strokeLinecap="round" />
          <rect x={-23} y={headY - 12} width={46} height={7} rx={3} fill="#98A6BE" />
          {/* 护肩 */}
          <path d="M -34 -64 q -10 10 -2 20 q 12 -6 14 -18 Z" fill="#98A6BE" opacity={0.9} />
          <path d="M 34 -64 q 10 10 2 20 q -12 -6 -14 -18 Z" fill="#98A6BE" opacity={0.9} />
        </g>
      )}
      {role === 'soldier' && (
        <g>
          <path d={`M -19 ${headY - 10} Q 0 ${headY - 30} 19 ${headY - 10} Z`} fill="#3A4A6E" stroke="#54648C" strokeWidth={1.5} />
          <rect x={-21} y={headY - 10} width={42} height={6} rx={3} fill="#54648C" />
          <rect x={-26} y={-58} width={52} height={9} rx={4} fill="#54648C" opacity={0.75} />
        </g>
      )}
      {role === 'official' && (
        <g>
          <rect x={-19} y={headY - 27} width={38} height={21} rx={7} fill="#12141C" />
          <rect x={-60} y={headY - 20} width={42} height={5} rx={2.5} fill="#12141C" />
          <rect x={18} y={headY - 20} width={42} height={5} rx={2.5} fill="#12141C" />
          {/* 笏板 */}
          <rect x={R - 2} y={LY - 26} width={7} height={30} rx={3} fill="#D8D2C2" opacity={0.85} />
        </g>
      )}
      {role === 'child' && (
        <g>
          <circle cx={-12} cy={headY - 19} r={7} fill="#1A1A22" />
          <circle cx={12} cy={headY - 19} r={7} fill="#1A1A22" />
        </g>
      )}
      {role === 'civilian' && (
        <path d={`M -19 ${headY - 10} Q 0 ${headY - 24} 19 ${headY - 10}`} stroke="#6A5A4A" strokeWidth={5} fill="none" />
      )}
    </g>
  );
};

// 骏马
const Horse: React.FC<{ x: number; y: number; s?: number; phase?: number; rider?: boolean }> =
  ({ x, y, s = 1, phase = 0, rider = true }) => {
    const f = useCurrentFrame();
    const g = f * 0.42 + phase;
    const leg = (i: number) => Math.sin(g + i * 1.55) * 34;
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d={`M -58 -34 q ${-24 + Math.sin(g) * 8} 12 -34 36`} stroke="#0B1122" strokeWidth={9} fill="none" strokeLinecap="round" />
        <ellipse cx={0} cy={-20} rx={62} ry={25} fill="#0B1122" />
        <path d="M 44 -32 C 62 -52 70 -66 74 -84 L 100 -76 C 96 -56 86 -38 72 -20 Z" fill="#0B1122" />
        <path d="M 74 -86 l 14 -12 l 8 12 z" fill="#0B1122" />
        <path d="M 96 -80 q 12 4 14 14" stroke="#0B1122" strokeWidth={6} fill="none" />
        <path d="M 50 -44 q 14 -18 22 -30" stroke="#2A2236" strokeWidth={8} fill="none" />
        {[0, 1, 2, 3].map((i) => {
          const a = (leg(i) * Math.PI) / 180;
          const hx = i < 2 ? -38 : 38;
          const kneeX = hx + Math.sin(a) * 26, kneeY = 4 + Math.cos(a) * 26;
          const footX = kneeX + Math.sin(a * 0.55) * 20, footY = kneeY + 34;
          return (
            <g key={i}>
              <line x1={hx} y1={-6} x2={kneeX} y2={kneeY} stroke="#0B1122" strokeWidth={9} strokeLinecap="round" />
              <line x1={kneeX} y1={kneeY} x2={footX} y2={footY} stroke="#0B1122" strokeWidth={7} strokeLinecap="round" />
              <circle cx={footX} cy={footY} r={4.5} fill="#0B1122" />
            </g>
          );
        })}
        {rider && (
          <g transform="translate(-4 -52)">
            <circle cx={0} cy={-26} r={10} fill="#C9A27A" />
            <path d="M -14 -34 Q 0 -50 14 -34" fill="#3A4A6E" />
            <path d="M 0 -16 L 0 16 M 0 -10 L -16 6 M 0 -10 L 18 -4" stroke="#2A3A5F" strokeWidth={8} strokeLinecap="round" fill="none" />
            <line x1={20} y1={-44} x2={44} y2={-78} stroke="#3A2C18" strokeWidth={4} strokeLinecap="round" />
            <path d="M 44 -78 q 16 2 24 12" stroke={VERM} strokeWidth={4} fill="none" />
          </g>
        )}
      </g>
    );
  };

// 虎符（虎形，中缝对半，不写字）
const TigerTally: React.FC<{ x: number; y: number; s?: number; split?: number; label?: boolean }> =
  ({ x, y, s = 1, split = 0, label = false }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* 左半 */}
      <g transform={`translate(${-split * 22} 0)`}>
        <path d="M -84 16 C -82 -8 -62 -30 -32 -36 C -4 -42 18 -32 28 -16 C 34 -8 34 2 32 16 L 12 16 C 10 6 2 0 -8 0 C -20 0 -28 6 -30 16 Z"
          fill="#7A6A2A" stroke={GOLD_D} strokeWidth={3} />
        {/* 虎头 */}
        <path d="M 30 -16 C 44 -22 54 -16 56 -4 C 50 4 40 6 32 2 Z" fill="#7A6A2A" stroke={GOLD_D} strokeWidth={3} />
        <circle cx={44} cy={-8} r={3} fill="#2A2010" />
        <path d="M 36 -18 l 6 -8 l 4 8" fill="#7A6A2A" stroke={GOLD_D} strokeWidth={2} />
        {/* 虎身斑纹 */}
        <path d="M -56 -18 q 10 8 4 18 M -38 -24 q 10 10 4 20" stroke="#2A2010" strokeWidth={2.5} fill="none" opacity={0.75} />
      </g>
      {/* 右半 */}
      <g transform={`translate(${split * 22} 0)`}>
        <path d="M -2 16 C -4 4 2 -6 14 -12 C 26 -18 40 -12 44 0 C 46 8 44 14 42 16 L 24 16 C 24 8 18 2 10 2 C 4 2 0 8 -2 16 Z"
          fill="#6A5A20" stroke={GOLD_D} strokeWidth={3} />
      </g>
      {label && <text x={0} y={54} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={800} fill={GOLD} opacity={0.9}>虎符</text>}
    </g>
  );

// 城门（城墙 → 城台 → 楼身 → 出檐 → 屋脊，五层结构）
const CityGate: React.FC<{ open: number }> = ({ open }) => {
  const W = 180;
  const cw = Math.max(W * (1 - open * 0.9), 3);
  return (
    <g>
      {/* 1 城墙体 + 垛口 */}
      {Array.from({ length: 24 }).map((_, i) => (
        <rect key={i} x={20 + i * 80} y={392} width={46} height={40} fill="#1A2440" />
      ))}
      <rect x={0} y={432} width={1920} height={648} fill="#141C34" />
      {/* 砖缝 */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={0} y1={470 + i * 76} x2={1920} y2={470 + i * 76} stroke="#0F1730" strokeWidth={2} opacity={0.6} />
      ))}
      {/* 2 城台（马面台基） */}
      <rect x={600} y={300} width={720} height={132} fill="#182240" stroke="#2A3A5F" strokeWidth={3} />
      <line x1={600} y1={344} x2={1320} y2={344} stroke="#0F1730" strokeWidth={2} opacity={0.7} />
      <line x1={600} y1={388} x2={1320} y2={388} stroke="#0F1730" strokeWidth={2} opacity={0.7} />
      {/* 3 楼身：柱 + 墙 + 窗 */}
      <rect x={646} y={186} width={628} height={114} fill="#1B2440" stroke="#2A3A5F" strokeWidth={3} />
      {[700, 790, 1130, 1220].map((x, i) => (
        <rect key={i} x={x} y={186} width={16} height={114} fill="#3A2C18" />
      ))}
      {[860, 960, 1060].map((x, i) => (
        <rect key={i} x={x - 30} y={212} width={60} height={62} rx={4} fill="#FFB84D" opacity={0.22 + 0.12 * Math.sin(i * 1.7 + 0.4)} />
      ))}
      {/* 4 额枋 + 出檐（翘角） */}
      <rect x={628} y={172} width={664} height={16} fill="#0E1526" stroke={GOLD_D} strokeWidth={2} />
      <path d="M 590 172 Q 600 150 646 146 L 1274 146 Q 1320 150 1330 172 L 1298 184 L 622 184 Z"
        fill="#0E1526" stroke={GOLD_D} strokeWidth={3} />
      <path d="M 640 146 Q 760 104 960 100 Q 1160 104 1280 146 Z" fill="#0E1526" stroke={GOLD_D} strokeWidth={3} />
      {/* 5 屋脊 + 鸱吻 */}
      <path d="M 900 100 L 960 78 L 1020 100" fill="none" stroke={GOLD_D} strokeWidth={5} strokeLinecap="round" />
      <path d="M 640 146 q -14 -18 4 -26" stroke={GOLD_D} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M 1280 146 q 14 -18 -4 -26" stroke={GOLD_D} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* 匾额：门洞正上方的城墙面 */}
      <rect x={868} y={470} width={184} height={60} rx={6} fill="#3A1C18" stroke={GOLD} strokeWidth={3} />
      <text x={960} y={514} textAnchor="middle" fontFamily={FONT} fontSize={36} fontWeight={900} fill={GOLD} letterSpacing={8}>开封</text>
      {/* 门洞 */}
      <path d="M 790 1080 L 790 640 Q 960 556 1130 640 L 1130 1080 Z" fill="#05070F" />
      {/* 左扇（铰链 x=790，向内开） */}
      <g>
        <rect x={790} y={640} width={cw} height={440} fill="#6A2A22" stroke="#3A1C18" strokeWidth={4} />
        {Array.from({ length: 12 }).map((_, i) => {
          const cx = 790 + (18 + (i % 3) * 50) * (cw / W);
          const cy = 700 + Math.floor(i / 3) * 76;
          return <circle key={i} cx={cx} cy={cy} r={7} fill={GOLD} opacity={0.9} />;
        })}
        <rect x={790} y={640} width={Math.max(cw * 0.12, 2)} height={440} fill="#4A1C16" opacity={0.85} />
      </g>
      {/* 右扇（铰链 x=1130） */}
      <g>
        <rect x={1130 - cw} y={640} width={cw} height={440} fill="#5A241C" stroke="#3A1C18" strokeWidth={4} />
        {Array.from({ length: 12 }).map((_, i) => {
          const cx = 1130 - (18 + (i % 3) * 50) * (cw / W);
          const cy = 700 + Math.floor(i / 3) * 76;
          return <circle key={i} cx={cx} cy={cy} r={7} fill={GOLD} opacity={0.9} />;
        })}
        <rect x={1130 - Math.max(cw * 0.12, 2)} y={640} width={Math.max(cw * 0.12, 2)} height={440} fill="#3E1610" opacity={0.85} />
      </g>
      {/* 台阶 + 路面 */}
      <rect x={760} y={1032} width={400} height={16} fill="#2A3450" />
      <rect x={790} y={1048} width={340} height={14} fill="#222B44" />
      <rect x={0} y={1062} width={1920} height={18} fill="#1A2238" />
      <ellipse cx={960} cy={1010} rx={150 * open} ry={36 * open} fill={GOLD} opacity={0.15 * open} />
    </g>
  );
};

// ---------- 地图 ----------
const MapBase: React.FC<{ x?: number; y?: number; w?: number; h?: number; label?: string }> =
  ({ x = 150, y = 110, w = 1620, h = 520, label }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={w} height={h} rx={18} fill="#0D1426" stroke="#2A3A5F" strokeWidth={3} />
      <path d={`M 40 ${h * 0.3} Q ${w * 0.3} ${h * 0.18} ${w * 0.55} ${h * 0.28} T ${w - 40} ${h * 0.24}`} stroke="#1C2A48" strokeWidth={26} fill="none" opacity={0.6} />
      {/* 黄河：在开封（南）与高平（北）之间 */}
      <path d={`M 30 ${h * 0.66} C ${w * 0.24} ${h * 0.58} ${w * 0.42} ${h * 0.72} ${w * 0.62} ${h * 0.64} S ${w * 0.86} ${h * 0.54} ${w - 20} ${h * 0.6}`}
        stroke="#39607C" strokeWidth={15} fill="none" strokeLinecap="round" opacity={0.9} />
      <text x={w * 0.12} y={h * 0.625} fontFamily={FONT} fontSize={23} fontWeight={800} fill="#6FA3C4" letterSpacing={5}>黄河</text>
      {label && <text x={w - 30} y={h - 22} textAnchor="end" fontFamily={FONT} fontSize={24} fill={GREY} letterSpacing={4}>{label}</text>}
    </g>
  );

const City: React.FC<{ x: number; y: number; name: string; color?: string; big?: boolean }> = ({ x, y, name, color = PAPER, big = false }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx={0} cy={0} r={big ? 12 : 7} fill={color} />
    <circle cx={0} cy={0} r={big ? 21 : 13} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
    <text x={0} y={big ? 42 : 30} textAnchor="middle" fontFamily={FONT} fontSize={big ? 28 : 23} fontWeight={800} fill={color}>{name}</text>
  </g>
);

const GrowArrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; color: string; w?: number }> =
  ({ x1, y1, x2, y2, p, color, w = 8 }) => {
    const cx = x1 + (x2 - x1) * p, cy = y1 + (y2 - y1) * p;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    return (
      <g>
        <line x1={x1} y1={y1} x2={cx} y2={cy} stroke={color} strokeWidth={w} strokeLinecap="round" />
        <path d={`M ${cx} ${cy} L ${cx - 20 * Math.cos(ang - 0.42)} ${cy - 20 * Math.sin(ang - 0.42)} L ${cx - 20 * Math.cos(ang + 0.42)} ${cy - 20 * Math.sin(ang + 0.42)} Z`} fill={color} />
      </g>
    );
  };

// ================= 幕 =================

// S0 起幅（黑场 → 星空 → 远城 → 纪年）
const S0: React.FC = () => {
  const f = useCurrentFrame();
  const fade = interpolate(f, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cityIn = interpolate(f, [18, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#020307', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={60} h={620} fade={fade} />
        {/* 远城剪影 */}
        <g opacity={cityIn * 0.9} transform={`translate(0 ${(1 - cityIn) * 30})`}>
          <rect x={0} y={760} width={1920} height={320} fill="#05070F" />
          {Array.from({ length: 26 }).map((_, i) => (
            <rect key={i} x={30 + i * 74} y={724} width={40} height={36} fill="#05070F" />
          ))}
          <path d="M 820 760 L 900 660 L 1020 660 L 1100 760 Z" fill="#04060C" />
          <path d="M 860 660 L 920 616 L 1000 616 L 1060 660 Z" fill="#04060C" />
          {/* 城头一盏灯 */}
          <g transform="translate(960 726)">
            <circle cx={0} cy={0} r={26} fill="#FFB84D" opacity={0.12 + 0.05 * Math.sin(f * 0.2)} />
            <rect x={-6} y={-8} width={12} height={16} rx={3} fill="#FFB84D" opacity={0.85} />
          </g>
        </g>
        <Ridge baseY={900} amp={22} color="#03050B" seed={4.4} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '42%', textAlign: 'center', ...up(f, 30, 26, 40) }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#8C97B5', letterSpacing: 14 }}>公元 960 年 · 正月初三</div>
        <div style={{ marginTop: 18, fontSize: 26, fontWeight: 700, color: '#5F6B88', letterSpacing: 10 }}>陈桥驿</div>
      </div>
    </AbsoluteFill>
  );
};

// S1 钩子
const S1: React.FC = () => {
  const f = useCurrentFrame();
  const nP = spring({ frame: f - 6, fps: 24, config: { damping: 12, stiffness: 110 } });
  const bands = interpolate(f, [40, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dim = interpolate(f, [156, 182], [1, 0.1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const robeP = spring({ frame: f - 168, fps: 24, config: { damping: 12, stiffness: 90 } });
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
          <text x={930} y={300} textAnchor="middle" fontFamily={FONT} fontSize={190} fontWeight={900} fill={PAPER} opacity={Math.min(nP, 1)}>53</text>
          <text x={1130} y={300} textAnchor="middle" fontFamily={FONT} fontSize={70} fontWeight={900} fill={PAPER} opacity={Math.min(nP, 1)}>年</text>
          <text x={960} y={368} textAnchor="middle" fontFamily={FONT} fontSize={40} fontWeight={800} fill={GREY} opacity={Math.min(nP, 1)} letterSpacing={6}>
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
            <text x={-30} y={-34} fontFamily={FONT} fontSize={26} fontWeight={800} fill={GOLD} letterSpacing={4}>五代 · 53 年</text>
          </g>
          <text x={960} y={640} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={VERM}
            opacity={interpolate(f, [100, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            最长的不过十年，最短的只有一年
          </text>
        </g>
        <g opacity={1 - dim}>
          <g transform={`translate(0 ${Math.sin(f * 0.12) * 14})`}>
            <g transform="translate(960 500) scale(0.6)">
              <g opacity={0.4 * Math.max(robeP, 0)}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <path key={i} d="M 0 -150 L 16 -330 L -16 -330 Z" fill={GOLD}
                    transform={`rotate(${i * 30}) scale(${0.72 + 0.28 * Math.sin(f * 0.1 + i * 0.9)})`} opacity={0.28} />
                ))}
              </g>
              <g transform={`scale(1 ${Math.max(robeP, 0.001)})`} opacity={Math.max(robeP, 0)}>
                <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
                <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
              </g>
            </g>
          </g>
        </g>
      </svg>
      {f >= 156 && (
        <Sub f={f} delay={158} lines={['公元 960 年正月初三，又一件黄袍', '披上了一个人的肩膀']} sub={['所有人都在赌：他还能撑几年？']} />
      )}
      {f >= 156 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 290, textAlign: 'center', ...up(f, 182, 16, 60) }}>
          <span style={{ fontSize: 62, fontWeight: 900, color: GOLD, letterSpacing: 14, textShadow: `0 0 30px ${GOLD}99` }}>赵匡胤</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// S2 乱世规则
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
        <Fire x={960} y={760} s={1.0} />
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
        <div style={{ ...up(f, 4, 16, 40), fontSize: 28, fontWeight: 800, color: GREY, letterSpacing: 8 }}>五十三年间，皇位更迭的唯一规则</div>
        <div style={{ position: 'relative', display: 'inline-block', marginTop: 28 }}>
          <span style={{ position: 'absolute', left: -76, top: -10, fontSize: 96, color: GOLD_D, fontWeight: 900, opacity: 0.5 * q1 }}>「</span>
          <span style={{ position: 'absolute', right: -76, bottom: -52, fontSize: 96, color: GOLD_D, fontWeight: 900, opacity: 0.5 * q2 }}>」</span>
          <div style={{ ...up(f, 40, 16, 60), opacity: q1, fontSize: 78, fontWeight: 900, color: PAPER, lineHeight: 1.3, textShadow: `0 0 30px ${VERM}88` }}>
            天子宁有种耶？
          </div>
          <div style={{ ...up(f, 62, 16, 60), opacity: q2, marginTop: 8, fontSize: 62, fontWeight: 900, color: PAPER, lineHeight: 1.3, letterSpacing: 3, textShadow: `0 0 30px ${VERM}66` }}>
            兵强马壮者为之尔
          </div>
        </div>
        <div style={{ ...up(f, 86, 14, 40), marginTop: 18, fontSize: 28, fontWeight: 700, color: GREY }}>—— 五代 · 安重荣</div>
      </div>
      <EraTag text="五代 · 907–960" />
      <Sub f={f} delay={118} lines={['皇帝，是当时的高危职业']} sub={['十三位君主死于非命：被弑、被杀、自焚、被掳']} />
    </AbsoluteFill>
  );
};

// S3 高平之战（地理相对正确 + 包围 + 救人）
const S3: React.FC = () => {
  const f = useCurrentFrame();
  const r1 = interpolate(f, [26, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const r2 = interpolate(f, [40, 86], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ring = interpolate(f, [92, 126], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const breakOut = interpolate(f, [126, 156], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rescue = interpolate(f, [168, 214], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const heroX = interpolate(f, [168, 214], [1500, 1000], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scatter = interpolate(f, [206, 240], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #241B36 0%, #171226 55%, #08060F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={180} />
        <g opacity={interpolate(f, [150, 170], [1, 0.22], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          <MapBase x={150} y={110} w={1620} h={520} label="高平之战 · 954 年" />
          {/* 图例 */}
          <g transform="translate(200 150)">
            {[{ c: JADE, t: '后周' }, { c: '#E08C86', t: '北汉' }, { c: '#B9A8D0', t: '辽' }].map((it, i) => (
              <g key={i} transform={`translate(0 ${i * 44})`}>
                <rect x={0} y={-16} width={16} height={16} rx={4} fill={it.c} />
                <text x={26} y={0} fontFamily={FONT} fontSize={24} fontWeight={800} fill={it.c}>{it.t}</text>
              </g>
            ))}
          </g>
          {/* 地理：开封在黄河以南，高平在黄河以北，太原西北，幽州东北 */}
          <City x={700} y={560} name="开封" color={JADE} />
          <City x={900} y={300} name="太原" color="#E08C86" />
          <City x={1150} y={420} name="高平" color={GOLD} big />
          <City x={1560} y={260} name="幽州" color="#B9A8D0" />
          {/* 三路进军 */}
          <GrowArrow x1={720} y1={536} x2={1120} y2={452} p={r1} color={JADE} />
          <GrowArrow x1={920} y1={322} x2={1130} y2={404} p={r2} color="#E08C86" />
          <GrowArrow x1={1530} y1={286} x2={1190} y2={410} p={r2} color="#B9A8D0" />
          {/* 包围圈 */}
          <g opacity={ring}>
            <circle cx={1150} cy={420} r={92} fill="none" stroke="#E08C86" strokeWidth={4} strokeDasharray="14 10" />
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + f * 0.02;
              return <circle key={i} cx={1150 + Math.cos(a) * 92} cy={420 + Math.sin(a) * 92} r={7} fill="#E08C86" />;
            })}
            <text x={1150} y={540} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill="#E08C86">北汉 + 辽 合围</text>
          </g>
          {/* 突围 */}
          <g opacity={breakOut}>
            <GrowArrow x1={1130} y1={444} x2={860} y2={530} p={breakOut} color={GOLD} w={10} />
            <text x={930} y={584} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={900} fill={GOLD}>赵匡胤率骑兵突围</text>
          </g>
        </g>
        {/* 救柴荣 */}
        <g opacity={interpolate(f, [160, 176], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          <rect x={0} y={650} width={1920} height={430} fill="#0A0E1C" />
          <Fire x={1640} y={1040} s={0.75} />
          <g transform="translate(980 940)">
            <Person x={0} y={0} s={1.15} role="general" />
            <text x={0} y={62} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill="#8FB8D8">柴荣</text>
          </g>
          {[[820, 900], [1150, 890], [860, 1000], [1120, 1005], [760, 950], [1200, 950]].map(([bx, by], i) => {
            const dx = (bx - 980) * scatter * 2.4;
            const rot = scatter * (i % 2 ? 1 : -1) * 70;
            return (
              <g key={i} transform={`translate(${bx + dx} ${by}) rotate(${rot})`} opacity={1 - scatter * 0.5}>
                <Person x={0} y={0} s={0.95} role="soldier" flip={i % 2 === 0} />
              </g>
            );
          })}
          <g transform={`translate(${heroX} 940) scale(${1 + 0.05 * Math.sin(f * 0.4)})`} opacity={rescue}>
            <Person x={0} y={0} s={1.2} role="general" armUp={0.25} />
            <text x={0} y={66} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill={GOLD}>赵匡胤</text>
          </g>
        </g>
      </svg>
      <EraTag text="显德元年 · 954" />
      <Sub f={f} delay={108} lines={['高平之战 · 他冲进包围圈救出柴荣']} sub={['后周 vs 北汉 + 辽，战场在泽州高平；这一战让他进入权力核心']} />
    </AbsoluteFill>
  );
};

// S4 柴荣病逝
const S4: React.FC = () => {
  const f = useCurrentFrame();
  const dim = interpolate(f, [40, 90], [0, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const candle = 0.45 + 0.55 * Math.abs(Math.sin(f * 0.18));
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0B1130 0%, #0D1330 55%, #0A0E20 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={40} h={300} />
        <circle cx={330} cy={170} r={50} fill="#E8E2C8" opacity={0.85 * (1 - dim)} />
        <circle cx={312} cy={158} r={40} fill="#0D1330" opacity={0.5} />
        <g transform="translate(1280 500) scale(1.05)">
          <path d="M -240 0 C -170 -52 -90 -66 0 -70 C 90 -66 170 -52 240 0 L 196 0 C 150 -34 76 -46 0 -46 C -76 -46 -150 -34 -196 0 Z" fill={INK1} />
          <rect x={-150} y={0} width={300} height={150} fill={INK2} />
          <path d="M -168 0 L 0 -34 L 168 0 Z" fill={INK1} />
          <rect x={-96} y={38} width={54} height={70} rx={6} fill="#FFB84D" opacity={0.15 + candle * 0.25} />
          <rect x={42} y={38} width={54} height={70} rx={6} fill="#FFB84D" opacity={0.12 + (1 - candle) * 0.2} />
          <rect x={-26} y={30} width={52} height={120} rx={6} fill="#060A16" />
        </g>
        <g transform={`translate(700 60) rotate(${Math.sin(f * 0.16) * 13})`}>
          <line x1={0} y1={0} x2={0} y2={110} stroke="#3A2C18" strokeWidth={4} />
          <rect x={-32} y={110} width={64} height={80} rx={10} fill="#5A2A24" stroke={GOLD_D} strokeWidth={3} />
          <rect x={-20} y={124} width={40} height={52} rx={6} fill="#FFB84D" opacity={0.45 + 0.35 * Math.abs(Math.sin(f * 0.3))} />
          <Fire x={0} y={176} s={0.26} />
        </g>
        <Person x={1060} y={800} s={0.72} role="child" />
        <text x={1060} y={862} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill={PAPER}>7 岁幼帝</text>
        <Person x={1270} y={800} s={1.02} role="official" />
        <text x={1270} y={862} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill={GREY}>托孤大臣</text>
        <g transform="translate(560 800)">
          <rect x={-6} y={-110} width={12} height={110} fill="#5A4428" />
          <rect x={-22} y={0} width={44} height={10} rx={4} fill="#5A4428" />
          <Fire x={0} y={-116} s={0.4} />
        </g>
        <Ridge baseY={880} amp={26} color={INK2} seed={2.1} />
        <rect x={0} y={0} width={1920} height={1080} fill="#04060D" opacity={dim} />
      </svg>
      <EraTag text="显德六年 · 959" />
      <Sub f={f} delay={46} lines={['柴荣病逝 · 只有 39 岁']} sub={['7 岁的儿子即位，主少国疑', '禁军将士，只认殿前都点检的脸']} />
    </AbsoluteFill>
  );
};

// S5 木牌
const S5: React.FC = () => {
  const f = useCurrentFrame();
  const plank = spring({ frame: f - 8, fps: 24, config: { damping: 12, stiffness: 90 } });
  const rot = interpolate(plank, [0, 1], [-9, -4]);
  const carve = interpolate(f, [36, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 32%, #171F3E 0%, #0B1024 55%, #05070F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={260} />
        <g transform={`translate(960 450) rotate(${rot + Math.sin(f * 0.07) * 1.6}) scale(${Math.max(plank, 0.001)})`}>
          <line x1={-120} y1={-170} x2={0} y2={-260} stroke="#3A2C18" strokeWidth={7} />
          <line x1={120} y1={-170} x2={0} y2={-260} stroke="#3A2C18" strokeWidth={7} />
          <rect x={-330} y={-170} width={660} height={300} rx={16} fill="#7A5C38" stroke="#54401F" strokeWidth={10} />
          <rect x={-310} y={-150} width={620} height={260} rx={10} fill="none" stroke="#63481F" strokeWidth={4} opacity={0.8} />
          <g opacity={carve}>
            <text x={2} y={-16} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={84} fontWeight={900} fill="#241708" letterSpacing={10}>点检作天子</text>
            <text x={0} y={-20} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={84} fontWeight={900} fill="#F5E2B8" letterSpacing={10} opacity={0.3}>点检作天子</text>
          </g>
        </g>
        <Ridge baseY={880} amp={22} color={INK2} seed={6.4} />
      </svg>
      <EraTag text="北伐途中" />
      <Sub f={f} delay={100} lines={['军中惊现一块木牌：点检作天子']} sub={['殿前都点检张永德随即被撤，接任的，叫赵匡胤']} />
    </AbsoluteFill>
  );
};

// S6 边关急报
const S6: React.FC = () => {
  const f = useCurrentFrame();
  const riderX = interpolate(f, [0, 84], [-260, 2180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const docP = spring({ frame: f - 92, fps: 24, config: { damping: 12, stiffness: 100 } });
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
            <circle key={i} cx={0} cy={-70 - ((f * 1.6 + i * 40) % 120)} r={16 + i * 6} fill="#6A5A70" opacity={0.26 - i * 0.06} />
          ))}
        </g>
        <Horse x={riderX} y={880} s={1.15} />
        <g transform={`translate(960 300) scale(${Math.max(docP, 0.001)})`} opacity={docP}>
          <rect x={-220} y={-120} width={440} height={240} rx={10} fill="#E8DCC0" stroke="#B8A47C" strokeWidth={4} />
          <path d="M -190 -70 h 380 M -190 -20 h 380 M -190 30 h 300 M -190 80 h 340" stroke="#8A7A5A" strokeWidth={5} />
          <circle cx={170} cy={86} r={30} fill={VERM} opacity={0.9} />
          <text x={170} y={96} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={900} fill={PAPER}>急</text>
        </g>
      </svg>
      <EraTag text="正月初一" />
      <Sub f={f} delay={92} lines={['边关急报：辽与北汉联军南下']} sub={['镇州、定州同日告警——消息真假，至今存疑']} />
    </AbsoluteFill>
  );
};

// S7 出征 · 驻扎陈桥 · 40 里（带移动标记）
const S7: React.FC = () => {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, 180], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const top = lerpC([46, 32, 74], [10, 15, 34], t);
  const mid = lerpC([186, 110, 58], [14, 21, 44], t);
  const sunY = 190 + t * 210;
  const route = interpolate(f, [36, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const marker = interpolate(f, [40, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const camp = interpolate(f, [120, 160], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 小地图：开封（左下）→ 陈桥驿（右上，东北方向）
  const mx0 = 60, my0 = 96, mx1 = 420, my1 = 34;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 58%, #0B0F22 100%)`, fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <g opacity={1 - t * 0.95}>
          <circle cx={1500} cy={sunY} r={88} fill="#FFC85F" opacity={0.2} />
          <circle cx={1500} cy={sunY} r={48} fill="#FFD98A" />
          <circle cx={1568} cy={sunY + 70} r={36} fill="#FFB85C" opacity={0.9} />
          <text x={1500} y={sunY + 150} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill="#FFE2A8" opacity={0.85}>天有二日 · 一日克一日</text>
        </g>
        <Stars n={30} h={360} />
        <Ridge baseY={700} amp={40} color={INK3} seed={2.6} shift={-f * 0.8} />
        <Ridge baseY={790} amp={34} color={INK2} seed={5.1} shift={-f * 1.6} />
        <rect x={0} y={860} width={1920} height={220} fill={INK1} />
        {/* 军营：帐篷 + 篝火 + 歇息士兵（不再有循环跳动的队伍） */}
        <g opacity={camp}>
          <Tent x={420} y={930} s={1.0} />
          <Tent x={620} y={950} s={0.85} />
          <Tent x={1500} y={940} s={0.95} />
          <Fire x={900} y={952} s={0.95} />
          <Fire x={1620} y={962} s={0.7} />
          <Person x={780} y={950} s={0.86} role="soldier" />
          <Person x={1040} y={955} s={0.84} role="soldier" flip />
          <Person x={1180} y={948} s={0.88} role="general" />
          <Horse x={1320} y={948} s={0.62} rider={false} />
        </g>
        {/* 距离小地图 */}
        <g opacity={interpolate(f, [40, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} transform="translate(110 560)">
          <rect x={-10} y={-46} width={520} height={210} rx={14} fill="rgba(8,12,24,0.85)" stroke="#2A3A5F" strokeWidth={2} />
          <City x={mx0} y={my0} name="开封" color={JADE} />
          <City x={mx1} y={my1} name="陈桥驿" color={GOLD} big />
          <path d={`M ${mx0 + 18} ${my0 - 12} L ${mx1 - 16} ${my1 + 14}`} stroke={GOLD} strokeWidth={4} strokeDasharray="10 10" opacity={0.7} />
          {/* 移动标记：从开封走向陈桥 */}
          <g transform={`translate(${mx0 + 18 + (mx1 - 34 - mx0) * marker} ${my0 - 12 + (my1 + 14 - my0 + 12) * marker})`}>
            <circle cx={0} cy={0} r={9} fill={GOLD} />
            <circle cx={0} cy={0} r={16} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.5} />
          </g>
          <text x={210} y={150} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill={PAPER}>40 里 · 一天的路（东北方向）</text>
        </g>
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
        {[[660, 870], [850, 900], [1080, 900], [1270, 865]].map(([x, y], i) => (
          <Person key={i} x={x} y={y} s={0.82} role={i % 2 ? 'official' : 'general'} />
        ))}
        <Fire x={960} y={890} s={1.05} />
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

// S9 黄袍加身（满屏万岁从士兵头顶冒出）
const S9: React.FC = () => {
  const f = useCurrentFrame();
  const dawnT = interpolate(f, [0, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const robeP = spring({ frame: f - 30, fps: 24, config: { damping: 12, stiffness: 90 } });
  const armP = interpolate(f, [60, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const crowd = [
    { x: 80, r: 'soldier' as Role }, { x: 170, r: 'soldier' as Role }, { x: 260, r: 'general' as Role },
    { x: 350, r: 'soldier' as Role }, { x: 440, r: 'soldier' as Role }, { x: 530, r: 'soldier' as Role },
    { x: 620, r: 'soldier' as Role }, { x: 710, r: 'general' as Role }, { x: 1210, r: 'general' as Role },
    { x: 1300, r: 'soldier' as Role }, { x: 1390, r: 'soldier' as Role }, { x: 1480, r: 'soldier' as Role },
    { x: 1570, r: 'general' as Role }, { x: 1660, r: 'soldier' as Role }, { x: 1750, r: 'soldier' as Role },
    { x: 1840, r: 'soldier' as Role },
  ];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${lerpC([16, 24, 56], [44, 56, 104], dawnT)} 0%, ${lerpC([22, 28, 54], [180, 132, 66], dawnT)} 62%, #0B0F22 100%)`, fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={20} h={200} />
        <Ridge baseY={880} amp={24} color={INK1} seed={3.3} />
        {/* 后排（更小更暗） */}
        {crowd.filter((_, i) => i % 2 === 0).map((p, i) => (
          <g key={'b' + i} opacity={0.75}>
            <Person x={p.x + 40} y={852} s={0.8} role={p.r} armUp={0.85} />
          </g>
        ))}
        {/* 前排（振臂，随节拍上下） */}
        {crowd.filter((_, i) => i % 2 === 1).map((p, i) => (
          <Person key={'f' + i} x={p.x} y={880} s={0.92} role={p.r} armUp={0.9 + 0.09 * Math.sin(f * 0.42 + i)} />
        ))}
        {/* 主角：形象与前面一致，只多一层披在肩上的黄袍 */}
        <g transform="translate(960 720) scale(1.4)">
          <Person x={0} y={0} s={1} role="emperor" armUp={armP} />
          <g opacity={Math.max(robeP, 0)}>
            <path d="M -31 -68 Q 0 -52 31 -68 L 37 18 Q 0 40 -37 18 Z" fill={GOLD} opacity={0.62} />
            <path d="M -31 -68 Q 0 -54 31 -68" stroke={GOLD_D} strokeWidth={3} fill="none" opacity={0.9} />
            <path d="M -24 -60 L -34 6 M 24 -60 L 34 6" stroke={GOLD_D} strokeWidth={2} opacity={0.5} />
          </g>
        </g>
        {/* 万岁：三波，从士兵头顶冒出、上浮、淡出（填满整幕，不留空镜） */}
        {[0, 1, 2].map((wave) =>
          Array.from({ length: 14 }).map((_, i) => {
            const sx = 100 + ((i * 149 + wave * 61) % 1720);
            const st = 56 + wave * 62 + (i % 7) * 7;
            const p = interpolate(f, [st, st + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const rise = interpolate(f, [st, st + 50], [0, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const fade = interpolate(f, [st + 36, st + 64], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <text key={`${wave}-${i}`} x={sx} y={792 - rise} textAnchor="middle" fontFamily={FONT}
                fontSize={36 + (i % 3) * 8} fontWeight={900} fill={GOLD}
                opacity={p * fade} transform={`scale(${0.8 + 0.3 * p})`} style={{ transformOrigin: `${sx}px ${792 - rise}px` }}>
                万岁
              </text>
            );
          })
        )}
      </svg>
      <EraTag text="正月初三 · 黎明" />
      <Sub f={f} delay={96} lines={['天亮了 · 黄袍加身']} sub={['将士山呼万岁，他"被迫"受了这件袍子']} />
    </AbsoluteFill>
  );
};

// S10 回师开封
const S10: React.FC = () => {
  const f = useCurrentFrame();
  const open = interpolate(f, [24, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chips = ['不犯太后幼主', '不凌公卿', '不掠市府'];
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #2A3458 0%, #46404F 55%, #5E4C3C 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <CityGate open={open} />
        {/* 队伍：连续自右沿地面入城（每名士兵独立循环，从画面外重新进场，不会原地跳动） */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const p = ((f * 0.85 + i * 37) % 300) / 300;
          const x = 1860 - p * 900;
          const sc = 1 - p * 0.42;
          const vis = p > 0.02 ? 1 : 0;
          return (
            <g key={i} transform={`translate(${x} ${1052}) scale(${sc})`} opacity={vis * (1 - Math.max(0, (p - 0.9) / 0.1))}>
              <Person x={0} y={0} s={1} role="soldier" walk={i * 0.8} flip />
            </g>
          );
        })}
      </svg>
      <EraTag text="初三 · 回师" />
      {/* 约法三章：移到右侧竖排，避开城楼与匾额 */}
      <div style={{ position: 'absolute', right: 70, top: 180, width: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {chips.map((c, i) => {
          const p = spring({ frame: f - 90 - i * 10, fps: 24, config: { damping: 12, stiffness: 110 } });
          return (
            <div key={i} style={{
              opacity: p, transform: `translateX(${(1 - p) * 60}px)`,
              background: 'rgba(8,11,22,0.85)', border: `3px solid ${GOLD_D}`, borderRadius: 16,
              padding: '16px 26px', fontSize: 30, fontWeight: 900, color: GOLD, textAlign: 'center',
            }}>{c}</div>
          );
        })}
        <div style={{ opacity: interpolate(f, [110, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), fontSize: 24, color: '#D9D3C2', fontWeight: 700, textAlign: 'center', lineHeight: 1.5 }}>
          入城前立的规矩<br />也是开门的前提
        </div>
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
        <div style={{ ...up(f, 2, 16, 50), fontSize: 52, fontWeight: 900, color: PAPER, textShadow: `0 0 24px ${GOLD}88` }}>故事讲完了。四个问题，一个个拆</div>
      </div>
      <div style={{ position: 'absolute', top: '32%', left: 380, right: 380 }}>
        {qs.map((q, i) => {
          const p = spring({ frame: f - 14 - i * 12, fps: 24, config: { damping: 11, stiffness: 130 } });
          const pulse = 1 + 0.07 * Math.max(0, Math.sin(f * 0.26 - i * 0.9));
          return (
            <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * 90}px) scale(${pulse})`, display: 'flex', alignItems: 'center', marginBottom: 24, transformOrigin: '0% 50%' }}>
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

// S12 条件一 · 位置
const S12: React.FC = () => {
  const f = useCurrentFrame();
  const founders = [
    { n: '朱温', d: '后梁', y: '907' }, { n: '李存勖', d: '后唐', y: '923' }, { n: '石敬瑭', d: '后晋', y: '936' },
    { n: '刘知远', d: '后汉', y: '947' }, { n: '郭威', d: '后周', y: '951' },
  ];
  const tokenP = spring({ frame: f - 200, fps: 24, config: { damping: 11, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 34% 30%, #15203E 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={560} />
        {founders.map((e, i) => {
          const p = spring({ frame: f - 10 - i * 5, fps: 24, config: { damping: 10, stiffness: 200 } });
          return (
            <g key={i} opacity={p} transform={`translate(${190 + i * 320} 400) scale(${Math.max(p, 0.001)})`}>
              <Person x={0} y={0} s={1.05} role="emperor" />
              <text x={0} y={72} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={900} fill={PAPER}>{e.n}</text>
              <text x={0} y={108} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={800} fill={GREY}>{e.d} · {e.y}</text>
            </g>
          );
        })}
        {/* 禁军阵列：五帝一出现完就接上，不留空镜 */}
        <g opacity={interpolate(f, [52, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Person key={i} x={430 + i * 120} y={880} s={0.92} role="soldier" walk={i * 0.6} />
          ))}
        </g>
        {/* 点检印：独立位置，不压任何人物 */}
        <g opacity={interpolate(f, [200, 232], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} transform="translate(1720 300)">
          <g transform={`rotate(${-9 * (1 - Math.min(tokenP, 1))}) scale(${Math.max(tokenP, 0.001)})`}>
            <rect x={-60} y={-60} width={120} height={120} rx={12} fill={VERM} opacity={0.92} />
            <rect x={-48} y={-48} width={96} height={96} rx={8} fill="none" stroke={PAPER} strokeWidth={5} />
            <text x={0} y={6} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={40} fontWeight={900} fill={PAPER}>点检</text>
          </g>
          <text x={0} y={94} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={900} fill={PAPER}>殿前都点检</text>
        </g>
        {/* 虎符：与点检印分置 */}
        <g transform={`translate(1700 640) scale(${Math.max(tokenP, 0.001)})`} opacity={tokenP}>
          <TigerTally x={0} y={0} s={1.1} split={0.35} />
        </g>
      </svg>
      <ChapterTag text="条件一 · 位置" />
      <Sub f={f} delay={160} lines={['五代的皇位，来自兵权']} sub={['五位开国皇帝，全是握兵的军人；而赵匡胤，正握着禁军最高军职']} />
    </AbsoluteFill>
  );
};

// S13 钥匙（蒙版插入，无转动）
const S13: React.FC = () => {
  const f = useCurrentFrame();
  const insert = interpolate(f, [16, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowP = interpolate(f, [74, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const keyX = -320 + insert * 320; // 匙尖从 -320 移到 0（锁孔中心）
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(100% 90% at 50% 40%, #141C38 0%, #0A0F22 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* 锁体（带孔）作为蒙版：钥匙只在孔洞处可见 */}
          <mask id="lockMask">
            <rect x={-400} y={-400} width={800} height={800} fill="white" />
            <circle cx={0} cy={-18} r={22} fill="black" />
            <path d="M -10 0 L 10 0 L 7 48 L -7 48 Z" fill="black" />
          </mask>
        </defs>
        <Stars n={26} h={520} />
        <g transform="translate(960 380)">
          {/* 锁盘底 */}
          <circle cx={0} cy={0} r={170} fill="#1A2338" stroke="#3A4A6E" strokeWidth={8} />
          <circle cx={0} cy={0} r={140} fill="#0E1628" stroke="#2A3A5F" strokeWidth={3} />
          {/* 钥匙（先画，会被锁体遮住进入部分） */}
          <g transform={`translate(${keyX} -18)`}>
            <circle cx={-172} cy={0} r={22} fill="none" stroke={GOLD} strokeWidth={10} />
            <rect x={-150} y={-7} width={150} height={14} rx={4} fill={GOLD} />
            <rect x={-38} y={6} width={16} height={22} fill={GOLD} />
            <rect x={-70} y={6} width={14} height={18} fill={GOLD} />
          </g>
          {/* 锁体面（蒙版：只在锁孔处露出钥匙） */}
          <g mask="url(#lockMask)">
            <circle cx={0} cy={0} r={140} fill="#0E1628" />
          </g>
          {/* 锁孔描边 */}
          <circle cx={0} cy={-18} r={22} fill="none" stroke="#2A3A5F" strokeWidth={3} />
          <path d="M -10 0 L 10 0 L 7 48 L -7 48 Z" fill="none" stroke="#2A3A5F" strokeWidth={3} />
          {/* 开锁光 */}
          <circle cx={0} cy={0} r={190 + glowP * 40} fill="none" stroke={GOLD} strokeWidth={3} opacity={glowP * 0.7} />
          <circle cx={0} cy={0} r={140} fill={GOLD} opacity={glowP * 0.14} />
        </g>
      </svg>
      <ChapterTag text="条件一 · 最后一步" />
      <Sub f={f} delay={56} lines={['钥匙已经插在锁上']} sub={['不是胆子大，是位置对——只差有人去拧这一下']} />
    </AbsoluteFill>
  );
};

// S14 人望（前后遮挡排序）
const S14: React.FC = () => {
  const f = useCurrentFrame();
  const rot = f * 1.15;
  const names = ['石守信', '王审琦', '李继勋', '杨光义', '刘庆义', '刘守忠', '韩重赟', '王政忠', '刘延让'];
  const R = 380;
  const people = names.map((n, i) => {
    const a = (i / names.length) * Math.PI * 2 + (rot * Math.PI) / 180;
    return { n, a, x: Math.cos(a) * R, y: Math.sin(a) * R * 0.42, front: Math.sin(a) > 0, i };
  });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 44%, #15203E 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={620} />
        <g transform="translate(960 400)">
          <g transform={`rotate(${rot * 0.6})`} opacity={0.45}>
            <circle cx={0} cy={0} r={430} fill="none" stroke={GOLD_D} strokeWidth={3} strokeDasharray="26 22" />
          </g>
          {/* 后排（在赵匡胤之后绘制 → 被遮住） */}
          {people.filter((p) => !p.front).map((p) => {
            const sp = spring({ frame: f - 8 - p.i * 4, fps: 24, config: { damping: 9, stiffness: 220 } });
            return (
              <g key={p.n} transform={`translate(${p.x} ${p.y}) scale(${Math.max(sp, 0.001)})`} opacity={sp}>
                <Person x={0} y={0} s={0.66} role="general" />
                <text x={0} y={46} textAnchor="middle" fontFamily={FONT} fontSize={23} fontWeight={800} fill={PAPER}>{p.n}</text>
              </g>
            );
          })}
          {/* 中心赵匡胤 */}
          <Person x={0} y={30} s={0.98} role="emperor" />
          <text x={0} y={-104} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={900} fill={GOLD}>赵匡胤</text>
          {/* 前排（在赵匡胤之后绘制 → 遮住他） */}
          {people.filter((p) => p.front).map((p) => {
            const sp = spring({ frame: f - 8 - p.i * 4, fps: 24, config: { damping: 9, stiffness: 220 } });
            return (
              <g key={p.n} transform={`translate(${p.x} ${p.y}) scale(${Math.max(sp, 0.001)})`} opacity={sp}>
                <Person x={0} y={0} s={0.7} role="general" />
                <text x={0} y={48} textAnchor="middle" fontFamily={FONT} fontSize={23} fontWeight={800} fill={PAPER}>{p.n}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <ChapterTag text="条件二 · 人望" />
      <Sub f={f} delay={40} lines={['义社十兄弟：他，和九个军中兄弟']} sub={['兵变当晚，京城内外防务的关键位置，坐的全是自己人']} />
    </AbsoluteFill>
  );
};

// S15 时机（龙椅 + 幼帝居中 + 太后 + 闪动群臣）
const S15: React.FC = () => {
  const f = useCurrentFrame();
  const throne = interpolate(f, [16, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flick = (i: number) => 0.55 + 0.45 * Math.abs(Math.sin(f * 0.12 + i * 1.3));
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 40%, #131A32 0%, #0A0F22 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={380} />
        {/* 宫灯 */}
        <g transform={`translate(560 60) rotate(${Math.sin(f * 0.16) * 13})`}>
          <line x1={0} y1={0} x2={0} y2={110} stroke="#3A2C18" strokeWidth={4} />
          <rect x={-32} y={110} width={64} height={80} rx={10} fill="#5A2A24" stroke={GOLD_D} strokeWidth={3} />
          <rect x={-20} y={124} width={40} height={52} rx={6} fill="#FFB84D" opacity={0.45 + 0.35 * Math.abs(Math.sin(f * 0.3))} />
        </g>
        <g transform={`translate(960 700) scale(${0.9 + throne * 0.1})`} opacity={throne}>
          {/* 台基 */}
          <rect x={-300} y={150} width={600} height={26} fill="#1A2338" />
          <rect x={-260} y={124} width={520} height={26} fill="#1E2840" />
          {/* 龙椅：靠背 + 扶手 + 座 */}
          <path d="M -150 124 L -150 -120 Q -150 -190 0 -200 Q 150 -190 150 -120 L 150 124 Z" fill="#3A1C18" stroke={GOLD_D} strokeWidth={5} />
          {/* 靠背龙纹 */}
          <path d="M -90 -60 q 30 -50 90 -56 q 60 6 90 56" stroke={GOLD} strokeWidth={4} fill="none" opacity={0.9} />
          <circle cx={0} cy={-150} r={26} fill="none" stroke={GOLD} strokeWidth={4} />
          <path d="M -18 -150 q 18 -22 36 0 q -18 22 -36 0" stroke={GOLD} strokeWidth={3} fill="none" />
          {/* 扶手 */}
          <path d="M -150 -40 L -190 -40 L -190 30" stroke={GOLD_D} strokeWidth={10} fill="none" strokeLinecap="round" />
          <path d="M 150 -40 L 190 -40 L 190 30" stroke={GOLD_D} strokeWidth={10} fill="none" strokeLinecap="round" />
          {/* 座面 */}
          <rect x={-120} y={-30} width={240} height={34} rx={8} fill="#8A1F1A" stroke={GOLD_D} strokeWidth={4} />
          <rect x={-120} y={4} width={240} height={120} fill="#2A1410" stroke={GOLD_D} strokeWidth={3} />
          {/* 幼帝：坐姿（短袍、垂腿、双髻、双手扶膝） */}
          <g transform="translate(0 -30)">
            <path d="M -24 4 L 24 4 L 20 44 L -20 44 Z" fill="#8A4A5A" />
            <path d="M -20 4 L 0 20 L 20 4 L 16 -6 L 0 6 L -16 -6 Z" fill="#6A3444" />
            <path d="M -16 44 L -30 76 L -8 76 L -2 50 L 2 50 L 8 76 L 30 76 L 16 44 Z" fill="#6A3444" />
            <rect x={-20} y={26} width={40} height={8} fill="#C9A227" />
            <path d="M -18 8 L -34 34 M 18 8 L 34 34" stroke="#8A4A5A" strokeWidth={9} strokeLinecap="round" />
            <circle cx={-34} cy={34} r={5.5} fill="#EFD3AE" />
            <circle cx={34} cy={34} r={5.5} fill="#EFD3AE" />
            <circle cx={0} cy={-18} r={16} fill="#EFD3AE" />
            <circle cx={-9} cy={-28} r={5.5} fill="#1A1A22" />
            <circle cx={9} cy={-28} r={5.5} fill="#1A1A22" />
            <circle cx={-4} cy={-16} r={1.6} fill="#2A2010" />
            <circle cx={4} cy={-16} r={1.6} fill="#2A2010" />
          </g>
        </g>
        {/* 太后在侧 */}
        <Person x={700} y={860} s={0.95} role="empress" />
        <text x={700} y={922} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={800} fill={PAPER}>太后</text>
        {/* 文武大臣：左右各三个，忽明忽暗 */}
        {[220, 340, 460, 1460, 1580, 1700].map((x, i) => (
          <g key={i} opacity={flick(i)}>
            <Person x={x} y={880} s={0.88} role="official" />
          </g>
        ))}
        <text x={960} y={1000} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={900} fill={GOLD} opacity={0.85}>龙椅 · 无人坐得稳</text>
        <Ridge baseY={1020} amp={16} color={INK2} seed={1.4} />
      </svg>
      <ChapterTag text="条件三 · 时机" />
      <Sub f={f} delay={40} lines={['主少国疑 · 权力出现真空']} sub={['39 岁的雄主骤逝，7 岁的孩子坐上龙椅——五代人知道，这种局面只有一种结局']} />
    </AbsoluteFill>
  );
};

// S16 窗口（窗棂优化）
const S16: React.FC = () => {
  const f = useCurrentFrame();
  const open = interpolate(f, [18, 76], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const step = interpolate(f, [76, 126], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cw = 130 * (1 - open * 0.92);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(100% 90% at 50% 40%, #16203C 0%, #0A0F22 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={22} h={420} />
        <g transform="translate(960 380)">
          {/* 窗框 */}
          <rect x={-280} y={-240} width={560} height={480} rx={8} fill="#0A0F22" stroke="#3A4A6E" strokeWidth={12} />
          <rect x={-258} y={-218} width={516} height={436} fill="#070B16" />
          {/* 窗外月色与光 */}
          <circle cx={40} cy={-90} r={54} fill="#E8E2C8" opacity={0.5 + 0.3 * open} />
          <rect x={-258} y={-218} width={516 * open} height={436} fill="#FFD98A" opacity={0.13 * open} />
          <path d={`M -258 -218 L ${-258 + 516 * open} -218 L 40 218 L -120 218 Z`} fill="#FFE8A3" opacity={0.09 * open} />
          {/* 窗棂（左右两扇，随开启收窄） */}
          <g>
            <rect x={-258} y={-218} width={Math.max(cw, 2)} height={436} fill="#2A3450" stroke="#3A4A6E" strokeWidth={4} />
            {[0, 1, 2, 3].map((k) => (
              <line key={k} x1={-258} y1={-160 + k * 100} x2={-258 + Math.max(cw, 2)} y2={-160 + k * 100} stroke="#1A2440" strokeWidth={4} />
            ))}
            <line x1={-258 + Math.max(cw, 2) * 0.5} y1={-218} x2={-258 + Math.max(cw, 2) * 0.5} y2={218} stroke="#1A2440" strokeWidth={4} />
          </g>
          <g>
            <rect x={258 - Math.max(cw, 2)} y={-218} width={Math.max(cw, 2)} height={436} fill="#2A3450" stroke="#3A4A6E" strokeWidth={4} />
            {[0, 1, 2, 3].map((k) => (
              <line key={k} x1={258 - Math.max(cw, 2)} y1={-160 + k * 100} x2={258} y2={-160 + k * 100} stroke="#1A2440" strokeWidth={4} />
            ))}
            <line x1={258 - Math.max(cw, 2) * 0.5} y1={-218} x2={258 - Math.max(cw, 2) * 0.5} y2={218} stroke="#1A2440" strokeWidth={4} />
          </g>
          {/* 走出去的人 */}
          <g transform={`translate(0 ${150 - step * 140}) scale(${0.94 - step * 0.26})`} opacity={0.92}>
            <Person x={0} y={0} s={1} role="general" walk={step > 0.05 ? 1 : undefined} />
          </g>
          <text x={0} y={310} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={800} fill={GOLD} opacity={0.85}>窗口打开的时间，只有这一夜</text>
        </g>
      </svg>
      <ChapterTag text="条件三 · 窗口" />
      <Sub f={f} delay={56} lines={['一纸急报，给了他合法出城的窗口']} sub={['带着禁军主力离开京城——兵变最难的一步，被这道边警解决了']} />
    </AbsoluteFill>
  );
};

// S17 五帝褪色示死 → 三条措施覆盖
const S17: React.FC = () => {
  const f = useCurrentFrame();
  const list = [
    { d: '梁', n: '朱温', how: '死于亲子之手' },
    { d: '唐', n: '李存勖', how: '乱兵所杀' },
    { d: '唐', n: '李从珂', how: '自焚而亡' },
    { d: '晋', n: '石重贵', how: '被掳北上' },
    { d: '汉', n: '刘承祐', how: '逃亡被杀' },
  ];
  const dimOld = interpolate(f, [170, 200], [1, 0.35], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panels = [
    { t: '入城约法', d: '不犯太后幼主 · 不凌公卿 · 不掠市府' },
    { t: '优待柴氏', d: '恭帝封郑王、得以善终；柴氏世代受宋室礼遇' },
    { t: '文臣不换血', d: '后周旧臣原班留用，统治机器照常运转' },
  ];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 36%, #2A1420 0%, #120A16 55%, #06040A 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={300} />
        <g opacity={dimOld}>
          {list.map((e, i) => {
            const st = 8 + i * 22;
            const rise = interpolate(f, [st, st + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const die = interpolate(f, [st + 20, st + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const x = 300 + i * 330;
            return (
              <g key={i}>
                <g opacity={rise} transform={`translate(${x} 740)`}>
                  <Person x={0} y={0} s={1.0} role="emperor" grey={die} bow={die * 0.25} />
                </g>
                <g opacity={rise} transform={`translate(${x} 790)`}>
                  <text x={0} y={0} textAnchor="middle" fontFamily={FONT} fontSize={27} fontWeight={900}
                    fill={die > 0.5 ? GREY : PAPER}>{e.d} · {e.n}</text>
                  {/* 死因：随死亡同时出现，放大到 26px 保证可读 */}
                  <text x={0} y={38} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800}
                    fill={RED} opacity={die}>{e.how}</text>
                  <line x1={-100} y1={-30} x2={100} y2={28} stroke={RED} strokeWidth={7} strokeLinecap="round" opacity={die * 0.85} />
                </g>
              </g>
            );
          })}
        </g>
        {/* 三条措施：横向大幅铺开，压住前朝 */}
        {panels.map((p, i) => {
          const st = 156 + i * 46;
          const slide = spring({ frame: f - st, fps: 24, config: { damping: 13, stiffness: 90 } });
          const y = 250 + i * 196;
          return (
            <g key={i} transform={`translate(${(1 - slide) * -1000} 0)`} opacity={slide}>
              <rect x={230} y={y} width={1460} height={168} rx={18} fill="rgba(12,18,34,0.95)" stroke={GOLD} strokeWidth={3} />
              <rect x={230} y={y} width={14} height={168} fill={GOLD} />
              <text x={286} y={y + 72} fontFamily={FONT} fontSize={42} fontWeight={900} fill={GOLD}>{p.t}</text>
              <text x={286} y={y + 124} fontFamily={FONT} fontSize={29} fontWeight={700} fill={PAPER}>{p.d}</text>
              <text x={1640} y={y + 100} textAnchor="end" fontFamily={FONT} fontSize={30} fontWeight={900} fill={VERM}>{['一', '二', '三'][i]}</text>
            </g>
          );
        })}
      </svg>
      <ChapterTag text="特殊性一 · 不杀" />
      <Sub f={f} delay={180} lines={['他用克制，盖住了前面五十年的循环']} sub={['不杀、不清算、不换血——新朝第一次没有从血里开始']} />
    </AbsoluteFill>
  );
};

// S18 酒宴（皇帝上位，将军下位，举杯）
const S18: React.FC = () => {
  const f = useCurrentFrame();
  const cupRaise = interpolate(f, [70, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tokenP = interpolate(f, [140, 180], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(100% 90% at 50% 34%, #241C30 0%, #100C1A 58%, #05040A 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={20} h={260} />
        {/* 屏风 */}
        <rect x={700} y={330} width={520} height={210} rx={8} fill="#1A1424" stroke={GOLD_D} strokeWidth={3} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={700 + i * 173} y1={330} x2={700 + i * 173} y2={540} stroke="#2A2038" strokeWidth={3} />
        ))}
        <path d="M 760 400 q 80 -60 160 0 q 80 60 160 0" stroke={GOLD_D} strokeWidth={2} fill="none" opacity={0.5} />
        {/* 地毯 */}
        <ellipse cx={960} cy={960} rx={720} ry={90} fill="#3A1420" opacity={0.55} />
        {/* 上位：御案 + 皇帝举杯 */}
        <rect x={700} y={560} width={520} height={28} rx={6} fill="#4A3820" stroke="#3A2C18" strokeWidth={3} />
        <rect x={740} y={588} width={440} height={14} fill="#3A2C18" />
        <g transform="translate(960 560)">
          <Person x={0} y={0} s={1.12} role="emperor" armUp={cupRaise * 0.9} />
        </g>
        {/* 御案陈设：酒壶、酒樽、果盘、烛台 */}
        <g transform="translate(830 552)">
          <path d="M -16 0 L 16 0 L 12 34 L -12 34 Z" fill="#C9B06A" stroke={GOLD_D} strokeWidth={3} />
          <path d="M 14 8 q 14 6 0 18" stroke={GOLD_D} strokeWidth={3} fill="none" />
          <path d="M -8 -10 q 8 -8 16 0" stroke={GOLD_D} strokeWidth={3} fill="none" />
        </g>
        <g transform="translate(1090 552)">
          <ellipse cx={0} cy={10} rx={38} ry={11} fill="#2A2038" stroke="#4A3A5A" strokeWidth={2} />
          <ellipse cx={0} cy={6} rx={28} ry={8} fill="#8A5A3A" />
          <circle cx={-10} cy={2} r={5} fill="#C9A227" />
          <circle cx={6} cy={0} r={5} fill="#A83232" />
        </g>
        <Steam x={830} y={540} s={0.7} n={3} />
        {/* 烛台一对 */}
        {[640, 1280].map((x, i) => (
          <g key={i} transform={`translate(${x} 600)`}>
            <rect x={-4} y={-60} width={8} height={60} fill="#5A4428" />
            <rect x={-16} y={0} width={32} height={8} rx={3} fill="#5A4428" />
            <Fire x={0} y={-64} s={0.24} />
          </g>
        ))}
        {/* 下位：四将军两列坐席（案上有菜） */}
        {[{ x: 300, y: 830 }, { x: 500, y: 862 }, { x: 1420, y: 862 }, { x: 1620, y: 830 }].map((p, i) => (
          <g key={i}>
            <rect x={p.x - 140} y={p.y + 44} width={280} height={20} rx={6} fill="#4A3820" stroke="#3A2C18" strokeWidth={2} />
            <Person x={p.x} y={p.y} s={0.94} role="general" flip={i > 1} />
            {/* 案上：三碟菜 + 酒杯 + 筷 */}
            {[-88, -20, 56].map((dx, k) => (
              <g key={k}>
                <ellipse cx={p.x + dx} cy={p.y + 38} rx={26} ry={9} fill="#2A2038" stroke="#4A3A5A" strokeWidth={2} />
                <ellipse cx={p.x + dx} cy={p.y + 35} rx={18} ry={6} fill={['#8A5A3A', '#5A6A4A', '#A83232'][k]} />
              </g>
            ))}
            <ellipse cx={p.x + 108} cy={p.y + 36} rx={12} ry={14} fill="#C9B06A" stroke={GOLD_D} strokeWidth={2} />
            <line x1={p.x - 130} y1={p.y + 30} x2={p.x - 96} y2={p.y + 26} stroke="#D8D2C2" strokeWidth={3} />
            <line x1={p.x - 130} y1={p.y + 34} x2={p.x - 96} y2={p.y + 30} stroke="#D8D2C2" strokeWidth={3} />
          </g>
        ))}
        {/* 侍者 */}
        <Person x={760} y={880} s={0.78} role="civilian" />
        <Person x={1160} y={880} s={0.78} role="civilian" flip />
        {/* 兵符交接 */}
        <g transform={`translate(1200 780) translate(0 ${(1 - tokenP) * 40})`} opacity={tokenP}>
          <TigerTally x={0} y={0} s={0.9} split={0.5} />
        </g>
        <text x={960} y={960} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={800} fill={GREY} opacity={0.85}>
          皇帝在上，将军在下 —— 一杯酒，换回兵权
        </text>
      </svg>
      <ChapterTag text="特殊性二 · 杯酒" />
      <Sub f={f} delay={60} lines={['建隆二年，一场酒席']} sub={['请老兄弟们交出兵权、回家享福——没有杀一个人']} />
    </AbsoluteFill>
  );
};

// S19 立制度
const S19: React.FC = () => {
  const f = useCurrentFrame();
  const items = [{ k: '收精兵', st: 16 }, { k: '制钱谷', st: 92 }, { k: '文官治国', st: 168 }];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 36%, #14203C 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={24} h={560} />
        {items.map((it, i) => {
          const p = spring({ frame: f - it.st, fps: 24, config: { damping: 12, stiffness: 110 } });
          const x = 200 + i * 540;
          return (
            <g key={i} transform={`translate(${x} 290)`} opacity={p}>
              <rect x={0} y={0} width={440} height={340} rx={18} fill="rgba(10,16,32,0.9)" stroke={`${GOLD_D}66`} strokeWidth={3} />
              {i === 0 && (
                <g transform="translate(220 170)">
                  <rect x={96} y={-56} width={110} height={112} rx={10} fill="#1A2338" stroke={GOLD} strokeWidth={3} />
                  <text x={151} y={6} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={900} fill={GOLD}>禁军</text>
                  {[0, 1, 2].map((k) => {
                    const prog = ((f * 0.45 + k * 0.33) % 1);
                    const px = -170 + prog * 250;
                    return (
                      <g key={k} transform={`translate(${px} ${40 - k * 8}) scale(0.55)`}>
                        <Person x={0} y={0} s={1} role="soldier" walk={k * 0.7} flip={false} />
                      </g>
                    );
                  })}
                  <path d="M -180 70 L 90 70" stroke={GOLD} strokeWidth={3} strokeDasharray="10 10" opacity={0.7} />
                </g>
              )}
              {i === 1 && (
                <g transform="translate(220 170)">
                  {[0, 1, 2].map((lane) => {
                    const cy = -60 + lane * 50;
                    const cx = -170 + ((f * 6.5 + lane * 100) % 250);
                    return (
                      <g key={lane}>
                        <line x1={-180} y1={cy} x2={110} y2={cy} stroke="#2A3A5F" strokeWidth={2} strokeDasharray="8 10" opacity={0.6} />
                        <g transform={`translate(${cx} ${cy})`}>
                          <circle cx={0} cy={0} r={18} fill="#C9B06A" stroke={GOLD_D} strokeWidth={3} />
                          <rect x={-6} y={-6} width={12} height={12} fill="#0A1020" />
                        </g>
                      </g>
                    );
                  })}
                  <rect x={110} y={-80} width={84} height={120} rx={8} fill="#1A2338" stroke={GOLD} strokeWidth={3} />
                  <text x={152} y={-6} textAnchor="middle" fontFamily={FONT} fontSize={20} fontWeight={900} fill={GOLD}>中央</text>
                </g>
              )}
              {i === 2 && (
                <g transform="translate(220 170)">
                  <Person x={-80} y={40} s={1.15} role="official" />
                  <rect x={20} y={-24} width={112} height={70} rx={4} fill="#E8DCC0" />
                  <path d="M 34 -6 h 84 M 34 12 h 84 M 34 30 h 56" stroke="#8A7A5A" strokeWidth={3} />
                  <g transform={`translate(${30 + ((f * 2.6) % 88)} ${34 + Math.sin(f * 0.3) * 8})`}>
                    <line x1={0} y1={0} x2={14} y2={-34} stroke="#3A2C18" strokeWidth={4} strokeLinecap="round" />
                    <circle cx={0} cy={0} r={3.5} fill="#12141C" />
                  </g>
                </g>
              )}
              <text x={220} y={310} textAnchor="middle" fontFamily={FONT} fontSize={32} fontWeight={900} fill={GOLD}>{it.k}</text>
            </g>
          );
        })}
      </svg>
      <ChapterTag text="特殊性二 · 立制度" />
      <Sub f={f} delay={60} lines={['别人只换龙椅上的姓，他拆掉了那台机器']} sub={['收精兵 · 制钱谷 · 文官治国——从制度上关掉「兵强马壮者为之」的循环']} />
    </AbsoluteFill>
  );
};

// S20 答案：两侧格子同尺寸，只保留年份标签
const S20: React.FC = () => {
  const f = useCurrentFrame();
  const DYN = ['#8E3B2E', '#3E6E5A', '#4A5A8E', '#6E4A7A', '#B8862B'];
  const spans = [16, 13, 11, 4, 9]; // 梁/唐/晋/汉/周 = 53 年
  const cells: number[] = [];
  spans.forEach((n, d) => { for (let i = 0; i < n; i++) cells.push(d); });
  const cell = 26, gap = 4, pitch = cell + gap;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(110% 100% at 50% 30%, #131C3E 0%, #0A0F22 55%, #04060D 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={520} />
        {/* 五代 53 格（9 列） */}
        <text x={220} y={262} fontFamily={FONT} fontSize={30} fontWeight={800} fill={GREY}>五代 · 53 年</text>
        <g transform="translate(220 300)">
          {cells.map((d, i) => {
            const p = interpolate(f, [8 + i * 2, 20 + i * 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const col = i % 9, row = Math.floor(i / 9);
            return <rect key={i} x={col * pitch} y={row * pitch} width={cell} height={cell} rx={3} fill={DYN[d]} opacity={p * 0.92} />;
          })}
        </g>
        {/* 两宋 319 格（20 列，同样格尺寸） */}
        <text x={900} y={262} fontFamily={FONT} fontSize={30} fontWeight={800} fill={GOLD}>两宋 · 319 年</text>
        <g transform="translate(900 300)">
          {Array.from({ length: 319 }).map((_, i) => {
            const p = interpolate(f, [40 + i * 0.3, 52 + i * 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const col = i % 20, row = Math.floor(i / 20);
            return <rect key={i} x={col * pitch} y={row * pitch} width={cell} height={cell} rx={3} fill={GOLD} opacity={p * (0.6 + (row % 3) * 0.13)} />;
          })}
        </g>
      </svg>
      <ChapterTag text="答案" />
      <Sub f={f} delay={150} lines={['黄袍加身只是开门']} sub={['不杀与立制度，才是让王朝活 319 年的原因']} />
    </AbsoluteFill>
  );
};

// S21 收尾
const S21: React.FC = () => {
  const f = useCurrentFrame();
  const p = spring({ frame: f - 4, fps: 24, config: { damping: 13, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 16%, #141C3A 0%, #0A0F22 55%, #05070F 100%)', fontFamily: FONT }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={44} h={480} />
        <g transform={`translate(960 ${300 + Math.sin(f * 0.16) * 26}) scale(${0.42 * Math.max(p, 0.001)})`} opacity={p}>
          <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
          <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
        </g>
      </svg>
      <div style={{ position: 'absolute', top: '46%', left: 120, right: 120, textAlign: 'center' }}>
        <div style={{ ...up(f, 4, 18, 80), fontSize: 50, fontWeight: 900, lineHeight: 1.5, color: PAPER, textShadow: `0 0 26px ${GOLD}88` }}>
          愿你看懂每一次「水到渠成」：
        </div>
        <div style={{ ...up(f, 14, 18, 80), marginTop: 16, fontSize: 40, fontWeight: 900, color: GOLD, lineHeight: 1.5 }}>
          机会来时有准备，握权时有分寸，做事时有章法
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 条件成熟度（登基时 100%）
const Meter: React.FC = () => {
  const g = useCurrentFrame();
  if (g < 312 || g > 2492) return null;
  const p = interpolate(g, [312, 504, 792, 984, 1176, 1368, 1656, 1848, 2136, 2376],
    [0, 8, 15, 25, 32, 40, 52, 60, 85, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = interpolate(g, [312, 342, 2412, 2492], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
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
// 22 幕：S0 72 + 其余 5040 = 5112 帧 = 213.0s
const DURS = [72, 240, 192, 288, 192, 192, 192, 288, 192, 240, 288, 144, 336, 144, 288, 240, 192, 360, 240, 336, 288, 168];
const SCENES = [S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21];

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
