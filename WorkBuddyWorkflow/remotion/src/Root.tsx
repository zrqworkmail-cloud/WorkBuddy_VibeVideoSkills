import React from 'react';
import { Composition } from 'remotion';
import { SixCanals } from './SixCanals';
import { PelicanBike } from './PelicanBike';

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
  </>
);
