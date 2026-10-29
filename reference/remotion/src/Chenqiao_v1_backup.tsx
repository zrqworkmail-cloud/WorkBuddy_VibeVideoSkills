import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from 'remotion';

/**
 * 《黄袍加身之前》· 历史科普短（陈桥兵变 · 公元 960 年）· 横版 1920×1080 · 136.5s
 *
 * 结构（四问展开，不压缩时长）：
 *   第 1 幕（S1–S9）  故事：53 年 14 帝的乱世 → 高平崛起 → 木牌 → 边警 → 夜议 → 黄袍加身 → 约法回师
 *   第 2 幕（S10）    四连问转场：条件成熟？为何成功？特殊在哪？宋为何长久？
 *   第 3 幕（S11–S13）条件三讲：位置（禁军）/ 人望（义社兄弟）/ 时机（窗口）
 *   第 4 幕（S14–S15）特殊性两讲：不杀（人心）/ 立制度（杯酒释兵权 · 文官治国）
 *   第 5 幕（S16）    答案：53 年 vs 319 年
 *   收尾（S17）       愿你 + 下集预告
 *
 * 全部画面由确定性时间函数渲染，零生成模型。硬规则照守。
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
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

const lerpC = (a: number[], b: number[], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

const rise = (f: number, delay = 0, dur = 14) => {
  const p = interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity: p, transform: `translateY(${(1 - p) * 46}px)` };
};
const glow = (color: string, blur = 20) => ({
  color: PAPER,
  textShadow: `0 0 ${blur}px ${color}AA, 0 0 ${blur * 2}px ${color}55`,
});

// 章节角标（左上）：第 X 幕 · 章节名
const ChapterTag: React.FC<{ text: string; color?: string }> = ({ text, color = GOLD }) => (
  <div style={{
    position: 'absolute', left: 48, top: 44,
    fontFamily: FONT, fontSize: 26, fontWeight: 800, letterSpacing: 5,
    color, border: `3px solid ${color}88`, borderRadius: 999,
    padding: '10px 28px', background: 'rgba(10,14,30,0.55)', opacity: 0.95,
  }}>{text}</div>
);

// 呼吸光晕（环境动效：保证任意时刻画面都在变化，避免长静止）
const Pulse: React.FC<{ color?: string }> = ({ color = GOLD }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 45% at 50% 72%, ${color}26 0%, transparent 70%)`,
        opacity: 0.5 + 0.5 * Math.sin(f * 0.21),
      }}
    />
  );
};

// 金色余烬粒子（环境动效：高对比持续上升，确保分析尺度下也有真实运动）
const Embers: React.FC<{ n?: number }> = ({ n = 110 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <g>
          {Array.from({ length: n }).map((_, i) => {
            const x = ((i * 331) % 1860) + 30;
            const speed = 1.6 + (i % 5) * 0.55;
            const y = 1090 - ((f * speed + i * 137) % 1180);
            const o = 0.3 + 0.3 * Math.abs(Math.sin(f * 0.13 + i * 0.7));
            const r = 4 + (i % 4);
            return <circle key={i} cx={x} cy={y} r={r} fill="#FFD98A" opacity={o} />;
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// 右上纪年条
const EraTag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: 'absolute', right: 48, top: 44,
    fontFamily: FONT, fontSize: 26, fontWeight: 800, letterSpacing: 5,
    color: GOLD, border: `3px solid ${GOLD_D}`, borderRadius: 999,
    padding: '10px 28px', background: 'rgba(10,14,30,0.55)', opacity: 0.95,
  }}>{text}</div>
);

// 底部字幕组（支持多行标题+副题渐进）
const Cap: React.FC<{ f: number; title: string[]; sub?: string[]; color?: string; top?: string; size?: number }> =
  ({ f, title, sub, color = GOLD, top = '72%', size = 62 }) => (
    <div style={{ position: 'absolute', top, left: 100, right: 100, textAlign: 'center' }}>
      {title.map((t, i) => (
        <div key={i} style={{ ...rise(f, 4 + i * 12, 14), fontSize: size, fontWeight: 900, lineHeight: 1.3, ...glow(color) }}>
          {t}
        </div>
      ))}
      {sub?.map((s, i) => (
        <div key={'s' + i} style={{ ...rise(f, 24 + i * 16, 14), marginTop: i === 0 ? 20 : 6, fontSize: 33, fontWeight: 700, color: PAPER, opacity: 0.92, lineHeight: 1.5 }}>
          {s}
        </div>
      ))}
    </div>
  );

// ---------- 复用插画 ----------
const Stars: React.FC<{ n?: number; h?: number }> = ({ n = 60, h = 520 }) => {
  const f = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const x = ((i * 173) % 1860) + 30;
        const y = ((i * 53) % (h - 30)) + 20;
        const o = 0.2 + 0.6 * Math.abs(Math.sin(i * 1.7 + f * 0.06));
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
      <circle cx={0} cy={-34} r={110} fill="#FF9C3F" opacity={0.10 + 0.05 * Math.sin(f * 0.8)} />
      <circle cx={0} cy={-34} r={62} fill="#FFB84D" opacity={0.14 + 0.06 * Math.sin(f * 0.8 + 1)} />
      <g transform={`translate(0 0) scale(${1 + k2 * 0.3})`}>
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

const Tent: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <line x1={0} y1={-84} x2={0} y2={-104} stroke={INK3} strokeWidth={4} />
    <path d="M 0 -104 q 24 4 34 20" stroke={VERM} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M -92 0 L 0 -84 L 92 0 Z" fill="#0F1730" stroke={INK3} strokeWidth={3} />
    <path d="M -20 0 L 0 -36 L 20 0 Z" fill="#060A16" />
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

const Rider: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => {
  const f = useCurrentFrame();
  const c = '#0B1122';
  const g = Math.sin(f * 0.5);
  const legs = [
    Math.sin(f * 0.5) * 26,
    Math.sin(f * 0.5 + 1.4) * 26,
    Math.sin(f * 0.5 + 2.8) * 26,
    Math.sin(f * 0.5 + 4.2) * 26,
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={-64 - g * 6} cy={26} r={14} fill="#3A3050" opacity={0.5} />
      <circle cx={-88} cy={20} r={9} fill="#3A3050" opacity={0.35} />
      <ellipse cx={0} cy={-6} rx={44} ry={19} fill={c} />
      <path d="M 34 -14 C 46 -30 52 -40 54 -52 L 72 -46 C 66 -30 60 -18 52 -6 Z" fill={c} />
      <circle cx={74} cy={-50} r={9} fill={c} />
      <path d={`M -42 -10 q ${-16 + g * 5} 14 ${-22} 26`} stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" />
      {legs.map((a, i) => (
        <line key={i} x1={i < 2 ? -26 : 26} y1={4} x2={(i < 2 ? -26 : 26) + a * 0.6} y2={40} stroke={c} strokeWidth={7} strokeLinecap="round" />
      ))}
      <circle cx={-4} cy={-52} r={10} fill={c} />
      <path d={`M -4 -42 C -2 -30 6 -24 16 -20`} stroke={c} strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M 6 -60 L 30 -78" stroke={c} strokeWidth={4} strokeLinecap="round" />
      <path d="M 30 -84 q 18 2 26 12" stroke={VERM} strokeWidth={4} fill="none" />
    </g>
  );
};

const Robe: React.FC<{ x: number; y: number; s?: number; p: number }> = ({ x, y, s = 1, p }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g opacity={0.5 * p}>
        {Array.from({ length: 12 }).map((_, i) => (
          <path key={i} d="M 0 -150 L 16 -336 L -16 -336 Z" fill={GOLD}
            transform={`rotate(${i * 30}) scale(${0.72 + 0.28 * Math.sin(f * 0.1 + i * 0.9)})`} opacity={0.32} />
        ))}
      </g>
      <g transform={`scale(1 ${Math.max(p, 0.001)})`} opacity={p}>
        <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z"
          fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
        <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
        <path d="M 44 -152 C 38 -50 58 60 70 152 L 94 152 C 82 40 58 -80 58 -152 Z" fill={GOLD_D} opacity={0.38} />
        <circle cx={0} cy={-120} r={9} fill={VERM} opacity={0.9} />
      </g>
    </g>
  );
};

const Seal: React.FC<{ x: number; y: number; s?: number; p: number; char: string }> = ({ x, y, s = 1, p, char }) => (
  <g transform={`translate(${x} ${y}) rotate(${-9 * (1 - p)}) scale(${s * Math.max(p, 0.001)})`}>
    <rect x={-72} y={-72} width={144} height={144} rx={14} fill={VERM} opacity={0.92} />
    <rect x={-58} y={-58} width={116} height={116} rx={10} fill="none" stroke={PAPER} strokeWidth={6} />
    <text x={0} y={6} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={char.length > 1 ? 54 : 84} fontWeight={900} fill={PAPER}>
      {char}
    </text>
  </g>
);

const WallGate: React.FC<{ p: number }> = ({ p }) => (
  <g>
    {Array.from({ length: 24 }).map((_, i) => (
      <rect key={i} x={20 + i * 80} y={452} width={46} height={44} fill={INK1} />
    ))}
    <rect x={0} y={494} width={1920} height={586} fill={INK1} />
    <path d="M 660 494 L 726 372 L 1194 372 L 1260 494 Z" fill="#0C1326" stroke="#243458" strokeWidth={3} />
    <path d="M 754 1080 L 754 660 Q 960 566 1166 660 L 1166 1080 Z" fill="#04060D" />
    <g transform={`translate(${-128 * p} 0)`}><rect x={754} y={654} width={208} height={430} fill="#5A4428" stroke="#3A2C18" strokeWidth={3} /></g>
    <g transform={`translate(${128 * p} 0)`}><rect x={958} y={654} width={208} height={430} fill="#4A3820" stroke="#3A2C18" strokeWidth={3} /></g>
  </g>
);

const Palace: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => {
  const f = useCurrentFrame() || 0;
  const warm = 0.5 + 0.5 * Math.sin(f * 0.12);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -240 0 C -170 -52 -90 -66 0 -70 C 90 -66 170 -52 240 0 L 196 0 C 150 -34 76 -46 0 -46 C -76 -46 -150 -34 -196 0 Z" fill={INK1} />
      <rect x={-150} y={0} width={300} height={150} fill={INK2} />
      <path d="M -168 0 L 0 -34 L 168 0 Z" fill={INK1} />
      <rect x={-96} y={38} width={54} height={70} rx={6} fill="#FFB84D" opacity={0.25 + warm * 0.3} />
      <rect x={42} y={38} width={54} height={70} rx={6} fill="#FFB84D" opacity={0.2 + (1 - warm) * 0.3} />
      <rect x={-26} y={30} width={52} height={120} rx={6} fill="#060A16" />
    </g>
  );
};

// 旗帜（升起/倒下动画用）
const Banner: React.FC<{ x: number; y: number; label: string; up: number; fall: number; color?: string }> =
  ({ x, y, label, up, fall, color = '#7A2E24' }) => (
    <g transform={`translate(${x} ${y}) rotate(${fall * 78})`}>
      <line x1={0} y1={0} x2={0} y2={-190 * Math.max(up, 0.001)} stroke="#3A2C18" strokeWidth={6} />
      <g opacity={up} transform={`translate(0 ${-186 * up})`}>
        <path d="M 0 -34 L 96 -26 L 0 -18 Z" fill={color} stroke={GOLD_D} strokeWidth={3} />
        <text x={34} y={-22} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={900} fill={PAPER}>{label}</text>
      </g>
    </g>
  );

// 箭雨（确定性抛物线）
const ArrowRain: React.FC<{ n: number; p: number; x0: number; x1: number; y0: number }> = ({ n, p, x0, x1, y0 }) => {
  if (p <= 0 || p >= 1) return null;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const prog = Math.min(p * (1.35 + (i % 5) * 0.06) - (i % 5) * 0.08, 1);
        if (prog <= 0) return null;
        const x = x0 + (x1 - x0) * prog;
        const arc = Math.sin(prog * Math.PI) * -120;
        const fall = prog > 0.7 ? (prog - 0.7) * 340 : 0;
        return <line key={i} x1={x} y1={y0 + arc + fall} x2={x + 14} y2={y0 + arc + fall - 5}
          stroke="#D8D2C0" strokeWidth={3} opacity={0.8} />;
      })}
    </g>
  );
};

// 皇帝牌位（倒下动画：第 fall 个起依次倒）
const Plaque: React.FC<{ x: number; y: number; label: string; stand: number }> = ({ x, y, label, stand }) => (
  <g transform={`translate(${x} ${y}) rotate(${(1 - stand) * 74})`} opacity={0.25 + 0.75 * stand}>
    <rect x={-52} y={-150} width={104} height={200} rx={10} fill="#241C2E" stroke="#4A3A5A" strokeWidth={3} />
    <rect x={-40} y={-138} width={80} height={176} rx={6} fill="none" stroke="#6A5A7A" strokeWidth={2} />
    <text x={0} y={-90} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={900} fill="#C9B8D8">{label}</text>
  </g>
);

// 王冠（掉落旋转）
const Crown: React.FC<{ x: number; y: number; s?: number; p: number; rot?: number }> = ({ x, y, s = 1, p, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={p}>
    <path d="M -46 10 L -52 -28 L -26 -6 L 0 -36 L 26 -6 L 52 -28 L 46 10 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={3} />
    <rect x={-48} y={10} width={96} height={14} rx={4} fill={GOLD_D} />
    <circle cx={0} cy={-40} r={6} fill={PAPER} />
  </g>
);

// ================= 场景 =================

// S1 钩子：数字砸屏 + 黄袍 + 悬念
const S1: React.FC = () => {
  const f = useCurrentFrame();
  const shake = f < 30 ? Math.sin(f * 2.4) * (1 - f / 30) * 8 : 0;
  const n53 = spring({ frame: f - 4, fps: 24, config: { damping: 10, stiffness: 160 } });
  const crownsFall = interpolate(f, [58, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const robeP = spring({ frame: f - 104, fps: 24, config: { damping: 12, stiffness: 90 } });
  const dim1 = interpolate(f, [96, 112], [1, 0.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const nameP = rise(f, 140, 16);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(130% 120% at 50% 12%, #17123A 0%, #0A0F22 52%, #04060D 100%)', fontFamily: FONT }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shake}px, 0)` }}>
        <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
          <Stars n={70} h={620} />
          {/* 14 帝牌位连环倒下 */}
          <g opacity={dim1}>
            {Array.from({ length: 14 }).map((_, i) => (
              <Plaque key={i} x={150 + i * 126} y={430}
                label='帝'
                stand={1 - interpolate(crownsFall, [i * 0.05, i * 0.05 + 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
            ))}
          </g>
          {/* 王冠掉落 */}
          <g opacity={1 - crownsFall}>
            <Crown x={960} y={560 - crownsFall * 60} p={1 - crownsFall * 0.4} rot={crownsFall * 140} s={1.4} />
          </g>
          {/* 黄袍闪现 */}
          <g opacity={1 - dim1}>
            <Robe x={960} y={580} s={0.72} p={Math.max(robeP, 0)} />
          </g>
        </svg>
        {/* 53 年巨字 */}
        <div style={{ position: 'absolute', top: '12%', left: 0, right: 0, textAlign: 'center', opacity: dim1 }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * Math.min(n53, 1)})`, opacity: Math.min(n53, 1) }}>
            <span style={{ fontSize: 210, fontWeight: 900, ...glow(RED, 30), color: PAPER }}>53</span>
            <span style={{ fontSize: 84, fontWeight: 900, color: PAPER, marginLeft: 20 }}>年</span>
          </div>
          <div style={{ ...rise(f, 26, 12), marginTop: 8, fontSize: 46, fontWeight: 900, color: PAPER, letterSpacing: 4 }}>
            五个朝代 · 八个姓氏 · 十四位皇帝
          </div>
          <div style={{ ...rise(f, 44, 12), marginTop: 10, fontSize: 38, fontWeight: 800, color: VERM }}>
            平均在位，不到 4 年
          </div>
        </div>
        {/* 黄袍段文案 */}
        <div style={{ position: 'absolute', top: '20%', left: 0, right: 0, textAlign: 'center', opacity: 1 - dim1 }}>
          <div style={{ ...rise(f, 108, 14), fontSize: 56, fontWeight: 900, lineHeight: 1.4, ...glow(GOLD) }}>
            公元 960 年正月初三，又一件黄袍
            <br />
            披上了一个人的肩膀——
          </div>
          <div style={{ ...rise(f, 126, 14), marginTop: 14, fontSize: 40, fontWeight: 800, color: GREY }}>
            所有人都在赌：他还能撑几年？
          </div>
        </div>
        {/* 名字揭晓 */}
        <div style={{ position: 'absolute', bottom: 90, left: 0, right: 0, textAlign: 'center', opacity: nameP.opacity, transform: nameP.transform }}>
          <span style={{ fontSize: 78, fontWeight: 900, color: GOLD, letterSpacing: 12, ...glow(GOLD) }}>赵匡胤</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S2 乱世规则：兵强马壮者为之
const S2: React.FC = () => {
  const f = useCurrentFrame();
  const banners = [
    { label: '梁', y: '907' }, { label: '唐', y: '923' }, { label: '晋', y: '936' }, { label: '汉', y: '947' }, { label: '周', y: '951' },
  ];
  const q = spring({ frame: f - 20, fps: 24, config: { damping: 12, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #1A142E 0%, #120E24 55%, #07050F 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={44} h={360} />
        <Ridge baseY={930} amp={30} color={INK2} seed={5.5} />
        {banners.map((b, i) => {
          const up = interpolate(f, [8 + i * 9, 22 + i * 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const fall = interpolate(f, [46 + i * 11, 58 + i * 11], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <g key={i}>
              <Banner x={330 + i * 315} y={560} label={b.label} up={up} fall={fall} />
              <text x={330 + i * 315} y={640} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={GREY} opacity={0.7}>{b.y}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', top: '13%', left: 140, right: 140, textAlign: 'center' }}>
        <div style={{ ...rise(f, 4, 14), fontSize: 34, fontWeight: 800, color: GREY, letterSpacing: 6 }}>五十三年间，皇位更迭的唯一规则</div>
        <div style={{ transform: `scale(${0.92 + 0.08 * Math.min(q, 1)})`, opacity: Math.min(q, 1), marginTop: 26 }}>
          <span style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.45, ...glow(VERM), color: PAPER, display: 'inline-block' }}>
            「天子宁有种耶？
            <br />
            兵强马壮者为之尔。」
          </span>
        </div>
        <div style={{ ...rise(f, 40, 14), marginTop: 26, fontSize: 30, fontWeight: 700, color: GREY }}>
          —— 五代 · 安重荣
        </div>
      </div>
      <EraTag text="五代 · 907–960" />
      <Cap f={f} top="76%" title={['皇帝，是当时的高危职业']} sub={['十三位君主，多数死于非命']} />
    </AbsoluteFill>
  );
};

// S3 高平之战：军功起点
const S3: React.FC = () => {
  const f = useCurrentFrame();
  const rain = interpolate(f, [10, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const heroP = spring({ frame: f - 58, fps: 24, config: { damping: 11, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #2A1E38 0%, #3A2830 50%, #1A1220 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={240} />
        <Ridge baseY={620} amp={44} color={INK3} seed={1.2} />
        <rect x={0} y={760} width={1920} height={320} fill={INK1} />
        <ArrowRain n={16} p={rain} x0={1500} x1={200} y0={300} />
        {/* 对冲两军 */}
        {[0, 1, 2, 3].map((i) => (
          <g key={'l' + i} transform={`translate(${330 + i * 110} 900) scale(-1.05 1.05)`}>
            <Soldier x={0} y={0} s={1} phase={i * 1.2} flag={false} />
          </g>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <g key={'r' + i} transform={`translate(${1300 + i * 110} 900)`}>
            <Soldier x={0} y={0} s={1} phase={i * 1.2 + 0.6} flag={false} />
          </g>
        ))}
        {/* 赵匡胤（金色高亮） */}
        <g transform={`translate(960 880) scale(${0.6 + 0.4 * Math.min(heroP, 1)})`} opacity={Math.min(heroP, 1)}>
          <circle cx={0} cy={-230} r={160} fill={GOLD} opacity={0.1 + 0.06 * Math.sin(f * 0.2)} />
          <g>
            <circle cx={0} cy={-110} r={17} fill={GOLD} />
            <line x1={0} y1={-93} x2={0} y2={-20} stroke={GOLD} strokeWidth={13} strokeLinecap="round" />
            <line x1={0} y1={-20} x2={-22} y2={26} stroke={GOLD} strokeWidth={10} strokeLinecap="round" />
            <line x1={0} y1={-20} x2={22} y2={26} stroke={GOLD} strokeWidth={10} strokeLinecap="round" />
            <line x1={0} y1={-78} x2={-30} y2={-34} stroke={GOLD} strokeWidth={9} strokeLinecap="round" />
            <line x1={0} y1={-78} x2={30} y2={-34} stroke={GOLD} strokeWidth={9} strokeLinecap="round" />
            <line x1={34} y1={-160} x2={40} y2={20} stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
          </g>
        </g>
      </svg>
      <EraTag text="显德元年 · 954" />
      <Cap f={f} top="70%" title={['高平之战 · 他救了柴荣']} sub={['以北汉大胜跻身权力核心 · 军功，是他第一块垫脚石']} />
    </AbsoluteFill>
  );
};

// S4 柴荣死
const S4: React.FC = () => {
  const f = useCurrentFrame();
  const dim = interpolate(f, [30, 70], [0, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0B1130 0%, #0E1530 58%, #131B38 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={50} h={400} />
        <circle cx={340} cy={190} r={54} fill="#E8E2C8" opacity={0.9 * (1 - dim)} />
        <circle cx={320} cy={176} r={44} fill="#0E1530" opacity={0.55} />
        <g transform={`translate(1160 620) scale(1.15)`}>
          <Palace x={0} y={0} />
        </g>
        <g transform="translate(1010 780)">
          <circle cx={0} cy={-46} r={13} fill="#0B1122" />
          <path d="M 0 -33 L 0 24 L -18 76 M 0 24 L 18 76" stroke="#0B1122" strokeWidth={10} fill="none" strokeLinecap="round" />
        </g>
        <g transform="translate(1200 808)">
          <circle cx={0} cy={-30} r={10} fill="#0B1122" />
          <path d="M 0 -20 L 0 22 L -12 58 M 0 22 L 12 58" stroke="#0B1122" strokeWidth={8} fill="none" strokeLinecap="round" />
        </g>
        <Ridge baseY={900} amp={30} color={INK2} seed={2.1} />
        <rect x={0} y={0} width={1920} height={1080} fill="#04060D" opacity={dim} />
      </svg>
      <EraTag text="显德六年 · 959" />
      <Cap f={f} top="62%" title={['柴荣病逝 · 39 岁']} sub={['7 岁幼帝即位 · 主少国疑', '禁军将士，只认殿前都点检的脸']} />
    </AbsoluteFill>
  );
};

// S5 木牌
const S5: React.FC = () => {
  const f = useCurrentFrame();
  const plank = spring({ frame: f - 8, fps: 24, config: { damping: 12, stiffness: 90 } });
  const rot = interpolate(plank, [0, 1], [-7, -3]);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 30%, #171F3E 0%, #0B1024 55%, #05070F 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={36} h={360} />
        <g transform={`translate(960 430) rotate(${rot}) scale(${Math.max(plank, 0.001)})`}>
          <line x1={0} y1={-150} x2={0} y2={-264} stroke="#3A2C18" strokeWidth={8} />
          <rect x={-306} y={-140} width={612} height={250} rx={20} fill="#7A5C38" stroke="#54401F" strokeWidth={10} />
          <path d="M -280 -80 q 140 14 280 2 M -280 -6 q 150 -12 300 0 M -270 66 q 120 12 240 2" stroke="#63481F" strokeWidth={4} fill="none" opacity={0.7} />
          <text x={4} y={-118} textAnchor="middle" fontFamily={FONT} fontSize={92} fontWeight={900} fill="#F5E2B8" letterSpacing={10}>点检作天子</text>
          <text x={0} y={-114} textAnchor="middle" fontFamily={FONT} fontSize={92} fontWeight={900} fill="#241708" letterSpacing={10} opacity={0.85}>点检作天子</text>
        </g>
        <Ridge baseY={930} amp={26} color={INK2} seed={6.4} />
      </svg>
      <EraTag text="北伐途中" />
      <Cap f={f} top="62%" color={GOLD_D} title={['其实，早有伏笔']} sub={['木牌现世：点检作天子 · 张永德被撤 · 接任的叫赵匡胤']} />
    </AbsoluteFill>
  );
};

// S6 边警 + 出征 + 天有二日
const S6: React.FC = () => {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, 144], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const top = lerpC([46, 32, 74], [10, 15, 34], t);
  const mid = lerpC([186, 110, 58], [14, 21, 44], t);
  const sunY = 190 + t * 230;
  const shift = interpolate(f, [0, 144], [0, 320], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const riderX = interpolate(f, [0, 62], [-220, 2160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 58%, #0B0F22 100%)`, fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <g opacity={1 - t * 1.05}>
          <circle cx={1380} cy={sunY} r={95} fill="#FFC85F" opacity={0.22} />
          <circle cx={1380} cy={sunY} r={52} fill="#FFD98A" />
          <circle cx={1454} cy={sunY + 76} r={40} fill="#FFB85C" opacity={0.9} />
          <text x={1380} y={sunY + 160} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill="#FFE2A8" opacity={0.85}>
            天有二日 · 一日克一日
          </text>
        </g>
        <Stars n={40} h={400} />
        <Ridge baseY={700} amp={50} color={INK3} seed={2.6} shift={-shift * 0.5} />
        <Ridge baseY={790} amp={42} color={INK2} seed={5.1} shift={-shift} />
        <rect x={0} y={860} width={1920} height={220} fill={INK1} />
        <path d="M -40 910 C 500 888 1300 934 1960 900" stroke="#0E1428" strokeWidth={26} fill="none" strokeLinecap="round" />
        {/* 先出驿马，再出行军 */}
        <g transform={`translate(${riderX} ${785}) scale(1.2)`}><Rider x={0} y={0} /></g>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i} opacity={interpolate(f, [64 + i * 4, 76 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            <Soldier x={200 + i * 200 + ((f * 1.2) % 60)} y={760} s={1.05} phase={i * 1.1} />
          </g>
        ))}
        <Tent x={300} y={850} s={0.9} />
        <Tent x={1660} y={850} s={0.9} />
        <Fire x={980} y={872} s={0.9} />
      </svg>
      <EraTag text="正月初一 → 初二" />
      <Cap f={f} top="74%" title={['边关急报 · 你随大军北上']} sub={['辽汉联军南下？真假至今存疑 · 夜宿陈桥驿，距开封 40 里']} />
    </AbsoluteFill>
  );
};

// S7 夜议
const S7: React.FC = () => {
  const f = useCurrentFrame();
  const b1 = interpolate(f, [14, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b2 = interpolate(f, [38, 56], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b3 = interpolate(f, [86, 104], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 55%, #131B36 0%, #090D1E 58%, #04060D 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <path d="M 180 900 L 960 210 L 1740 900 Z" fill="#0A0F22" stroke={INK3} strokeWidth={4} />
        {[[660, 880], [860, 930], [1090, 930], [1300, 875]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <ellipse cx={0} cy={0} rx={56} ry={68} fill="#070B16" />
            <circle cx={0} cy={-68} r={23} fill="#070B16" />
          </g>
        ))}
        <Fire x={960} y={890} s={1.35} />
        <g opacity={b1}>
          <rect x={330} y={380} width={420} height={96} rx={24} fill="#101A36" stroke={INK3} strokeWidth={3} />
          <path d="M 510 476 l 26 34 l 20 -34 Z" fill="#101A36" />
          <text x={540} y={440} textAnchor="middle" fontFamily={FONT} fontSize={36} fontWeight={800} fill={PAPER}>主少国疑……</text>
        </g>
        <g opacity={b2}>
          <rect x={960} y={520} width={600} height={96} rx={24} fill="#16223F" stroke={GOLD_D} strokeWidth={3} />
          <path d="M 1140 616 l 26 34 l 20 -34 Z" fill="#16223F" />
          <text x={1260} y={580} textAnchor="middle" fontFamily={FONT} fontSize={38} fontWeight={900} fill={GOLD}>不如立点检为天子</text>
        </g>
        <g opacity={b3}>
          <rect x={560} y={210} width={520} height={96} rx={24} fill="#101A36" stroke={INK3} strokeWidth={3} />
          <path d="M 790 306 l 26 34 l 20 -34 Z" fill="#101A36" />
          <text x={820} y={270} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={PAPER}>他假装不知道，睡下了</text>
        </g>
      </svg>
      <EraTag text="当夜 · 军帐" />
      <Cap f={f} top="84%" title={['你听见他们在议论']} sub={['赵匡义、赵普主谋 · 箭在弦上，只缺一件黄袍']} />
    </AbsoluteFill>
  );
};

// S8 黄袍加身
const S8: React.FC = () => {
  const f = useCurrentFrame();
  const dawnT = interpolate(f, [0, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const robeP = spring({ frame: f - 20, fps: 24, config: { damping: 12, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${lerpC([16, 24, 56], [40, 52, 96], dawnT)} 0%, ${lerpC([22, 28, 54], [176, 128, 64], dawnT)} 66%, #0B0F22 100%)`, fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={26} h={240} />
        <Ridge baseY={900} amp={30} color={INK1} seed={3.3} />
        {[140, 300, 450, 610, 1310, 1470, 1620, 1780].map((x, i) => (
          <Cheerer key={i} x={x} y={860} s={1.0 + (i % 3) * 0.08} phase={i * 0.9} />
        ))}
        <g transform="translate(960 640)">
          <Robe x={0} y={0} s={1.05} p={Math.max(robeP, 0)} />
          <g opacity={Math.max(robeP, 0)}>
            <circle cx={0} cy={-196} r={30} fill="#0B1122" />
            <path d="M 0 -166 L 0 -152" stroke="#0B1122" strokeWidth={10} strokeLinecap="round" />
            <path d="M 0 -152 L 0 4 M 0 4 L -20 60 M 0 4 L 20 60" stroke="#0B1122" strokeWidth={10} fill="none" strokeLinecap="round" />
          </g>
        </g>
        {[0, 1, 2].map((i) => {
          const p = interpolate(f, [40 + i * 12, 54 + i * 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const fade = interpolate(f, [66 + i * 12, 92 + i * 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <text key={i} x={420 + i * 540} y={280 + (i % 2) * 110} textAnchor="middle"
              fontFamily={FONT} fontSize={64} fontWeight={900} fill={GOLD}
              opacity={p * fade} transform={`translate(0 ${(1 - p) * 40})`}>万岁</text>
          );
        })}
      </svg>
      <EraTag text="正月初三 · 黎明" />
      <Cap f={f} top="76%" title={['天亮了 · 黄袍加身']} sub={['山呼万岁中，他"被迫"受了这件袍子 · 你亲眼见证历史']} />
    </AbsoluteFill>
  );
};

// S9 约法回师
const S9: React.FC = () => {
  const f = useCurrentFrame();
  const gateP = interpolate(f, [16, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chips = ['不犯太后幼主', '不凌公卿', '不掠市府'];
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #2A3458 0%, #4A4258 55%, #6A5544 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <WallGate p={gateP} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(${1560 - i * 190} 690) scale(-1.1 1.1)`}>
            <Soldier x={0} y={0} s={1} phase={i * 1.3 + 2} />
          </g>
        ))}
      </svg>
      <EraTag text="初三 · 回师" />
      <div style={{ position: 'absolute', top: '12%', left: 120, right: 120, display: 'flex', justifyContent: 'center', gap: 30 }}>
        {chips.map((c, i) => {
          const p = spring({ frame: f - 8 - i * 10, fps: 24, config: { damping: 12, stiffness: 110 } });
          return (
            <div key={i} style={{
              opacity: p, transform: `scale(${Math.max(p, 0.001)})`,
              background: 'rgba(10,14,30,0.72)', border: `3px solid ${GOLD_D}`, borderRadius: 999,
              padding: '16px 36px', fontSize: 36, fontWeight: 900, color: GOLD, fontFamily: FONT,
            }}>{c}</div>
          );
        })}
      </div>
      <Cap f={f} top="20%" title={['回师开封']} sub={['守将开门内应 · 几乎兵不血刃']} />
    </AbsoluteFill>
  );
};

// S10 四连问转场
const S10: React.FC = () => {
  const f = useCurrentFrame();
  const qs = ['条件，为何已经成熟？', '兵变，为何能成功？', '他，特殊在哪里？', '宋，为何能做 319 年？'];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 30%, #131B3C 0%, #0A0F22 55%, #04060D 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={40} h={980} />
      </svg>
      <div style={{ position: 'absolute', top: '10%', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...rise(f, 2, 14), fontSize: 54, fontWeight: 900, ...glow(GOLD) }}>
          故事讲完了。四个问题，一个个拆
        </div>
      </div>
      <div style={{ position: 'absolute', top: '30%', left: 360, right: 360 }}>
        {qs.map((q, i) => {
          const p = spring({ frame: f - 16 - i * 14, fps: 24, config: { damping: 12, stiffness: 100 } });
          return (
            <div key={i} style={{
              opacity: p, transform: `translateX(${(1 - p) * 80}px)`,
              display: 'flex', alignItems: 'center', marginBottom: 26,
            }}>
              <div style={{ width: 62, height: 62, borderRadius: 14, background: VERM, color: PAPER, fontWeight: 900, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 30, flexShrink: 0 }}>
                {['一', '二', '三', '四'][i]}
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: PAPER, ...glow(GOLD, 14) }}>{q}</div>
            </div>
          );
        })}
      </div>
      <ChapterTag text="转场 · 四连问" />
    </AbsoluteFill>
  );
};

// —— 分析幕通用外壳：左条件字牌 + 右说明卡 ——
const AnalyzeShell: React.FC<{ num: string; key_word: string; f: number; chapter: string; children: React.ReactNode }> =
  ({ num, key_word, f, chapter, children }) => (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 30% 30%, #15203E 0%, #0A0F24 58%, #04060D 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={30} h={900} />
        {/* 巨型字牌背景 */}
        <text x={210} y={640} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT}
          fontSize={330} fontWeight={900} fill={GOLD} opacity={0.14}>{key_word}</text>
      </svg>
      <ChapterTag text={chapter} />
      <div style={{ position: 'absolute', left: 120, top: 260, textAlign: 'center' }}>
        <div style={{ ...rise(f, 2, 14), fontSize: 30, fontWeight: 900, color: VERM, letterSpacing: 8, marginBottom: 18 }}>
          {num}
        </div>
        <div style={{ ...rise(f, 6, 14), fontSize: 120, fontWeight: 900, color: PAPER, lineHeight: 1.2, ...glow(GOLD, 26) }}>
          {key_word}
        </div>
      </div>
      {/* 右侧说明区 */}
      <div style={{ position: 'absolute', left: 620, right: 90, top: 150, bottom: 100 }}>
        {children}
      </div>
    </AbsoluteFill>
  );

// 条件卡（编号条目，渐进出现）
const PointCard: React.FC<{ f: number; idx: number; head: string; body: string; color?: string }> =
  ({ f, idx, head, body, color = GOLD }) => {
    const p = spring({ frame: f - idx, fps: 24, config: { damping: 12, stiffness: 100 } });
    return (
      <div style={{
        opacity: p, transform: `translateX(${(1 - p) * 70}px)`,
        background: 'rgba(12,19,40,0.82)', border: `3px solid ${color}66`, borderRadius: 22,
        padding: '22px 30px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 36, fontWeight: 900, color, marginBottom: 8 }}>{head}</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: PAPER, lineHeight: 1.5, opacity: 0.94 }}>{body}</div>
      </div>
    );
  };

// S11 条件一 · 位置
const S11: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AnalyzeShell num="条件一" key_word="位置" f={f} chapter="条件一 · 位置">
      <PointCard f={f} idx={12} head="五代的皇位，来自兵权" body={'朱温、李存勖、石敬瑭、刘知远、郭威——五代每位开国皇帝，都是手里有兵的军人。谁握住禁军，谁就握住龙椅的把手。'} />
      <PointCard f={f} idx={72} head="殿前都点检 = 禁军最高统帅" body={'赵匡胤 959 年接任此职，京城的防务、精锐、人事，全在他手里。兵变之夜能一夜成功，靠的不是运气，是职务。'} />
      <PointCard f={f} idx={132} head="黄袍加身的第一条件" body={'不是胆子大，是位置对——机器的钥匙已经插在锁上，只差有人去拧。'} color={PAPER} />
    </AnalyzeShell>
  );
};

// S12 条件二 · 人望
const S12: React.FC = () => {
  const f = useCurrentFrame();
  const names = ['石守信', '王审琦', '李继勋', '杨光义', '刘庆义', '刘守忠', '韩重赟', '王政忠'];
  return (
    <AnalyzeShell num="条件二" key_word="人望" f={f} chapter="条件二 · 人望">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 24 }}>
        {names.map((n, i) => {
          const p = spring({ frame: f - 12 - i * 7, fps: 24, config: { damping: 12, stiffness: 120 } });
          return (
            <div key={i} style={{
              opacity: p, transform: `scale(${Math.max(p, 0.001)})`,
              background: 'rgba(12,19,40,0.85)', border: `3px solid ${GOLD_D}`, borderRadius: 14,
              padding: '14px 26px', fontSize: 32, fontWeight: 900, color: PAPER,
            }}>{n}</div>
          );
        })}
      </div>
      <PointCard f={f} idx={78} head="义社十兄弟 · 军中嫡系网" body={'他与九位禁军中层将领结为兄弟——兵变当晚，京城内外防务的关键位置上，坐的全是自己人。'} />
      <PointCard f={f} idx={136} head="高平之战攒下的威望" body={'军功 + 嫡系 + 会做人：士兵服他，同僚认他。位置给你开门，人望让门后没有第二把锁。'} color={PAPER} />
    </AnalyzeShell>
  );
};

// S13 条件三 · 时机
const S13: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AnalyzeShell num="条件三" key_word="时机" f={f} chapter="条件三 · 时机">
      <PointCard f={f} idx={12} head="主少国疑 · 权力真空" body={'39 岁的雄主骤逝，留下 7 岁皇帝与年轻太后。五代人的记忆里，这种局面只有一种结局。'} />
      <PointCard f={f} idx={78} head="边警急报 · 合法出城" body={'大军奉诏北上，赵匡胤名正言顺地带着禁军主力离开京城——兵变最难的「合法带兵出城」，被一纸急报解决了。'} />
      <PointCard f={f} idx={144} head="夜宿陈桥 · 天赐窗口" body={'距开封 40 里，军心浮动，「天有二日」的流言替所有人做好了心理建设。'} />
      <PointCard f={f} idx={196} head="兵变要的不是勇气，是窗口" body={'位置、人望早就在了，等的只是这个瞬间。'} color={PAPER} />
    </AnalyzeShell>
  );
};

// S14 特殊性一 · 不杀
const S14: React.FC = () => {
  const f = useCurrentFrame();
  const left = [
    '后梁 朱温 —— 死于亲子之手',
    '后唐 李存勖 —— 乱兵所杀',
    '后唐 李从珂 —— 自焚而亡',
    '后晋 石重贵 —— 被掳北上',
    '后汉 刘承祐 —— 逃亡被杀',
  ];
  return (
    <AnalyzeShell num="特殊性一" key_word="不杀" f={f} chapter="特殊性一 · 不杀">
      {/* 左：前任下场 */}
      <div style={{ width: 500, float: 'left', marginRight: 44 }}>
        {left.map((s, i) => {
          const p = interpolate(f, [12 + i * 10, 24 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{
              opacity: p, transform: `translateX(${(1 - p) * 50}px)`,
              borderLeft: `6px solid ${RED}`, background: 'rgba(40,12,16,0.75)',
              padding: '15px 20px', marginBottom: 13, borderRadius: '0 14px 14px 0',
              fontSize: 28, fontWeight: 700, color: PAPER,
            }}>{s}</div>
          );
        })}
        <div style={{ ...rise(f, 74, 14), marginTop: 6, fontSize: 26, color: GREY, fontWeight: 700 }}>换了旗帜，没换规则：下一个还会来</div>
      </div>
      {/* 右：他做了什么 */}
      <div style={{ overflow: 'hidden' }}>
        <PointCard f={f} idx={78} head="入城约法 · 秋毫无犯" body={'不犯太后幼主、不凌公卿、不掠市府——兵变之夜，开封城里听不见喊杀声。'} />
        <PointCard f={f} idx={138} head="优待柴氏 · 政治文明" body={'恭帝封郑王、得以善终，柴氏世代受宋室礼遇。他用克制告诉所有人：这次改朝换代，不搞清算。'} />
        <PointCard f={f} idx={198} head="文臣不换血 · 政权软着陆" body={'范质等后周旧臣原班留用，统治机器照常运转——他知道：马上得天下，不能马上治天下。'} color={PAPER} />
      </div>
    </AnalyzeShell>
  );
};

// S15 特殊性二 · 立制度
const S15: React.FC = () => {
  const f = useCurrentFrame();
  const cupP = spring({ frame: f - 10, fps: 24, config: { damping: 11, stiffness: 100 } });
  const chips = [
    { k: '收精兵', v: '地方精锐编入中央禁军' },
    { k: '制钱谷', v: '财权收归中央' },
    { k: '文官治国', v: '州县由文官主政，重文抑武' },
  ];
  return (
    <AnalyzeShell num="特殊性二" key_word="立制度" f={f} chapter="特殊性二 · 立制度">
      {/* 杯酒释兵权图 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 24, height: 130 }}>
        <div style={{ transform: `translateY(${(1 - Math.min(cupP, 1)) * 40}px)`, opacity: Math.min(cupP, 1), textAlign: 'center', width: 220 }}>
          <svg width={190} height={110} viewBox="0 0 190 110">
            <path d="M 30 20 L 160 20 L 140 70 L 50 70 Z" fill="#C9B06A" stroke={GOLD_D} strokeWidth={4} />
            <path d="M 30 20 Q 20 52 48 70 M 160 20 Q 170 52 142 70" stroke={GOLD_D} strokeWidth={4} fill="none" />
            <ellipse cx={95} cy={30} rx={54} ry={10} fill="#8A6B2A" />
            <ellipse cx={95} cy={30} rx={42} ry={7} fill="#FFE8A3" opacity={0.85} />
          </svg>
          <div style={{ fontSize: 26, fontWeight: 800, color: GREY, marginTop: 6 }}>建隆二年 · 961</div>
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: PAPER, opacity: rise(f, 30, 14).opacity, ...glow(GOLD, 14) }}>
          杯酒释兵权——
        </div>
        <div style={{ fontSize: 31, fontWeight: 700, color: PAPER, lineHeight: 1.5, opacity: rise(f, 44, 14).opacity }}>
          一顿酒席，请老兄弟们交出兵权、回家享福。
          <br />
          没有杀一个人，就拆掉了「兵强马壮者为之」的引信。
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {chips.map((c, i) => {
          const p = spring({ frame: f - 96 - i * 20, fps: 24, config: { damping: 12, stiffness: 100 } });
          return (
            <div key={i} style={{
              opacity: p, transform: `translateY(${(1 - p) * 60}px)`, flex: 1,
              background: 'rgba(12,19,40,0.85)', border: `3px solid ${GOLD_D}`, borderRadius: 20,
              padding: '24px 26px',
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: GOLD, marginBottom: 10 }}>{c.k}</div>
              <div style={{ fontSize: 27, fontWeight: 700, color: PAPER, lineHeight: 1.5 }}>{c.v}</div>
            </div>
          );
        })}
      </div>
      <div style={{ ...rise(f, 180, 14), marginTop: 28, fontSize: 30, fontWeight: 800, color: PAPER, lineHeight: 1.5 }}>
        别人只换龙椅上的姓，他拆掉了那台<span style={{ color: GOLD }}>不断生产反派的机器</span>。
      </div>
    </AnalyzeShell>
  );
};

// S16 答案：53 年 vs 319 年
const S16: React.FC = () => {
  const f = useCurrentFrame();
  const bar53 = interpolate(f, [12, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bar319 = interpolate(f, [44, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 110% at 50% 30%, #131C3E 0%, #0A0F22 55%, #04060D 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={40} h={980} />
      </svg>
      <div style={{ position: 'absolute', top: '9%', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...rise(f, 2, 14), fontSize: 54, fontWeight: 900, ...glow(GOLD) }}>
          为什么宋，能做这么久？
        </div>
      </div>
      {/* 对比条形 */}
      <div style={{ position: 'absolute', top: '26%', left: 260, right: 260 }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: GREY, marginBottom: 12 }}>五代 · 53 年 · 五朝十四帝</div>
          <div style={{ height: 46, background: 'rgba(224,50,43,0.15)', borderRadius: 23, overflow: 'hidden' }}>
            <div style={{ width: `${16 * bar53}%`, height: '100%', background: RED, borderRadius: 23 }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color: GREY, marginBottom: 12 }}>两宋 · 319 年 · 十八帝</div>
          <div style={{ height: 46, background: 'rgba(232,179,75,0.15)', borderRadius: 23, overflow: 'hidden' }}>
            <div style={{ width: `${96 * bar319}%`, height: '100%', background: GOLD, borderRadius: 23, boxShadow: '0 0 24px rgba(232,179,75,0.5)' }} />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: '58%', left: 260, right: 260, textAlign: 'center' }}>
        <div style={{ ...rise(f, 110, 16), fontSize: 40, fontWeight: 900, lineHeight: 1.6, color: PAPER }}>
          黄袍加身只是开门，
          <br />
          <span style={{ color: GOLD }}>不杀与立制度，才是让王朝活 319 年的原因。</span>
        </div>
        <div style={{ ...rise(f, 150, 14), marginTop: 22, fontSize: 30, fontWeight: 700, color: GREY }}>
          位置让他上台，人望让他成事，时机让他赢一次——
          <br />
          而克制与制度，让他不用再赢第二次。
        </div>
      </div>
      <ChapterTag text="答案" />
    </AbsoluteFill>
  );
};

// S17 收尾
const S17: React.FC = () => {
  const f = useCurrentFrame();
  const p = spring({ frame: f - 4, fps: 24, config: { damping: 13, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(130% 120% at 50% 16%, #141C3A 0%, #0A0F22 55%, #05070F 100%)', fontFamily: FONT }}>
      <Pulse />
      <Embers />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <Stars n={56} h={560} />
        <g transform={`translate(960 340) rotate(${Math.sin(f * 0.08) * 2}) scale(${0.46 * Math.max(p, 0.001)})`}>
          <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
          <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
        </g>
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: 80, right: 80, textAlign: 'center' }}>
        <div style={{ ...rise(f, 2, 14), fontSize: 54, fontWeight: 900, lineHeight: 1.45, ...glow(GOLD) }}>
          愿你手里的每一件「黄袍」，
        </div>
        <div style={{ ...rise(f, 10, 14), marginTop: 14, fontSize: 44, fontWeight: 900, color: PAPER, lineHeight: 1.5 }}>
          都配得上位置、人望、时机，和收住手的克制
        </div>
      </div>
      <div style={{ ...rise(f, 22, 14), position: 'absolute', bottom: 170, left: 0, right: 0, textAlign: 'center', fontSize: 30, color: GREY, fontWeight: 700 }}>
        第 1 集 · 一件黄袍 ｜ 下一支 · 杯酒释兵权
      </div>
      <div style={{ ...rise(f, 30, 14), position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center', fontSize: 36, color: GOLD, fontWeight: 900 }}>
        关注我 · 每天一个历史真相
      </div>
    </AbsoluteFill>
  );
};

// ================= 时间轴 =================
// 17 幕，总计 3276 帧 = 136.5s @24fps；与 136.7s BGM 母版对齐（片尾自带淡出）。
const DURS = [180, 180, 156, 144, 144, 180, 144, 204, 132, 132, 228, 216, 216, 276, 324, 252, 168];
const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17];

export const Chenqiao: React.FC = () => {
  let acc = 0;
  const seqs: React.ReactNode[] = [];
  SCENES.forEach((C, i) => {
    seqs.push(
      <Sequence key={i} from={acc} durationInFrames={DURS[i]}><C /></Sequence>
    );
    acc += DURS[i];
  });
  return (
    <AbsoluteFill style={{ background: '#05070F' }}>
      {seqs}
    </AbsoluteFill>
  );
};
