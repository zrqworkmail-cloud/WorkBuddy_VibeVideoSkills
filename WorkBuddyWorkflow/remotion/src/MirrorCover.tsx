import React from 'react';
import { AbsoluteFill } from 'remotion';

const CYAN = '#38BDF8';
const GREEN = '#34D399';
const YELLOW = '#FBBF24';
const PINK = '#F472B6';
const WHITE = '#F8FAFC';
const GREY = '#94A3B8';
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

/** 竖版封面（1080×1920），纯代码渲染，remotion still 出图 */
export const MirrorCover: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(120% 80% at 50% 16%, #14224A 0%, #0A0F24 45%, #05070F 100%)',
      fontFamily: FONT,
      overflow: 'hidden',
    }}
  >
    <AbsoluteFill style={{ background: 'radial-gradient(55% 30% at 50% 60%, #38BDF822 0%, transparent 72%)' }} />

    {/* 立镜图形 + 左右标记 */}
    <div style={{ position: 'absolute', top: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 70 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 150, height: 150, borderRadius: '50%', background: '#1B2A4D',
          border: '6px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64, fontWeight: 900, color: PINK,
        }}>右</div>
        <div style={{ marginTop: 18, fontSize: 30, color: GREY, fontWeight: 700 }}>你</div>
      </div>
      <div style={{
        width: 60, height: 420, borderRadius: 30, background: '#13203E',
        border: `6px solid ${CYAN}`, boxShadow: `0 0 40px ${CYAN}55`,
      }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 150, height: 150, borderRadius: '50%', background: '#13203E',
          border: `6px solid ${CYAN}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64, fontWeight: 900, color: CYAN, transform: 'scaleX(-1)',
        }}>右</div>
        <div style={{ marginTop: 18, fontSize: 30, color: GREY, fontWeight: 700 }}>镜中的你</div>
      </div>
    </div>

    {/* 主标题 */}
    <div style={{ position: 'absolute', top: 860, left: 56, right: 56, textAlign: 'center' }}>
      <div style={{
        fontSize: 118, fontWeight: 900, lineHeight: 1.22, color: WHITE,
        textShadow: '0 0 24px #38BDF8AA, 0 0 48px #38BDF866',
      }}>
        镜子为什么
        <br />
        只反<span style={{ color: PINK }}>左右</span>，
        <br />
        不反<span style={{ color: YELLOW }}>上下</span>？
      </div>
    </div>

    {/* 结论条 */}
    <div style={{ position: 'absolute', top: 1440, left: 56, right: 56, textAlign: 'center' }}>
      <div style={{
        display: 'inline-block', padding: '20px 46px', borderRadius: 999,
        background: '#0E1830', border: `3px solid ${GREEN}`,
      }}>
        <span style={{ fontSize: 44, fontWeight: 900, color: GREEN }}>真相：镜子只翻转「前后」</span>
      </div>
      <div style={{ marginTop: 30, fontSize: 34, color: WHITE, fontWeight: 700 }}>
        上下没反，左右也没被镜子反——
      </div>
    </div>

    {/* 底部条 */}
    <div
      style={{
        position: 'absolute', bottom: 180, left: 60, right: 60, height: 4,
        background: 'linear-gradient(90deg, transparent, #38BDF8, transparent)',
      }}
    />
    <div style={{ position: 'absolute', bottom: 96, left: 60, right: 60, textAlign: 'center', fontSize: 34, color: WHITE, fontWeight: 800 }}>
      3 个在家就能做的实验
    </div>
  </AbsoluteFill>
);
