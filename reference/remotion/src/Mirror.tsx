import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from 'remotion';

/**
 * 《镜子为什么只反左右，不反上下？》· 一般性知识科普短
 * 全部画面由代码（SVG / div + 确定性时间函数）渲染，零视频生成模型、零本地权重。
 * 节奏：24fps，BPM 120（每拍 12 帧），单镜 2.75~3.5s，结论前置。
 *
 * 七条硬规则：禁用 CSS transition/keyframes、禁用 Math.random、禁用 background-clip:text；
 * 单镜样式独立组件限定；绝对定位块做垂直占位核算；文字宽度逐行核算（1080 宽，左右留 64）。
 */

// ---------- 设计系统 ----------
const CYAN = '#38BDF8';     // 镜面 / 信息
const GREEN = '#34D399';    // 真相 / 结论
const YELLOW = '#FBBF24';   // 强调
const PINK = '#F472B6';     // 左右手标记
const WHITE = '#F8FAFC';
const GREY = '#94A3B8';
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

const bg = {
  background: `radial-gradient(120% 90% at 50% 22%, #101A38 0%, #0A0F24 48%, #05070F 100%)`,
  fontFamily: FONT,
};

// 呼吸光晕（保证每镜画面一直在变，避免静止超时）
const Pulse: React.FC<{ color: string; t: number }> = ({ color, t }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(60% 40% at 50% 78%, ${color}22 0%, transparent 70%)`,
      opacity: 0.5 + 0.5 * Math.sin(t * Math.PI * 2),
    }}
  />
);

// 入场（上移 + 淡入），纯时间函数
const rise = (f: number, delay = 0, dur = 14) => {
  const p = interpolate(f, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity: p, transform: `translateY(${(1 - p) * 46}px)` };
};

// 大字光晕（不用 background-clip:text）
const glow = (color: string, blur = 18) => ({
  color: WHITE,
  textShadow: `0 0 ${blur}px ${color}99, 0 0 ${blur * 2}px ${color}55`,
});

// ---------- 复用图形 ----------
// 立镜（正面图用）
const MirrorPanel: React.FC<{ x: number; y: number; h: number }> = ({ x, y, h }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-34} y={0} width={68} height={h} rx={16} fill="#13203E" stroke={CYAN} strokeWidth={4} />
    <rect x={-24} y={12} width={14} height={h - 24} rx={7} fill="#3D5A8F" opacity={0.85} />
    <text x={0} y={h + 40} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={CYAN}>镜</text>
  </g>
);

// 火柴人（正面图）：raiseR = 举右臂
const Figure: React.FC<{ x: number; y: number; s?: number; raiseR?: boolean }> = ({ x, y, s = 1, raiseR = false }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke={WHITE} strokeWidth={7} strokeLinecap="round" fill="none">
    <circle cx={0} cy={0} r={26} fill="#1B2A4D" />
    {/* 躯干 */}
    <line x1={0} y1={26} x2={0} y2={104} />
    {/* 左臂（画面视角的左侧） */}
    <line x1={0} y1={48} x2={-44} y2={92} />
    {/* 右臂 */}
    {raiseR
      ? <line x1={0} y1={48} x2={52} y2={-6} />
      : <line x1={0} y1={48} x2={44} y2={92} />}
    {/* 腿 */}
    <line x1={0} y1={104} x2={-30} y2={158} />
    <line x1={0} y1={104} x2={30} y2={158} />
  </g>
);

// 带标签箭头（正面图用，垂直方向）
const Varrow: React.FC<{ x: number; y: number; len: number; dir: 1 | -1; color: string; label: string }> =
  ({ x, y, len, dir, color, label }) => (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={0} x2={0} y2={len * dir} stroke={color} strokeWidth={10} strokeLinecap="round" />
      <path
        d={dir === 1 ? `M -16 ${len - 26} L 0 ${len} L 16 ${len - 26} Z` : `M -16 ${26 - len} L 0 ${-len} L 16 ${26 - len} Z`}
        fill={color}
      />
      <text x={34} y={dir === 1 ? len / 2 : -len / 2} textAnchor="start" dominantBaseline="middle"
        fontFamily={FONT} fontSize={34} fontWeight={800} fill={color}>{label}</text>
    </g>
  );

// ================= 场景 =================

// S1 钩子
const S1: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 66;
  const head = rise(f, 2, 16);
  const sub = rise(f, 18, 16);
  const flash = 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 4));
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: '26%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 84, fontWeight: 900, lineHeight: 1.22, ...glow(CYAN) }}>
          镜子里的你
        </div>
        <div style={{ ...head, fontSize: 84, fontWeight: 900, lineHeight: 1.22, ...glow(CYAN) }}>
          举起的是哪只手？
        </div>
        <div style={{ ...sub, marginTop: 36, fontSize: 38, color: WHITE, fontWeight: 700, lineHeight: 1.5 }}>
          你明明举的是右手，
          <br />
          镜子里那个「你」举起的却是<span style={{ color: PINK }}>左手</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute', bottom: 130, left: 0, right: 0,
          textAlign: 'center', fontSize: 36, color: YELLOW, fontWeight: 900, opacity: flash,
        }}
      >
        上下从来不反，偏偏左右反？
      </div>
    </AbsoluteFill>
  );
};

// S2 结论前置
const S2: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const txt = rise(f, 2, 16);
  const stampP = spring({ frame: f - 10, fps: 24, config: { damping: 11, stiffness: 120 } });
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={GREEN} t={t} />
      <div style={{ position: 'absolute', top: '26%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...txt, fontSize: 32, color: GREEN, fontWeight: 800, letterSpacing: 3 }}>先说答案</div>
        <div style={{ ...txt, marginTop: 24, fontSize: 86, fontWeight: 900, lineHeight: 1.22, ...glow(GREEN) }}>
          镜子只翻转
          <br />
          「前后」
        </div>
        <div style={{ ...txt, marginTop: 30, fontSize: 38, color: WHITE, fontWeight: 700, lineHeight: 1.6 }}>
          上下没反，左右也没被镜子反——
          <br />
          左右相反，是你<span style={{ color: YELLOW }}>自己转身</span>转出来的
        </div>
      </div>
      <div
        style={{
          position: 'absolute', top: '22%', right: 66, width: 170, height: 170,
          borderRadius: 22, border: `8px solid ${GREEN}`, color: GREEN,
          fontWeight: 900, fontSize: 40, display: 'flex', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', lineHeight: 1.15,
          transform: `rotate(-9deg) scale(${stampP})`, opacity: stampP,
          boxShadow: `0 0 24px ${GREEN}55`,
        }}
      >
        真相
        <br />
        卡
      </div>
      <div style={{ position: 'absolute', bottom: 120, left: 0, right: 0, textAlign: 'center', fontSize: 28, color: GREY }}>
        接下来 3 个实验，自己在家就能做
      </div>
    </AbsoluteFill>
  );
};

// S3 实验一：上下没反（正面图）
const S3: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const bot = rise(f, 40, 14);
  const upP = interpolate(f, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dnP = interpolate(f, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: '13%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 52, fontWeight: 900, ...glow(CYAN) }}>实验一 · 上下没反</div>
      </div>
      <svg width={1080} height={900} viewBox="0 0 1080 900" style={{ position: 'absolute', top: 420 }}>
        {/* 地面 */}
        <line x1={100} y1={760} x2={980} y2={760} stroke="#2A3A5F" strokeWidth={4} />
        {/* 你 */}
        <Figure x={280} y={380} s={1.35} raiseR={true} />
        <text x={280} y={830} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={WHITE}>你（举右手）</text>
        {/* 镜子 */}
        <MirrorPanel x={760} y={140} h={620} />
        {/* 镜中人（水平翻转的像） */}
        <g transform="translate(760 0) scale(-1 1) translate(-760 0)">
          <Figure x={940} y={380} s={1.35} raiseR={true} />
        </g>
        <text x={940} y={830} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={GREY}>镜中的你</text>
        {/* 上下箭头：两边同向 */}
        <g opacity={upP}><Varrow x={120} y={330} len={110} dir={-1} color={YELLOW} label="头" />
          <Varrow x={600} y={330} len={110} dir={-1} color={YELLOW} label="头" /></g>
        <g opacity={dnP}><Varrow x={120} y={430} len={110} dir={1} color={CYAN} label="脚" />
          <Varrow x={600} y={430} len={110} dir={1} color={CYAN} label="脚" /></g>
      </svg>
      <div style={{ ...bot, position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 38, color: WHITE, fontWeight: 800 }}>
        头还是头，脚还是脚——<span style={{ color: YELLOW }}>上下没被翻转</span>
      </div>
    </AbsoluteFill>
  );
};

// S4 实验二：前后被翻（俯视图）
const S4: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const bot = rise(f, 44, 14);
  const p = interpolate(f, [12, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 你的鼻尖方向箭头（指向镜子），镜中像的箭头反向指回
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: '13%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 52, fontWeight: 900, ...glow(CYAN) }}>实验二 · 俯视图看「前后」</div>
      </div>
      <svg width={1080} height={760} viewBox="0 0 1080 760" style={{ position: 'absolute', top: 480 }}>
        {/* 镜面（俯视：一条竖线） */}
        <rect x={820} y={60} width={26} height={560} rx={10} fill="#13203E" stroke={CYAN} strokeWidth={4} />
        <text x={833} y={680} textAnchor="middle" fontFamily={FONT} fontSize={32} fontWeight={800} fill={CYAN}>镜面（俯视）</text>
        {/* 你（俯视：圆头 + 鼻尖） */}
        <circle cx={300} cy={340} r={64} fill="#1B2A4D" stroke={WHITE} strokeWidth={5} />
        <circle cx={330} cy={340} r={12} fill={WHITE} />
        <text x={300} y={470} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={WHITE}>你</text>
        {/* 你的朝向箭头：指向镜子 */}
        <g opacity={p}>
          <line x1={380} y1={340} x2={380 + 300 * p} y2={340} stroke={YELLOW} strokeWidth={12} strokeLinecap="round" />
          <path d={`M ${380 + 300 * p - 6} 316 L ${380 + 300 * p + 26} 340 L ${380 + 300 * p - 6} 364 Z`} fill={YELLOW} />
        </g>
        {/* 镜中像的朝向箭头：反向指回 */}
        <g opacity={p}>
          <line x1={790} y1={200} x2={790 - 240 * p} y2={200} stroke={PINK} strokeWidth={12} strokeLinecap="round" />
          <path d={`M ${790 - 240 * p + 6} 176 L ${790 - 240 * p - 26} 200 L ${790 - 240 * p + 6} 224 Z`} fill={PINK} />
          <text x={640} y={130} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={PINK}>镜中的你，朝向反了</text>
        </g>
      </svg>
      <div style={{ ...bot, position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 38, color: WHITE, fontWeight: 800, lineHeight: 1.5 }}>
        唯一被翻转的方向：
        <span style={{ color: YELLOW }}>垂直于镜面的「前后」</span>
      </div>
    </AbsoluteFill>
  );
};

// S5 关键一步：左右反 = 你转身
const S5: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const bot = rise(f, 52, 14);
  const ang = interpolate(f, [14, 64], [180, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const L = 190;
  const cx = 540, cy = 400;
  const rad = (ang * Math.PI) / 180;
  const nx = cx + L * Math.sin(rad); // 鼻尖方向
  const ny = cy - L * Math.cos(rad);
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={YELLOW} t={t} />
      <div style={{ position: 'absolute', top: '12%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 52, fontWeight: 900, ...glow(YELLOW) }}>那左右为什么「反」了？</div>
      </div>
      <svg width={1080} height={720} viewBox="0 0 1080 720" style={{ position: 'absolute', top: 470 }}>
        {/* 镜面（俯视，画面上方） */}
        <rect x={140} y={60} width={800} height={26} rx={10} fill="#13203E" stroke={CYAN} strokeWidth={4} />
        <text x={540} y={40} textAnchor="middle" fontFamily={FONT} fontSize={32} fontWeight={800} fill={CYAN}>镜面（俯视）</text>
        {/* 转身轨迹 */}
        <circle cx={cx} cy={cy} r={L} fill="none" stroke="#2A3A5F" strokeWidth={4} strokeDasharray="14 12" />
        {/* 你（俯视） */}
        <circle cx={cx} cy={cy} r={62} fill="#1B2A4D" stroke={WHITE} strokeWidth={5} />
        <circle cx={cx} cy={cy} r={11} fill={WHITE} />
        {/* 鼻尖方向箭头（随时间旋转 180°） */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={YELLOW} strokeWidth={12} strokeLinecap="round" />
        <circle cx={nx} cy={ny} r={16} fill={YELLOW} />
        {/* 左右手标记 */}
        <text x={cx - 110} y={cy + 90} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={900} fill={PINK}>左</text>
        <text x={cx + 110} y={cy + 90} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={900} fill={PINK}>右</text>
        <text x={cx} y={cy + 210} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={800} fill={WHITE}>
          绕「上下轴」转身 180° 面对镜子
        </text>
      </svg>
      <div style={{ ...bot, position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 40, color: WHITE, fontWeight: 900 }}>
        转身这一下，你的<span style={{ color: PINK }}>左右互换了位置</span>
      </div>
    </AbsoluteFill>
  );
};

// S6 反证：换转轴，反的就是上下
const S6: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const bot = rise(f, 52, 14);
  const pL = interpolate(f, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pR = interpolate(f, [30, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: '12%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 48, fontWeight: 900, ...glow(CYAN) }}>反证 · 换个方式面对镜子</div>
      </div>
      {/* 两个对照面板 */}
      <div style={{ position: 'absolute', top: 430, left: 64, right: 64, display: 'flex', gap: 36 }}>
        <div style={{ ...pL, flex: 1, background: '#0E1830', borderRadius: 28, border: '3px solid #22345C', padding: '36px 24px', textAlign: 'center' }}>
          <svg width={440} height={330} viewBox="0 0 440 330">
            <Figure x={220} y={60} s={1.1} raiseR={true} />
          </svg>
          <div style={{ fontSize: 32, color: WHITE, fontWeight: 800, marginTop: 8 }}>站着转身面对镜子</div>
          <div style={{ fontSize: 30, color: PINK, fontWeight: 900, marginTop: 10 }}>反的是 → 左右</div>
        </div>
        <div style={{ ...pR, flex: 1, background: '#0E1830', borderRadius: 28, border: '3px solid #22345C', padding: '36px 24px', textAlign: 'center' }}>
          <svg width={440} height={330} viewBox="0 0 440 330">
            {/* 躺姿（头朝镜面方向倒下去） */}
            <g transform="translate(220 190) rotate(90)" stroke={WHITE} strokeWidth={7} strokeLinecap="round" fill="none">
              <circle cx={0} cy={-80} r={26} fill="#1B2A4D" />
              <line x1={0} y1={-54} x2={0} y2={24} />
              <line x1={0} y1={-32} x2={-40} y2={12} />
              <line x1={0} y1={-32} x2={40} y2={12} />
              <line x1={0} y1={24} x2={-26} y2={78} />
              <line x1={0} y1={24} x2={26} y2={78} />
            </g>
            <text x={220} y={315} textAnchor="middle" fontFamily={FONT} fontSize={28} fontWeight={800} fill={GREY}>（头朝前翻过去看镜子）</text>
          </svg>
          <div style={{ fontSize: 32, color: WHITE, fontWeight: 800, marginTop: 8 }}>头朝前翻过去面对镜子</div>
          <div style={{ fontSize: 30, color: YELLOW, fontWeight: 900, marginTop: 10 }}>反的是 → 上下</div>
        </div>
      </div>
      <div style={{ ...bot, position: 'absolute', bottom: 100, left: 64, right: 64, textAlign: 'center', fontSize: 36, color: WHITE, fontWeight: 800, lineHeight: 1.5 }}>
        镜子没变，变的是<span style={{ color: YELLOW }}>你自己旋转的轴</span>
      </div>
    </AbsoluteFill>
  );
};

// S7 透明纸实验
const S7: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const bot = rise(f, 48, 14);
  const pR = interpolate(f, [22, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: '12%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 48, fontWeight: 900, ...glow(CYAN) }}>实验三 · 透明纸写字</div>
      </div>
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 90 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 240, height: 240, borderRadius: 26, background: '#F4F6FB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 150, fontWeight: 900, color: '#E0322B', fontFamily: FONT,
          }}>F</div>
          <div style={{ marginTop: 22, fontSize: 32, color: WHITE, fontWeight: 800 }}>正面朝镜子举起</div>
        </div>
        <div style={{ fontSize: 70, color: GREY, fontWeight: 900, opacity: 0.7 }}>→</div>
        <div style={{ textAlign: 'center', opacity: pR }}>
          <div style={{
            width: 240, height: 240, borderRadius: 26, background: '#13203E',
            border: `4px solid ${CYAN}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 150, fontWeight: 900, color: CYAN, fontFamily: FONT,
            transform: 'scaleX(-1)',
            boxShadow: `0 0 30px ${CYAN}44`,
          }}>F</div>
          <div style={{ marginTop: 22, fontSize: 32, color: CYAN, fontWeight: 800 }}>镜中：左右反了</div>
        </div>
      </div>
      <div style={{ ...bot, position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 36, color: WHITE, fontWeight: 700, lineHeight: 1.55 }}>
        把纸翻过来从背面看，就是镜中的样子——
        <br />
        <span style={{ color: YELLOW }}>「翻纸」这一下，就是你「转身」那一下</span>
      </div>
    </AbsoluteFill>
  );
};

// S8 大字收口
const S8: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 4, 18);
  const sub = rise(f, 26, 16);
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={GREEN} t={t} />
      <div style={{ position: 'absolute', top: '30%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 96, fontWeight: 900, lineHeight: 1.25, ...glow(GREEN) }}>
          镜像 = 前后翻转
        </div>
        <div style={{ ...sub, marginTop: 34, fontSize: 38, color: WHITE, fontWeight: 700, lineHeight: 1.6 }}>
          不是镜子翻了左右，
          <br />
          是<span style={{ color: YELLOW }}>你转身</span>换了左右
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S9 生活应用：救护车反字
const S9: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const mid = rise(f, 20, 16);
  const bot = rise(f, 50, 14);
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: '12%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 48, fontWeight: 900, ...glow(CYAN) }}>生活里早就用上了</div>
      </div>
      <div style={{ position: 'absolute', top: 480, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...mid, fontSize: 88, fontWeight: 900, color: WHITE, fontFamily: FONT, letterSpacing: 4, transform: 'scaleX(-1)' }}>
          AMBULANCE
        </div>
        <div style={{ ...mid, marginTop: 14, fontSize: 32, color: GREY, fontWeight: 700 }}>车身上印的是「反字」</div>
        <div style={{ ...mid, marginTop: 40, fontSize: 60, fontWeight: 900, color: CYAN, letterSpacing: 4 }}>AMBULANCE</div>
        <div style={{ ...mid, marginTop: 14, fontSize: 32, color: CYAN, fontWeight: 800 }}>前车后视镜里，看到的刚好是正的</div>
      </div>
      <div style={{ ...bot, position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 34, color: WHITE, fontWeight: 700 }}>
        后视镜翻转「前后」，反字正好抵消
      </div>
    </AbsoluteFill>
  );
};

// S10 方法论收口
const S10: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 16);
  const sub = rise(f, 20, 16);
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={YELLOW} t={t} />
      <div style={{ position: 'absolute', top: '30%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 68, fontWeight: 900, lineHeight: 1.3, ...glow(YELLOW) }}>
          遇到反直觉的事，
          <br />
          先问一句：
        </div>
        <div style={{ ...sub, marginTop: 30, fontSize: 60, fontWeight: 900, color: YELLOW }}>
          「参照物换了吗？」
        </div>
        <div style={{ ...sub, marginTop: 26, fontSize: 34, color: WHITE, fontWeight: 700, lineHeight: 1.6 }}>
          很多「反常」，只是你默认的参照系错了
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S11 结尾卡
const S11: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 54;
  const title = rise(f, 2, 16);
  const cta = rise(f, 22, 14);
  // 小镜子图形
  const mp = spring({ frame: f - 6, fps: 24, config: { damping: 12, stiffness: 100 } });
  return (
    <AbsoluteFill style={bg}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: mp, transform: `scale(${mp})` }}>
        <svg width={200} height={260} viewBox="0 0 200 260">
          <rect x={50} y={10} width={100} height={200} rx={20} fill="#13203E" stroke={CYAN} strokeWidth={5} />
          <rect x={64} y={24} width={18} height={172} rx={9} fill="#3D5A8F" opacity={0.85} />
          <rect x={70} y={225} width={60} height={18} rx={8} fill="#22345C" />
        </svg>
      </div>
      <div style={{ position: 'absolute', top: '44%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...title, fontSize: 56, fontWeight: 900, ...glow(CYAN) }}>镜子只翻转「前后」</div>
        <div style={{ ...title, marginTop: 14, fontSize: 42, fontWeight: 800, color: GREEN }}>左右相反，是你转身的错觉</div>
      </div>
      <div style={{ position: 'absolute', bottom: 240, left: 0, right: 0, textAlign: 'center', fontSize: 28, color: GREY, lineHeight: 1.5 }}>
        一般知识科普 · 纯代码可视化系列
      </div>
      <div style={{ ...cta, position: 'absolute', bottom: 140, left: 0, right: 0, textAlign: 'center', fontSize: 36, color: WHITE, fontWeight: 800 }}>
        关注我 · 每天一个反直觉的真相
      </div>
    </AbsoluteFill>
  );
};

// ================= 时间轴 =================
// BPM 120 → 每拍 12 帧 @24fps。单镜 66~84 帧（2.75~3.5s）。总 876 帧 = 36.5s。
export const Mirror: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#05070F' }}>
      <Sequence from={0} durationInFrames={66}><S1 /></Sequence>
      <Sequence from={66} durationInFrames={84}><S2 /></Sequence>
      <Sequence from={150} durationInFrames={84}><S3 /></Sequence>
      <Sequence from={234} durationInFrames={84}><S4 /></Sequence>
      <Sequence from={318} durationInFrames={84}><S5 /></Sequence>
      <Sequence from={402} durationInFrames={84}><S6 /></Sequence>
      <Sequence from={486} durationInFrames={84}><S7 /></Sequence>
      <Sequence from={570} durationInFrames={84}><S8 /></Sequence>
      <Sequence from={654} durationInFrames={84}><S9 /></Sequence>
      <Sequence from={738} durationInFrames={84}><S10 /></Sequence>
      <Sequence from={822} durationInFrames={54}><S11 /></Sequence>
    </AbsoluteFill>
  );
};
