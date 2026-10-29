// 影片路径解析（Node 侧）。与 _film.py 保持同一规则：
//   FILM 未设            → 参考实现（WorkBuddyWorkflow 根，即第一支片）
//   FILM=motion-sickness → WorkBuddyWorkflow/films/motion-sickness/
// 用法：FILM=motion-sickness node scripts/scene_preview.js s3 5
const path = require('path');

const WB = path.resolve(__dirname, '..');
const FILM = (process.env.FILM || '').trim();
const FILMROOT = FILM ? path.join(WB, 'films', FILM) : WB;

module.exports = {
  WB,
  FILM,
  FILMROOT,
  SRC: path.join(FILMROOT, 'src'),
  OUT: path.join(FILMROOT, 'out'),
  // file:// 前缀，Windows 反斜杠要转正斜杠
  url(p) { return 'file:///' + p.replace(/\\/g, '/'); },
};
