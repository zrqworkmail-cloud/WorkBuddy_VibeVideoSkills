import React from 'react';
import { AbsoluteFill } from 'remotion';

const RED = '#E0322B';
const GREEN = '#34D399';
const YELLOW = '#FBBF24';
const WHITE = '#F8FAFC';
const GREY = '#94A3B8';
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

const Jar: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    <rect x={52} y={20} width={96} height={26} rx={8} fill="#C9CDD6" />
    <rect x={52} y={20} width={96} height={10} rx={5} fill="#E6E9F0" />
    <rect x={44} y={46} width={112} height={128} rx={18} fill="#F4F6FB" stroke="#D7DCE6" strokeWidth={3} />
    <rect x={58} y={74} width={84} height={74} rx={10} fill={RED} />
    <text x={100} y={112} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill="#FFF">
      老干妈
    </text>
    <g transform="translate(100 140)">
      <path d="M -22 0 Q 0 -16 22 0 Q 0 14 -22 0 Z" fill="#FF6B35" />
      <path d="M 18 -6 q 10 -10 16 -4" stroke="#3FA34D" strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  </svg>
);

/** 竖版封面（1080×1920），纯代码渲染，remotion still 出图 */
export const Cover: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(120% 80% at 50% 16%, #1A0E12 0%, #100A16 45%, #05070F 100%)',
      fontFamily: FONT,
      overflow: 'hidden',
    }}
  >
    {/* 背景光晕 */}
    <AbsoluteFill
      style={{
        background: 'radial-gradient(55% 30% at 50% 62%, #E0322B22 0%, transparent 72%)',
      }}
    />

    {/* 顶部信源条 */}
    <div
      style={{
        position: 'absolute',
        top: 150,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 34,
        letterSpacing: 3,
        color: GREY,
      }}
    >
      <span style={{ color: RED, fontWeight: 800 }}>● </span>
      2026/10/26 热点
    </div>

    {/* 主标题 */}
    <div
      style={{
        position: 'absolute',
        top: 300,
        left: 60,
        right: 60,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 46, color: RED, fontWeight: 800, letterSpacing: 2 }}>网传</div>
      <div
        style={{
          marginTop: 24,
          fontSize: 132,
          fontWeight: 900,
          lineHeight: 1.12,
          color: WHITE,
          textShadow: '0 0 24px #E0322BAA, 0 0 48px #E0322B66',
        }}
      >
        老干妈用 AI
        <br />
        裁掉 552 人？
      </div>
    </div>

    {/* 辟谣章 */}
    <div
      style={{
        position: 'absolute',
        top: 760,
        right: 70,
        width: 260,
        height: 260,
        borderRadius: 30,
        border: '10px solid #E0322B',
        color: RED,
        fontWeight: 900,
        fontSize: 60,
        lineHeight: 1.08,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        transform: 'rotate(-11deg)',
        boxShadow: '0 0 34px #E0322B77',
        background: 'rgba(224,50,43,0.08)',
      }}
    >
      官方
      <br />
      辟谣
    </div>

    {/* 辣椒罐 */}
    <div style={{ position: 'absolute', top: 1010, left: 90 }}>
      <Jar size={300} />
    </div>

    {/* 结论条 */}
    <div
      style={{
        position: 'absolute',
        top: 1060,
        right: 60,
        left: 420,
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: 52, fontWeight: 900, color: GREEN, lineHeight: 1.25 }}>
        营收 54 亿
        <br />
        创历史新高
      </div>
      <div style={{ marginTop: 22, fontSize: 36, color: WHITE, fontWeight: 700, lineHeight: 1.45 }}>
        AI 替代的是「任务」
        <br />
        <span style={{ color: YELLOW }}>不是「岗位」</span>
      </div>
    </div>

    {/* 底部条 */}
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 60,
        right: 60,
        height: 4,
        background: 'linear-gradient(90deg, transparent, #E0322B, transparent)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 96,
        left: 60,
        right: 60,
        textAlign: 'center',
        fontSize: 34,
        color: WHITE,
        fontWeight: 800,
      }}
    >
      看到惊人数字，先查「原始信源」
    </div>
  </AbsoluteFill>
);
