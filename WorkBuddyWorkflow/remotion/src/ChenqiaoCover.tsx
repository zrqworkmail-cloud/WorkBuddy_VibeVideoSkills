import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

const GOLD = '#E8B34B';
const GOLD_D = '#B8862B';
const VERM = '#C23B2E';
const PAPER = '#F2E8D5';
const GREY = '#8C97B5';
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

/** 横版封面（1920×1080），纯代码渲染，remotion still 出图 */
export const ChenqiaoCover: React.FC = () => {
  const f = useCurrentFrame() || 0;
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(130% 130% at 30% 12%, #161F42 0%, #0A0F22 50%, #04060D 100%)',
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 80 }).map((_, i) => {
          const x = ((i * 173) % 1860) + 30;
          const y = ((i * 53) % 900) + 20;
          const o = 0.25 + 0.55 * Math.abs(Math.sin(i * 1.7 + f * 0.06));
          return <circle key={i} cx={x} cy={y} r={1 + (i % 3)} fill="#DFE8FF" opacity={o} />;
        })}
        {/* 黄袍（左侧主视觉） */}
        <g transform="translate(430 500)">
          <g opacity={0.55}>
            {Array.from({ length: 12 }).map((_, i) => (
              <path key={i} d="M 0 -150 L 18 -380 L -18 -380 Z" fill={GOLD}
                transform={`rotate(${i * 30}) scale(${0.75 + 0.25 * Math.sin(i * 0.9)})`} opacity={0.3} />
            ))}
          </g>
          <path d="M -74 -150 C -60 -160 60 -160 74 -150 C 70 -96 96 40 112 152 L -112 152 C -96 40 -70 -96 -74 -150 Z"
            fill={GOLD} stroke={GOLD_D} strokeWidth={5} />
          <path d="M -32 -152 C -28 -60 -42 60 -54 152 L -14 152 C -8 60 -2 -60 4 -152 Z" fill={GOLD_D} opacity={0.5} />
          <path d="M 44 -152 C 38 -50 58 60 70 152 L 94 152 C 82 40 58 -80 58 -152 Z" fill={GOLD_D} opacity={0.38} />
          <circle cx={0} cy={-120} r={9} fill={VERM} opacity={0.9} />
        </g>
        <path d="M 870 60 L 870 1020" stroke={`${GOLD_D}55`} strokeWidth={3} strokeDasharray="4 14" />
      </svg>

      {/* 右侧文字区 */}
      <div style={{ position: 'absolute', left: 950, right: 100, top: 150, textAlign: 'left' }}>
        <span style={{
          display: 'inline-block', fontSize: 30, fontWeight: 900, color: GOLD, letterSpacing: 5,
          border: `3px solid ${GOLD_D}`, borderRadius: 999, padding: '12px 32px',
          background: 'rgba(10,14,30,0.55)',
        }}>
          第 1 集 · 一件黄袍
        </span>
        <div style={{
          marginTop: 56, fontSize: 150, fontWeight: 900, lineHeight: 1.12, color: PAPER, letterSpacing: 10,
          textShadow: '0 0 30px #E8B34BCC, 0 0 64px #E8B34B66',
        }}>
          黄袍
          <br />
          加身
        </div>
        <div style={{ marginTop: 34, fontSize: 58, fontWeight: 900, color: GOLD, letterSpacing: 3 }}>
          之前发生了什么？
        </div>
        <div style={{ marginTop: 36, fontSize: 36, fontWeight: 700, color: PAPER, lineHeight: 1.6, opacity: 0.92 }}>
          明明只是奉命北上，怎么走着就当了皇帝？
        </div>
      </div>

      {/* 底部条 */}
      <div style={{ position: 'absolute', bottom: 100, left: 950, right: 120, height: 4, background: 'linear-gradient(90deg, #E8B34B, transparent)' }} />
      <div style={{ position: 'absolute', bottom: 48, left: 950, right: 120, textAlign: 'left', fontSize: 28, color: GREY, fontWeight: 700, letterSpacing: 2 }}>
        公元 960 年 · 陈桥驿 ｜ 历史 · 沉浸式科普
      </div>
    </AbsoluteFill>
  );
};
