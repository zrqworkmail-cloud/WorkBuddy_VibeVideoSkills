import React from 'react';
import { Composition } from 'remotion';
import { SixCanals } from './SixCanals';
import { PelicanBike } from './PelicanBike';
import { LaoGanMa } from './LaoGanMa';
import { Cover } from './Cover';

// 与管线原生规格严格一致：704×1280 / 16fps / 121 帧 = 7.5625s
// 这样渲染产物可以直接当 sN.mp4 用，build_base_uniform 无需任何改动。
export const Root: React.FC = () => (
  <>
    <Composition
      id="SixCanals"
      component={SixCanals}
      durationInFrames={121}
      fps={16}
      width={704}
      height={1280}
    />
    {/* 鹈鹕测试的动画版：纯 SVG，零视频生成 */}
    <Composition
      id="PelicanBike"
      component={PelicanBike}
      durationInFrames={120}
      fps={24}
      width={1080}
      height={1080}
    />
    {/* 老干妈 AI 裁员传闻 · 辟谣科普短：全程代码渲染，1080×1920 / 24fps / 876 帧 = 36.5s */}
    <Composition
      id="LaoGanMa"
      component={LaoGanMa}
      durationInFrames={876}
      fps={24}
      width={1080}
      height={1920}
    />
    {/* 竖版封面：同样纯代码渲染，用 remotion still 出图 */}
    <Composition
      id="LgmCover"
      component={Cover}
      durationInFrames={1}
      fps={24}
      width={1080}
      height={1920}
    />
  </>
);
