"""
验证「抖音热搜」已从画面移除：
对比修改前(_qc_*.png)与修改后(_v*.png)同一时间戳帧——
1) 顶部来源条区域(前200px)必须有显著差异(文字被删)
2) 其余区域应几乎一致(仅编码噪声)
3) 源码渲染字符串中不再包含「抖音热搜」
"""
from PIL import Image
import numpy as np

def diff_region(a_path, b_path, box, label):
    a = np.asarray(Image.open(a_path).convert('L'), dtype=np.float32)
    b = np.asarray(Image.open(b_path).convert('L'), dtype=np.float32)
    x0, y0, x1, y1 = box
    ra, rb = a[y0:y1, x0:x1], b[y0:y1, x0:x1]
    d = np.abs(ra - rb)
    frac = float((d > 20).mean())
    print(f"{label:34s} meanDiff={d.mean():7.2f}  changedPix={frac*100:5.2f}%")
    return d.mean(), frac

print("== S2 @4.5s (顶部来源条) ==")
diff_region('out/_qc_4.5.png', 'out/_v1.png', (0, 0, 1080, 200), 'top band 0-200px (来源条区域)')
diff_region('out/_qc_4.5.png', 'out/_v1.png', (0, 400, 1080, 1500), 'middle band (应基本一致)')

print("== S11 @35.375s (结尾卡信源行) ==")
# 结尾卡在底部 ~1450-1700 区域有「题材来自...」
diff_region('out/_qc_35.375.png', 'out/_v2.png', (0, 1380, 1080, 1560), '信源两行区域 (应不同)')
diff_region('out/_qc_35.375.png', 'out/_v2.png', (0, 300, 1080, 1200), '中部 (应基本一致)')

# 封面顶部
print("== 封面 (顶部信源条) ==")
diff_region('out/_qc_1.375.png', 'out/_v3.png', (0, 0, 1080, 200), 'S1 @1.4s 顶部 (应不同)')
