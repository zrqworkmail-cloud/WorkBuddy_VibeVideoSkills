import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from 'remotion';

/**
 * 老干妈 AI 裁员传闻 · 辟谣科普短（高密度版）
 * 题材：抖音热搜 2026-10-26「老干妈 AI 裁员传闻引争议」——官方否认，2025 营收 54 亿创历史新高。
 * 全部画面由代码（SVG / div + 确定性时间函数）渲染，零视频生成模型、零本地权重。
 * 节奏：24fps，BPM 120（每拍 12 帧），单镜 2.5~3.5s，结论前置。
 *
 * 七条硬规则：禁用 CSS transition/keyframes、禁用 Math.random、禁用 background-clip:text；
 * 单镜样式用 #sN 限定；绝对定位块做垂直占位核算；逐字动画时样式挂每字。
 */

// ---------- 设计系统 ----------
const RED = '#E0322B';      // 老干妈红 / 谣言警示
const GREEN = '#34D399';    // 真相
const YELLOW = '#FBBF24';   // 强调
const CYAN = '#38BDF8';     // 信息
const WHITE = '#F8FAFC';
const GREY = '#94A3B8';
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

const bg = (accent: string) => ({
  background: `radial-gradient(120% 90% at 50% 22%, #0E1530 0%, #0A0F1E 48%, #05070F 100%)`,
  fontFamily: FONT,
});

// 呼吸光晕（保证每镜画面一直在变，避免静止超时）
const Pulse: React.FC<{ color: string; t: number }> = ({ color, t }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(60% 40% at 50% 78%, ${color}22 0%, transparent 70%)`,
      opacity: 0.5 + 0.5 * Math.sin(t * Math.PI * 2),
    }}
  />
);

// 顶部「热点来源」标签
const SourceTag: React.FC<{ t: number }> = ({ t }) => (
  <div
    style={{
      position: 'absolute',
      top: 56,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: FONT,
      color: GREY,
      fontSize: 26,
      letterSpacing: 2,
      opacity: 0.9,
    }}
  >
    <span style={{ color: RED, fontWeight: 800 }}>● </span>
    2026/10/26
  </div>
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

// ---------- 复用图形：辣椒罐 ----------
const Jar: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    {/* 罐盖 */}
    <rect x={52} y={20} width={96} height={26} rx={8} fill="#C9CDD6" />
    <rect x={52} y={20} width={96} height={10} rx={5} fill="#E6E9F0" />
    {/* 罐身 */}
    <rect x={44} y={46} width={112} height={128} rx={18} fill="#F4F6FB" stroke="#D7DCE6" strokeWidth={3} />
    {/* 红标 */}
    <rect x={58} y={74} width={84} height={74} rx={10} fill={RED} />
    <text x={100} y={112} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill="#FFF">
      老干妈
    </text>
    {/* 辣椒图标 */}
    <g transform="translate(100 140)">
      <path d="M -22 0 Q 0 -16 22 0 Q 0 14 -22 0 Z" fill="#FF6B35" />
      <path d="M 18 -6 q 10 -10 16 -4" stroke="#3FA34D" strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  </svg>
);

// ================= 场景 =================

// S1 钩子：谣言
const S1: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 66;
  const head = rise(f, 2, 16);
  const sub = rise(f, 18, 16);
  const flash = 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 4));
  return (
    <AbsoluteFill style={bg(RED)}>
      <Pulse color={RED} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '30%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 30, color: RED, fontWeight: 800, letterSpacing: 3 }}>网传</div>
        <div style={{ ...head, marginTop: 18, fontSize: 76, fontWeight: 900, lineHeight: 1.18, ...glow(RED) }}>
          老干妈用 AI
        </div>
        <div style={{ ...head, fontSize: 76, fontWeight: 900, lineHeight: 1.18, ...glow(RED) }}>
          裁掉 552 人？
        </div>
        <div style={{ ...sub, marginTop: 34, fontSize: 38, color: WHITE, fontWeight: 700 }}>
          600 名拣椒工 → 只剩 48 人
        </div>
        <div style={{ ...sub, marginTop: 10, fontSize: 30, color: GREY }}>
          这条消息，是真的吗？
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 40,
          color: YELLOW,
          fontWeight: 900,
          opacity: flash,
        }}
      >
        ❗ 先别急着转
      </div>
    </AbsoluteFill>
  );
};

// S2 官方辟谣（盖章）
const S2: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const stampP = spring({ frame: f - 6, fps: 24, config: { damping: 11, stiffness: 120 } });
  const rot = interpolate(stampP, [0, 1], [-22, -8]);
  const stampO = interpolate(stampP, [0, 1], [0, 1]);
  const txt = rise(f, 2, 16);
  return (
    <AbsoluteFill style={bg(GREEN)}>
      <Pulse color={GREEN} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '28%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...txt, fontSize: 30, color: GREEN, fontWeight: 800, letterSpacing: 3 }}>10 月 26 日 · 官方回应</div>
        <div style={{ ...txt, marginTop: 22, fontSize: 80, fontWeight: 900, lineHeight: 1.2, ...glow(GREEN) }}>
          不实信息
        </div>
        <div style={{ ...txt, marginTop: 26, fontSize: 40, color: WHITE, fontWeight: 700 }}>
          老干妈热线：公司从未发布
        </div>
        <div style={{ ...txt, fontSize: 40, color: WHITE, fontWeight: 700 }}>任何「AI 裁员」通知</div>
      </div>
      {/* 盖章动画 */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          right: 70,
          width: 200,
          height: 200,
          borderRadius: 24,
          border: `8px solid ${RED}`,
          color: RED,
          fontWeight: 900,
          fontSize: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          lineHeight: 1.1,
          transform: `rotate(${rot}deg) scale(${stampP})`,
          opacity: stampO,
          boxShadow: `0 0 26px ${RED}66`,
        }}
      >
        辟谣
        <br />
        不实
      </div>
      <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, textAlign: 'center', fontSize: 28, color: GREY }}>
        来源：蓝鲸新闻求证 · 老干妈官方热线
      </div>
    </AbsoluteFill>
  );
};

// S3 营收 54 亿 计数
const S3: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const num = Math.round(interpolate(f, [8, 70], [0, 54], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const head = rise(f, 2, 16);
  const sub = rise(f, 60, 16);
  return (
    <AbsoluteFill style={bg(YELLOW)}>
      <Pulse color={YELLOW} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '26%', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 34, color: YELLOW, fontWeight: 800, letterSpacing: 2 }}>同一家公司 · 反直觉</div>
        <div style={{ marginTop: 18, fontSize: 230, fontWeight: 900, lineHeight: 1, ...glow(YELLOW) }}>
          {num}
          <span style={{ fontSize: 80, color: WHITE }}> 亿</span>
        </div>
        <div style={{ ...sub, marginTop: 10, fontSize: 42, color: WHITE, fontWeight: 800 }}>
          2025 年营收 · 创历史新高
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 120, left: 64, right: 64, textAlign: 'center', fontSize: 30, color: GREY, lineHeight: 1.5 }}>
        一边传「大幅裁员」，一边营收冲顶——
        <br />
        这两件事，很难同时发生。
      </div>
    </AbsoluteFill>
  );
};

// S4 自动化分拣线（SVG）
const S4: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 16);
  const sub = rise(f, 16, 16);
  // 传送带 + 辣椒流动 + 机械臂
  const beltX = (f % 48) / 48; // 0..1 循环
  const arm = Math.sin(t * Math.PI * 3) * 14;
  return (
    <AbsoluteFill style={bg(CYAN)}>
      <Pulse color={CYAN} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '22%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 32, color: CYAN, fontWeight: 800 }}>为什么谣言「像真的」</div>
        <div style={{ ...head, marginTop: 14, fontSize: 56, fontWeight: 900, ...glow(CYAN) }}>车间确有自动化</div>
      </div>
      <svg width={1080} height={560} viewBox="0 0 1080 560" style={{ position: 'absolute', top: 540 }}>
        {/* 传送带 */}
        <rect x={120} y={360} width={840} height={40} rx={8} fill="#1F2A44" />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 160 + ((beltX * 160 + i * 160) % 840);
          return <circle key={i} cx={x} cy={380} r={16} fill={RED} opacity={0.9} />;
        })}
        {/* 机械臂 */}
        <g transform={`translate(540 200) rotate(${arm})`}>
          <rect x={-10} y={0} width={20} height={150} rx={8} fill="#7C8AA5" />
          <circle cx={0} cy={0} r={22} fill={CYAN} />
          <rect x={-46} y={-30} width={92} height={40} rx={10} fill="#9FB0CC" />
        </g>
        {/* 分拣框 */}
        <rect x={780} y={250} width={180} height={120} rx={12} fill="#16203A" stroke={CYAN} strokeWidth={3} />
        <text x={870} y={320} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={CYAN}>分拣</text>
      </svg>
      <div style={{ position: 'absolute', bottom: 120, left: 64, right: 64, textAlign: 'center', fontSize: 38, color: WHITE, fontWeight: 800 }}>
        自动化 ≠ 裁员
      </div>
    </AbsoluteFill>
  );
};

// S5 产能↑ 用工↑ 三箭头
const S5: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 16);
  const a = interpolate(f, [10, 60], [0.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b = interpolate(f, [22, 72], [0.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c = interpolate(f, [34, 84], [0.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const Arrow = ({ y, label, color, p }: { y: number; label: string; color: string; p: number }) => (
    <g opacity={p} transform={`translate(0 ${y})`}>
      <line x1={200} y1={0} x2={200 + 620 * p} y2={0} stroke={color} strokeWidth={14} strokeLinecap="round" />
      <path d={`M ${200 + 620 * p} -16 L ${200 + 660 * p} 0 L ${200 + 620 * p} 16 Z`} fill={color} />
      <text x={180} y={10} textAnchor="end" fontFamily={FONT} fontSize={40} fontWeight={800} fill={WHITE}>{label}</text>
    </g>
  );
  return (
    <AbsoluteFill style={bg(GREEN)}>
      <Pulse color={GREEN} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '20%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 32, color: GREEN, fontWeight: 800 }}>产能涨了，人会变少吗？</div>
      </div>
      <svg width={1080} height={620} viewBox="0 0 1080 620" style={{ position: 'absolute', top: 620 }}>
        <Arrow y={120} label="自动化" color={CYAN} p={a} />
        <Arrow y={300} label="产能" color={YELLOW} p={b} />
        <Arrow y={480} label="一线用工" color={GREEN} p={c} />
      </svg>
      <div style={{ position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 34, color: WHITE, fontWeight: 700, lineHeight: 1.5 }}>
        产量扩大，一线岗位往往<span style={{ color: GREEN }}>同步扩招</span>
        <br />
        被替代的是「重复动作」，不是「人」
      </div>
    </AbsoluteFill>
  );
};

// S6 AI 影响的任务（列表）
const S6: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const items = ['数据录入 / 报表整理', '基础客服话术', '模板化文案', '重复质检抽样'];
  return (
    <AbsoluteFill style={bg(CYAN)}>
      <Pulse color={CYAN} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '20%', left: 80, right: 80 }}>
        <div style={{ ...head, fontSize: 40, fontWeight: 900, color: WHITE, lineHeight: 1.25, ...glow(CYAN) }}>
          真正被 AI 啃掉的，
          <br />
          是这些「任务」
        </div>
        {items.map((it, i) => {
          const p = interpolate(f, [14 + i * 14, 30 + i * 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div
              key={i}
              style={{
                marginTop: 26,
                opacity: p,
                transform: `translateX(${(1 - p) * 50}px)`,
                fontSize: 40,
                color: WHITE,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ color: CYAN, fontWeight: 900, marginRight: 16 }}>›</span>
              {it}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, textAlign: 'center', fontSize: 28, color: GREY }}>
        它们有个共同点：规则明确、重复发生
      </div>
    </AbsoluteFill>
  );
};

// S7 大字：替代任务，不是岗位
const S7: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 4, 18);
  const sub = rise(f, 26, 16);
  return (
    <AbsoluteFill style={bg(YELLOW)}>
      <Pulse color={YELLOW} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '32%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 92, fontWeight: 900, lineHeight: 1.2, ...glow(YELLOW) }}>
          AI 替代的
        </div>
        <div style={{ ...head, fontSize: 92, fontWeight: 900, lineHeight: 1.2, ...glow(YELLOW) }}>
          是「任务」
        </div>
        <div style={{ ...head, fontSize: 92, fontWeight: 900, lineHeight: 1.2, color: RED, textShadow: `0 0 18px ${RED}99` }}>
          不是「岗位」
        </div>
        <div style={{ ...sub, marginTop: 30, fontSize: 34, color: WHITE, fontWeight: 700 }}>
          把岗位整个删掉，是管理决策，不是 AI 的默认结果
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S8 高风险岗位（条形）
const S8: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const rows = [
    { label: '数据录入', v: 0.92 },
    { label: '基础客服', v: 0.8 },
    { label: '模板文案', v: 0.7 },
  ];
  return (
    <AbsoluteFill style={{ ...bg(RED), background: `radial-gradient(120% 90% at 50% 18%, #2A0E12 0%, #160A0E 50%, #0A0507 100%)` }}>
      <Pulse color={RED} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '18%', left: 80, right: 80 }}>
        <div style={{ ...head, fontSize: 36, fontWeight: 900, color: RED }}>被替代风险「高」的岗位</div>
        {rows.map((r, i) => {
          const p = interpolate(f, [12 + i * 14, 40 + i * 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ marginTop: 22 }}>
              <div style={{ fontSize: 32, color: WHITE, fontWeight: 700 }}>{r.label}</div>
              <div style={{ marginTop: 8, height: 26, background: '#241016', borderRadius: 13, overflow: 'hidden' }}>
                <div style={{ width: `${r.v * 100 * p}%`, height: '100%', background: RED, borderRadius: 13, boxShadow: `0 0 16px ${RED}88` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 110, left: 64, right: 64, textAlign: 'center', fontSize: 28, color: GREY }}>
        注意：是「风险」，不是「已经消失」
      </div>
    </AbsoluteFill>
  );
};

// S9 低风险岗位（罐 + 手感）
const S9: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 14);
  const jarP = spring({ frame: f - 6, fps: 24, config: { damping: 12, stiffness: 100 } });
  const txt = rise(f, 18, 16);
  return (
    <AbsoluteFill style={bg(GREEN)}>
      <Pulse color={GREEN} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '16%', left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 36, fontWeight: 900, color: GREEN }}>被替代风险「低」的岗位</div>
      </div>
      <div style={{ position: 'absolute', top: 360, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: jarP, transform: `scale(${jarP})` }}>
        <Jar size={260} />
      </div>
      <div style={{ position: 'absolute', bottom: 250, left: 80, right: 80, textAlign: 'center' }}>
        <div style={{ ...txt, fontSize: 40, fontWeight: 800, color: WHITE }}>品控 · 调味 · 研发</div>
        <div style={{ ...txt, marginTop: 12, fontSize: 32, color: GREY, lineHeight: 1.5 }}>
          靠手感、靠经验、靠味觉——
          <br />
          这正是老干妈这类企业的护城河
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, textAlign: 'center', fontSize: 28, color: GREEN, fontWeight: 800 }}>
        AI 暂时替不了「火候」
      </div>
    </AbsoluteFill>
  );
};

// S10 别被标题骗（回扣谣言）
const S10: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 84;
  const head = rise(f, 2, 16);
  const sub = rise(f, 18, 16);
  return (
    <AbsoluteFill style={bg(YELLOW)}>
      <Pulse color={YELLOW} t={t} />
      <SourceTag t={t} />
      <div style={{ position: 'absolute', top: '30%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...head, fontSize: 64, fontWeight: 900, lineHeight: 1.25, ...glow(YELLOW) }}>
          别被标题骗了
        </div>
        <div style={{ ...sub, marginTop: 28, fontSize: 38, color: WHITE, fontWeight: 700, lineHeight: 1.5 }}>
          回看那条「600→48」的传闻：
          <br />
          它用具体数字制造真实感，
          <br />
          但<span style={{ color: RED }}>官方已明确否认</span>。
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 120, left: 0, right: 0, textAlign: 'center', fontSize: 30, color: GREY }}>
        看到惊人数字，先查「原始信源」
      </div>
    </AbsoluteFill>
  );
};

// S11 结尾卡
const S11: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 54;
  const title = rise(f, 2, 16);
  const jarP = spring({ frame: f - 8, fps: 24, config: { damping: 13, stiffness: 90 } });
  const cta = rise(f, 26, 14);
  return (
    <AbsoluteFill style={bg(CYAN)}>
      <Pulse color={CYAN} t={t} />
      <div style={{ position: 'absolute', top: 200, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: jarP, transform: `scale(${jarP})` }}>
        <Jar size={220} />
      </div>
      <div style={{ position: 'absolute', top: '42%', left: 64, right: 64, textAlign: 'center' }}>
        <div style={{ ...title, fontSize: 56, fontWeight: 900, ...glow(CYAN) }}>老干妈 AI 裁员？</div>
        <div style={{ ...title, marginTop: 14, fontSize: 44, fontWeight: 800, color: GREEN }}>官方已辟谣</div>
      </div>
      <div style={{ position: 'absolute', bottom: 230, left: 0, right: 0, textAlign: 'center', fontSize: 30, color: GREY, lineHeight: 1.5 }}>
        信源：蓝鲸新闻 · 老干妈官方热线
        <br />
        题材来源 · 2026/10/26 热点
      </div>
      <div style={{ ...cta, position: 'absolute', bottom: 130, left: 0, right: 0, textAlign: 'center', fontSize: 36, color: WHITE, fontWeight: 800 }}>
        关注我 · 看懂每条热搜背后的真问题
      </div>
    </AbsoluteFill>
  );
};

// ================= 时间轴 =================
// BPM 120 → 每拍 12 帧 @24fps。单镜 66~84 帧（2.75~3.5s）。
export const LaoGanMa: React.FC = () => {
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
