import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from 'remotion';

/**
 * 鹈鹕骑自行车（动画版）—— 纯代码 SVG，零视频生成模型
 *
 * 这就是 Simon Willison 那个 "pelican riding a bicycle" 基准的动画形态：
 * 提示词只有一句 "Generate an SVG of a pelican riding a bicycle, with animation"，
 * 模型直接写出可运行的矢量动画，浏览器渲染。没有任何扩散模型参与。
 *
 * 它考的是**能不能用数学表达运动**：
 *   - 车轮自转（辐条角速度 = 线速度 / 半径）
 *   - 踏板圆周运动（曲柄角速度）
 *   - 腿的 IK：脚固定在踏板上，膝盖位置由两段骨骼的长度约束反解
 *   - 身体随踩踏起伏（与曲柄同频）
 *   - 背景滚动（速度与轮速匹配，否则会"打滑"）
 *
 * 这些用代码写是确定的、可复现的；用扩散模型只会得到"大概在动"的糊影。
 */

const W = 1080, H = 1080, FPS = 24, DUR = 120;   // 5 秒

// 两段骨骼 IK：给定髋与脚，反解膝盖
function solveKnee(hip: {x:number;y:number}, foot: {x:number;y:number}, L1: number, L2: number) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.5);
  const base = Math.atan2(dy, dx);
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const a = base - A;                      // 膝盖朝前弯
  return { x: hip.x + L1 * Math.cos(a), y: hip.y + L1 * Math.sin(a) };
}

export const PelicanBike: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;                   // 秒

  const wheelR = 150;
  const rearW = { x: 380, y: 760 };
  const frontW = { x: 700, y: 760 };
  const crank = { x: 540, y: 745 };        // 中轴
  const crankR = 42;
  const speed = 1.6;                       // 弧度/秒（轮）
  const wheelAng = t * speed * 2.4;
  const crankAng = t * speed * 2.4 * (wheelR / crankR) * 0.18; // 传动比压缩，视觉更稳

  // 踏板
  const pedal = (phase: number) => ({
    x: crank.x + Math.cos(crankAng + phase) * crankR,
    y: crank.y + Math.sin(crankAng + phase) * crankR,
  });
  const footR = pedal(0), footL = pedal(Math.PI);

  // 髋（鸟身下方），左右腿各一个略偏的髋
  const hipR = { x: 505, y: 620 };
  const hipL = { x: 520, y: 618 };
  const kneeR = solveKnee(hipR, footR, 92, 96);
  const kneeL = solveKnee(hipL, footL, 92, 96);

  // 身体随踩踏起伏，与曲柄同频（踩到底时身体略沉）
  const bob = Math.sin(crankAng * 2) * 5;
  const bodyY = 600 + bob;

  // 背景滚动：与轮速匹配，避免"打滑"
  const scroll = (t * speed * 2.4 * wheelR) % 160;

  const spokes = (cx: number, cy: number, ang: number) => {
    const out = [];
    for (let i = 0; i < 8; i++) {
      const a = ang + (i * Math.PI) / 4;
      out.push(
        <line key={i}
              x1={cx} y1={cy}
              x2={cx + Math.cos(a) * (wheelR - 14)}
              y2={cy + Math.sin(a) * (wheelR - 14)}
              stroke="#2E4A5A" strokeWidth={3} strokeOpacity={0.55} />
      );
    }
    return out;
  };

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#FFE9C9 0%,#FFD3A0 46%,#F7B77E 100%)' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* 太阳 */}
        <circle cx={860} cy={250} r={92} fill="#FFC46B" opacity={0.55} />
        <circle cx={860} cy={250} r={62} fill="#FFB347" opacity={0.75} />

        {/* 远山 */}
        <path d="M0 700 L180 520 L330 700 Z" fill="#E7A97B" opacity={0.55} />
        <path d="M250 700 L470 470 L700 700 Z" fill="#DE9A6C" opacity={0.5} />
        <path d="M640 700 L840 500 L1080 700 Z" fill="#E7A97B" opacity={0.45} />

        {/* 地面 */}
        <rect x={0} y={880} width={W} height={200} fill="#C98A5E" opacity={0.35} />
        <line x1={0} y1={880} x2={W} y2={880} stroke="#B8794E" strokeWidth={5} opacity={0.6} />

        {/* 滚动的地面标线：与轮速匹配 */}
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={i * 160 - scroll} y={930} width={70} height={10} rx={5}
                fill="#B8794E" opacity={0.45} />
        ))}

        {/* 车架 */}
        <g stroke="#1F6E7A" strokeWidth={13} strokeLinecap="round" fill="none">
          <line x1={rearW.x} y1={rearW.y} x2={crank.x} y2={crank.y} />
          <line x1={crank.x} y1={crank.y} x2={frontW.x} y2={frontW.y - 40} />
          <line x1={crank.x} y1={crank.y} x2={520} y2={648} />
          <line x1={520} y1={648} x2={rearW.x} y2={rearW.y} />
          <line x1={frontW.x} y1={frontW.y - 40} x2={700} y2={560} />
        </g>
        {/* 车把 / 车座 */}
        <line x1={700} y1={560} x2={742} y2={548} stroke="#1F6E7A" strokeWidth={13} strokeLinecap="round" />
        <line x1={500} y1={612} x2={540} y2={606} stroke="#1F6E7A" strokeWidth={13} strokeLinecap="round" />

        {/* 车轮 */}
        {[rearW, frontW].map((w, i) => (
          <g key={i}>
            <circle cx={w.x} cy={w.y} r={wheelR} fill="none" stroke="#12414A" strokeWidth={13} />
            <circle cx={w.x} cy={w.y} r={wheelR - 12} fill="none" stroke="#2E4A5A" strokeWidth={3} strokeOpacity={0.5} />
            {spokes(w.x, w.y, wheelAng)}
            <circle cx={w.x} cy={w.y} r={13} fill="#12414A" />
          </g>
        ))}

        {/* 曲柄 + 踏板 */}
        <line x1={crank.x} y1={crank.y} x2={footR.x} y2={footR.y} stroke="#12414A" strokeWidth={9} strokeLinecap="round" />
        <circle cx={crank.x} cy={crank.y} r={16} fill="#12414A" />
        <rect x={footR.x - 18} y={footR.y - 5} width={36} height={11} rx={5} fill="#12414A" />
        <rect x={footL.x - 18} y={footL.y - 5} width={36} height={11} rx={5} fill="#12414A" />

        {/* 后腿（在身体后面） */}
        <g stroke="#E8833A" strokeWidth={12} strokeLinecap="round" fill="none">
          <line x1={hipL.x} y1={hipL.y} x2={kneeL.x} y2={kneeL.y} />
          <line x1={kneeL.x} y1={kneeL.y} x2={footL.x} y2={footL.y} />
        </g>

        {/* 鹈鹕身体 */}
        <ellipse cx={560} cy={bodyY} rx={128} ry={92} fill="#FDF6EC" stroke="#D9C7B2" strokeWidth={3} />
        {/* 尾巴 */}
        <path d={`M ${436} ${bodyY + 6} L 372 ${bodyY - 26} L 392 ${bodyY + 34} Z`}
              fill="#F3E8D9" stroke="#D9C7B2" strokeWidth={3} />
        {/* 翅膀 */}
        <path d={`M 500 ${bodyY - 30} Q 590 ${bodyY - 78} 660 ${bodyY - 6} Q 590 ${bodyY + 26} 500 ${bodyY - 30} Z`}
              fill="#F0E3D2" stroke="#D9C7B2" strokeWidth={3} />

        {/* 脖子 + 头 */}
        <path d={`M 640 ${bodyY - 40} Q 700 ${bodyY - 120} 690 ${bodyY - 186}`}
              fill="none" stroke="#FDF6EC" strokeWidth={46} strokeLinecap="round" />
        <path d={`M 640 ${bodyY - 40} Q 700 ${bodyY - 120} 690 ${bodyY - 186}`}
              fill="none" stroke="#D9C7B2" strokeWidth={46} strokeLinecap="round" strokeOpacity={0.0} />
        <circle cx={690} cy={bodyY - 196} r={40} fill="#FDF6EC" stroke="#D9C7B2" strokeWidth={3} />

        {/* 喙：鹈鹕的标志，下喙带喉囊 */}
        <path d={`M 718 ${bodyY - 214} L 900 ${bodyY - 196} L 726 ${bodyY - 178} Z`}
              fill="#F5A623" stroke="#D98A12" strokeWidth={3} />
        <path d={`M 726 ${bodyY - 180} Q 800 ${bodyY - 128} 892 ${bodyY - 192}`}
              fill="#FFC65C" stroke="#D98A12" strokeWidth={3} opacity={0.92} />
        {/* 眼睛 */}
        <circle cx={700} cy={bodyY - 206} r={7.5} fill="#22333B" />
        <circle cx={702.5} cy={bodyY - 208.5} r={2.4} fill="#FFFFFF" />

        {/* 前腿（在身体前面） */}
        <g stroke="#F5A623" strokeWidth={12} strokeLinecap="round" fill="none">
          <line x1={hipR.x} y1={hipR.y} x2={kneeR.x} y2={kneeR.y} />
          <line x1={kneeR.x} y1={kneeR.y} x2={footR.x} y2={footR.y} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const PELICAN_DUR = DUR;
export const PELICAN_FPS = FPS;
