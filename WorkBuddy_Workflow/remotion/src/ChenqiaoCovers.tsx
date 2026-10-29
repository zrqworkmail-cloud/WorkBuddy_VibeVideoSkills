import React from 'react';
import { AbsoluteFill } from 'remotion';

const GOLD = '#E8B34B';
const GOLD_D = '#B8862B';
const VERM = '#C23B2E';
const PAPER = '#F2E8D5';
const GREY = '#8C97B5';
const FONT =
  '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

/** 星点背景（静态，供封面使用） */
const Stars: React.FC<{ w: number; h: number; n?: number }> = ({ w, h, n = 90 }) => (
  <>
    {Array.from({ length: n }).map((_, i) => {
      const x = ((i * 173) % (w - 60)) + 30;
      const y = ((i * 97) % (h - 80)) + 24;
      const r = 0.9 + (i % 3) * 0.7;
      const o = 0.2 + 0.5 * Math.abs(Math.sin(i * 1.7));
      return <circle key={i} cx={x} cy={y} r={r} fill="#DFE8FF" opacity={o} />;
    })}
  </>
);

/** 黄袍主视觉：交领右衽 + 两宽袖 + 下摆，带柔光晕与细光柱 */
const Robe: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <defs>
      <radialGradient id="robeGlow">
        <stop offset="0%" stopColor="#F5C862" stopOpacity="0.30" />
        <stop offset="55%" stopColor="#E8B34B" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#E8B34B" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* 柔光晕 */}
    <circle cx={0} cy={0} r={380} fill="url(#robeGlow)" />
    {/* 同心细光环（替代放射光柱，避免"裂纹"感） */}
    {[
      { r: 236, o: 0.13 },
      { r: 306, o: 0.09 },
      { r: 378, o: 0.06 },
    ].map((c, i) => (
      <circle key={i} cx={0} cy={0} r={c.r} fill="none" stroke="#F5C862" strokeWidth={2} opacity={c.o} />
    ))}
    {/* 袍身：肩 → 左袖 → 左摆 → 右摆 → 右袖 → 肩 */}
    <path
      d="M -56 -152 L -172 -116 L -150 36 L -70 -10 L -98 158 L 98 158 L 70 -10 L 150 36 L 172 -116 L 56 -152 Z"
      fill={GOLD}
      stroke={GOLD_D}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    {/* 袖内暗部（袖口内侧） */}
    <path d="M -172 -116 L -150 36 L -128 30 L -150 -112 Z" fill={GOLD_D} opacity={0.3} />
    <path d="M 172 -116 L 150 36 L 128 30 L 150 -112 Z" fill={GOLD_D} opacity={0.3} />
    {/* 领口（交领右衽） */}
    <path d="M -32 -152 L 0 -82 L 32 -152 Z" fill={GOLD_D} opacity={0.72} />
    <path d="M -30 -150 L 2 -84" stroke={PAPER} strokeWidth={3} opacity={0.35} />
    {/* 中缝 */}
    <path d="M 0 -82 L 0 158" stroke={GOLD_D} strokeWidth={3.5} opacity={0.5} />
    {/* 腰带 */}
    <rect x={-86} y={2} width={172} height={19} fill={VERM} opacity={0.88} />
    <rect x={-12} y={-1} width={24} height={25} rx={4} fill={GOLD_D} opacity={0.9} />
    {/* 团龙纹 */}
    <circle cx={0} cy={62} r={19} fill="none" stroke={GOLD_D} strokeWidth={2.6} opacity={0.78} />
    <path d="M -10 62 q 10 -12 20 0 q -10 12 -20 0" stroke={GOLD_D} strokeWidth={2.2} fill="none" opacity={0.78} />
    {/* 袍下阴影 */}
    <ellipse cx={0} cy={166} rx={110} ry={14} fill="#000" opacity={0.35} />
  </g>
);

/** 底部纪年条 */
const Footer: React.FC<{ w: number; bottom: number; left: number; right: number; align?: 'left' | 'center' }> = ({
  w, bottom, left, right, align = 'left',
}) => (
  <>
    <div
      style={{
        position: 'absolute', bottom: bottom + 52, left, right, height: 3,
        background: `linear-gradient(90deg, ${GOLD}, transparent)`,
      }}
    />
    <div
      style={{
        position: 'absolute', bottom, left, right,
        textAlign: align, fontSize: 25, color: GREY, fontWeight: 700, letterSpacing: 2.5,
      }}
    >
      公元 960 年 · 陈桥驿 ｜ 历史 · 沉浸式科普
    </div>
  </>
);

/* ======================= 横封面 4:3（1440×1080） ======================= */
export const ChenqiaoCover43: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(120% 120% at 26% 20%, #182247 0%, #0A0F22 52%, #04060D 100%)',
      fontFamily: FONT,
      overflow: 'hidden',
    }}
  >
    <svg width={1440} height={1080} viewBox="0 0 1440 1080" style={{ position: 'absolute', inset: 0 }}>
      <Stars w={1440} h={1080} n={70} />
      {/* 远山剪影 */}
      <path d="M 0 1000 L 180 940 L 330 985 L 520 925 L 700 980 L 900 930 L 1120 985 L 1300 935 L 1440 975 L 1440 1080 L 0 1080 Z" fill="#080C1A" opacity={0.9} />
      <Robe x={400} y={500} s={1.18} />
      {/* 分隔虚线 */}
      <path d="M 760 90 L 760 990" stroke={`${GOLD_D}55`} strokeWidth={3} strokeDasharray="4 14" />
    </svg>

    {/* 右侧文字 */}
    <div style={{ position: 'absolute', left: 820, right: 60, top: 232 }}>
      <div
        style={{
          fontSize: 120, fontWeight: 900, lineHeight: 1.1, color: PAPER, letterSpacing: 8,
          textShadow: `0 0 28px ${GOLD}CC, 0 0 60px ${GOLD}55`,
        }}
      >
        黄袍
        <br />
        加身
      </div>
      <div style={{ marginTop: 26, fontSize: 52, fontWeight: 900, color: GOLD, letterSpacing: 2 }}>
        之前发生了什么？
      </div>
      <div style={{ marginTop: 30, fontSize: 29, fontWeight: 700, color: PAPER, lineHeight: 1.55, opacity: 0.9 }}>
        53 年换了 14 个皇帝
        <br />
        他凭什么让王朝活 319 年？
      </div>
      {/* 朱印 */}
      <div
        style={{
          marginTop: 34, display: 'inline-block', padding: '10px 20px', borderRadius: 8,
          background: VERM, color: PAPER, fontSize: 26, fontWeight: 900, letterSpacing: 4,
          boxShadow: `0 0 22px ${VERM}88`,
        }}
      >
        公元 960
      </div>
    </div>

    <Footer w={1440} bottom={54} left={820} right={60} />
  </AbsoluteFill>
);

/* ======================= 竖封面 3:4（1080×1440） ======================= */
export const ChenqiaoCover34: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(110% 80% at 50% 22%, #1A2450 0%, #0A0F22 54%, #04060D 100%)',
      fontFamily: FONT,
      overflow: 'hidden',
    }}
  >
    <svg width={1080} height={1440} viewBox="0 0 1080 1440" style={{ position: 'absolute', inset: 0 }}>
      <Stars w={1080} h={1440} n={80} />
      <path d="M 0 1210 L 150 1150 L 300 1198 L 470 1132 L 640 1190 L 810 1140 L 960 1196 L 1080 1158 L 1080 1440 L 0 1440 Z" fill="#080C1A" opacity={0.92} />
      <Robe x={540} y={450} s={1.22} />
    </svg>

    {/* 主标题 */}
    <div
      style={{
        position: 'absolute', top: 720, left: 0, right: 0, textAlign: 'center',
        fontSize: 148, fontWeight: 900, lineHeight: 1.08, color: PAPER, letterSpacing: 12,
        textShadow: `0 0 34px ${GOLD}CC, 0 0 74px ${GOLD}55`,
      }}
    >
      黄袍加身
    </div>
    <div
      style={{
        position: 'absolute', top: 900, left: 0, right: 0, textAlign: 'center',
        fontSize: 58, fontWeight: 900, color: GOLD, letterSpacing: 3,
      }}
    >
      之前发生了什么？
    </div>

    {/* 副标题卡 */}
    <div
      style={{
        position: 'absolute', top: 1010, left: 90, right: 90,
        padding: '26px 30px', borderRadius: 18,
        background: 'rgba(10,14,30,0.62)', border: `3px solid ${GOLD_D}66`,
        textAlign: 'center', fontSize: 36, fontWeight: 800, color: PAPER, lineHeight: 1.5,
      }}
    >
      53 年换了 14 个皇帝
      <br />
      他凭什么让王朝活 319 年？
    </div>

    {/* 朱印 */}
    <div
      style={{
        position: 'absolute', top: 1200, left: 0, right: 0, textAlign: 'center',
      }}
    >
      <span
        style={{
          display: 'inline-block', padding: '12px 30px', borderRadius: 10,
          background: VERM, color: PAPER, fontSize: 32, fontWeight: 900, letterSpacing: 6,
          boxShadow: `0 0 26px ${VERM}88`,
        }}
      >
        公元 960
      </span>
    </div>

    <Footer w={1080} bottom={62} left={0} right={0} align="center" />
  </AbsoluteFill>
);
