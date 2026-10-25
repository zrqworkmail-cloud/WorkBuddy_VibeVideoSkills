#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Wan 2.2 I2V 四步 Lightning（FP8 HIGH+LOW 双专家）提交器。"""
import json, os, sys, time, uuid, urllib.request, urllib.error

SERVER = "http://127.0.0.1:8188"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film  # 多片路由：FILM 环境变量决定 films/<FILM>/ 还是参考实现根目录
import gpu_gate  # GPU 让渡门控：只在本机 GPU 空闲时才提交，绝不抢占他人算力

AI = _film.p_out("ai")

UNET_HI = "wan22EnhancedLightning_v2I2VFP8HIGH.safetensors"
UNET_LO = "wan22EnhancedLightning_v2I2VFP8LOW.safetensors"
CLIP = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
VAE = "Wan2.1_VAE.safetensors"

NEG = ("low quality, blurry, distorted, deformed, ugly, duplicate, watermark, "
       "text overlay, logo, oversaturated, flickering, fast motion, morphing, "
       "strobing, jitter, duplicate frames, extra limbs, extra fingers, fused fingers, "
       "missing fingers, deformed hands, malformed limbs, distorted face, asymmetric eyes, "
       "glowing skin, bioluminescence, mannequin, wax figure, doll, body horror, "
       "nudity, naked, topless, bare chest, bare skin, exposed skin, no clothes, "
       "cartoon, illustration, anime, cgi, 3d render, plastic skin, painting, sketch, "
       "flat shading, vector art")


def upload_image(path):
    with open(path, "rb") as f:
        data = f.read()
    b = "----WB" + uuid.uuid4().hex
    hdr = ('--' + b + '\r\nContent-Disposition: form-data; name="image"; '
           'filename="' + os.path.basename(path) + '"\r\nContent-Type: image/png\r\n\r\n').encode()
    body = hdr + data + ("\r\n--" + b + "--\r\n").encode()
    req = urllib.request.Request(SERVER + "/upload/image", data=body,
                                 headers={"Content-Type": "multipart/form-data; boundary=" + b})
    return json.load(urllib.request.urlopen(req))["name"]


def build(prompt, img_name, seed, w=704, h=1280, length=81, steps=4, neg=None):
    neg_text = NEG if neg is None else neg
    g = {}
    g["1"] = {"class_type": "UNETLoader",
              "inputs": {"unet_name": UNET_HI, "weight_dtype": "default"}}
    g["2"] = {"class_type": "UNETLoader",
              "inputs": {"unet_name": UNET_LO, "weight_dtype": "default"}}
    g["3"] = {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "wan"}}
    g["4"] = {"class_type": "VAELoader", "inputs": {"vae_name": VAE}}
    g["5"] = {"class_type": "LoadImage", "inputs": {"image": img_name}}
    g["6"] = {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": prompt}}
    g["7"] = {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": neg_text}}
    # I2V 条件（首帧 + 视觉编码）
    g["8"] = {"class_type": "WanImageToVideo",
              "inputs": {"positive": ["6", 0], "negative": ["7", 0], "vae": ["4", 0],
                         "width": w, "height": h, "length": length,
                         "batch_size": 1, "start_image": ["5", 0]}}
    # ============ 采样链 ============
    # steps=4 → 2 相位（HIGH 出结构 → LOW 出细节），全程 cfg=1，最快
    # steps=8 → 3 相位，**先插一段带 CFG 的相位**，再走两段无 CFG 的加速相位
    #
    # 为什么 8 步要单独处理：Lightning 4 步蒸馏 LoRA 有明显"慢动作"倾向——
    # 运动迟缓黏滞，景物只会慢慢平移而不会真的转向。WanGP 的 3 Phases - 8 Steps
    # 配置原话是 "extend them to 8 steps in order to insert a CFG phase ...
    # The ultimate goal is reduce the slow motion effect of these Loras Accelerators"。
    # 本片 s1 的"转弯时风景不变角度"正是这个症状，所以保留这条升级路径。
    if steps > 4:
        p1 = max(1, round(steps * 0.25))        # 8 步 → 第 2 步
        p2 = max(p1 + 1, round(steps * 0.5))    # 8 步 → 第 4 步
        chain = [
            (["1", 0], "enable",  3.5, 0,  p1),   # 高噪专家 + CFG：压慢动作
            (["1", 0], "disable", 1.0, p1, p2),   # 高噪专家：出结构
            (["2", 0], "disable", 1.0, p2, steps),  # 低噪专家：出细节
        ]
    else:
        half = steps // 2
        chain = [
            (["1", 0], "enable",  1.0, 0,    half),
            (["2", 0], "disable", 1.0, half, steps),
        ]

    nid = 9
    prev = ["8", 2]
    for i, (model, add_noise, cfg, s0, s1) in enumerate(chain):
        last = (i == len(chain) - 1)
        g[str(nid)] = {"class_type": "KSamplerAdvanced",
                       "inputs": {"model": model, "add_noise": add_noise,
                                  "noise_seed": seed, "steps": steps, "cfg": cfg,
                                  "sampler_name": "euler", "scheduler": "simple",
                                  "positive": ["8", 0], "negative": ["8", 1],
                                  "latent_image": prev,
                                  "start_at_step": s0, "end_at_step": s1,
                                  "return_with_leftover_noise": "disable" if last else "enable"}}
        prev = [str(nid), 0]
        nid += 1

    dec = str(nid); nid += 1
    g[dec] = {"class_type": "VAEDecodeTiled",
              "inputs": {"samples": prev, "vae": ["4", 0],
                         "tile_size": 512, "overlap": 64,
                         "temporal_size": 48, "temporal_overlap": 8}}
    vid = str(nid)
    g[vid] = {"class_type": "CreateVideo", "inputs": {"images": [dec, 0], "fps": 16.0}}
    # SaveVideo 固定用 "20"，因为相位链长度会变（2 段/3 段），
    # 下游 gen_one / gen_queue 都要按固定 id 改 filename_prefix。
    g["20"] = {"class_type": "SaveVideo",
               "inputs": {"video": [vid, 0], "filename_prefix": "wan22/clip",
                          "format": "auto"}}
    return {"prompt": g, "client_id": uuid.uuid4().hex}


def submit(wf):
    req = urllib.request.Request(SERVER + "/prompt",
                                 data=json.dumps(wf).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req))["prompt_id"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"提交失败 {e.code}: {body[:1500]}")


def clear_queue():
    """中断正在跑的任务并清空排队，避免被别的客户端抢占"""
    try:
        urllib.request.urlopen(urllib.request.Request(
            SERVER + "/interrupt", data=b"{}",
            headers={"Content-Type": "application/json"}), timeout=20)
    except Exception:
        pass
    time.sleep(2)


def _str_status(rec):
    msgs = rec.get("status", {}).get("messages", [])
    kinds = [m[0] for m in msgs]
    if "execution_interrupted" in kinds:
        return "interrupted"
    if "execution_error" in kinds:
        for m in msgs:
            if m[0] == "execution_error":
                return "error: " + json.dumps(m[1])[:400]
    return rec.get("status", {}).get("status_str", "unknown")


def wait(pid, timeout=2400):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.load(urllib.request.urlopen(SERVER + "/history/" + pid))
        except urllib.error.HTTPError:
            time.sleep(3); continue
        if pid in h:
            rec = h[pid]
            s = _str_status(rec)
            if "execution_success" in [m[0] for m in rec.get("status", {}).get("messages", [])]:
                return rec
            if s == "interrupted":
                raise RuntimeError("__INTERRUPTED__")
            if s.startswith("error"):
                raise RuntimeError("ComfyUI " + s)
        time.sleep(3)
    raise TimeoutError("生成超时")


def outputs(rec):
    """返回 (视频文件名列表)"""
    gifs = []
    for out in rec.get("outputs", {}).values():
        for k in ("gifs", "videos", "images"):
            for v in out.get(k, []):
                gifs.append((v.get("filename"), v.get("subfolder", ""), v.get("type", "output")))
    return gifs


def download(fn, subfolder, typ, dest):
    params = urllib.parse.urlencode({"filename": fn, "subfolder": subfolder, "type": typ})
    data = urllib.request.urlopen(SERVER + "/view?" + params).read()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


import urllib.parse  # noqa: E402

# 每个分镜头独立撰写：不同主体 / 不同运镜 / 不同运动逻辑，杜绝播放-倒放复用与单一特效。
# 镜头语言设计（与科学叙事一一对应）：
#   1 卧室 02:47  -> 极慢推近 + 尘浮，孤独而亢奋
#   2 手机蓝光    -> 微距环绕手掌，冷蓝脉冲，催眠式
#   3 腺苷堆积    -> 微粒汇聚成团，缓慢漩涡，张力累积
#   4 生物钟      -> 深空黄铜钟轨旋转，庄严环绕，精密
#   5 多巴胺      -> 心脏暖金脉冲，能量沿血管游走，鲜活
#   6 神经放电    -> 穿行神经森林，突触火花明灭，电流感
#   7 大脑悖论    -> 侧脸轮廓，一区点亮一区熄灭，沉思
#   8 皮质醇      -> 试管液体缓降滴落，光渐暗，宿命感
#   9 黎明        -> 晨光穿帘轻扬，尘在光柱，温柔释然
SCENES = {
    1: ("A dimly lit bedroom at 2:47 AM, a smartphone glowing cold blue on the nightstand "
        "casting light across rumpled bedsheets, faint city bokeh through the window, "
        "an extremely slow cinematic dolly-in toward the bed, dust motes drifting in the "
        "screen light, shallow depth of field, moody low-key lighting, photorealistic, "
        "anamorphic lens, film grain, quiet and slightly unsettling stillness"),
    # —— s2 提示词写完后的二次自查记录（不合格不生成）——
    # ①细节充分性：主体(手机)+材质(深色木质床头柜)+光源(冷蓝屏光)+运动(通知气泡上浮渐隐 +
    #   极缓横移)+景深(浅)+氛围(低调压抑)全部写明。
    # ②契合分镜主旨：s2 讲「反转·借钱」——手机是让你醒着的因，通知气泡是「再看一眼」的引诱，
    #   与文案「不是回血，是身体在向你借清醒」同向。
    # ③与概念帧一致：src/c2.html 已重画为「冷蓝手机平放微倾 + 通知气泡上浮」。
    #   （原版首帧画的是暖色调手举手机：既是人手异常的直接来源，也与提示词的冷蓝矛盾。）
    # ④风险规避：显式声明 no hands / no fingers / no text；负面词已含 extra limbs、text overlay、logo。
    2: ("A smartphone lying face-up on a dark wooden bedside table, shot in near total "
        "darkness. The cold blue screen glow lights the wood grain and casts soft light "
        "upward. Three to five faint translucent pale-blue message shapes and rounded "
        "notification bubbles slowly drift up out of the screen into the air above the "
        "phone, fading as they rise. A very slow, almost imperceptible camera drift, "
        "shallow depth of field, a few tiny dust motes catching the light. Moody low-key "
        "lighting, photorealistic, intimate and hypnotic, quiet tension. "
        "No people, no hands, no fingers, no text, no logos."),
    # —— s3 提示词写完后的二次自查记录 ——
    # ①细节充分性：底色(近黑)+雾色(深青绿灰)+光源(左上极弱)+微粒(稀疏极小)+运镜(极缓漂移)
    #   +对比度(极低)全部写明，并显式要求留出图表空间。
    # ②契合分镜主旨：s3 是「机制一·腺苷」的数据镜头，叠加层为腺苷浓度曲线+入睡阈值；
    #   背景必须退后成为「介质」，不能与图表抢注意力（原版一堆荧光大光球正是被否的原因）。
    # ③与概念帧一致：src/c3.html 已重画为极暗低对比雾感+稀疏微粒，无主体形状。
    # ④与其它镜头区分度：s2 有强光源主体，s3 完全无主体，二者不雷同。
    # —— s3 提示词写完后的二次自查记录（第四轮：从「试管液体」改为「人的表现」）——
    # 用户关键反馈：用试管/液体讲化学物质，观众看不出"这是什么东西"；
    #   应当从**功能**讲 —— 它会让人产生什么变化、人的表现如何，用直观方式呈现。
    # 于是腺苷 = 越攒越困 = 眼皮越来越沉（这是每个人都能秒懂的身体经验）。
    # ①细节充分性：主体(人眼极近特写)+光(左侧冷光、低调)+运动(上眼睑缓慢下垂、几次勉强睁开、
    #   微小抽动)+景深(浅)+材质(皮肤毛孔、细睫毛) 全部写明，并强调"极慢"。
    # ②契合分镜主旨：腺苷的功能就是让人越来越困 —— 眼皮下沉正是它的直接外在表现，
    #   而且"眼睛开合高度"是可逐帧测量的量，文字读数才能由真实画面驱动。
    # ③与概念帧一致：src/c3.html 已重画为半睁的人眼特写（皮肤即背景、无硬边色块）。
    # ④风险规避：负面词新增 cartoon/illustration/anime/cgi/plastic skin，
    #   防止首帧的插画感把成片带成卡通；显式要求 photorealistic skin texture。
    3: ("Extreme close-up of a single human eye in near darkness, lit by a faint cold "
        "blue light from the left, photorealistic skin texture with fine pores and fine "
        "eyelashes, the upper eyelid slowly and heavily drooping as the eye struggles to "
        "stay open, one or two small involuntary twitches, the iris catching a soft "
        "highlight, shallow depth of field, cinematic low-key lighting, extremely slow "
        "motion, weary and heavy, no text"),
    # —— s4 提示词写完后的二次自查记录（第一版被用户否决后重写）——
    # 否决原因：原「黄铜天文钟 + 齿轮」是纯粹机械器物，与 s4 要讲的「生物钟 / 觉醒维持区 /
    #   清醒信号」没有任何语义关联，齿轮只是装饰性噱头，用户明确指出与文案主题无关。
    # ①细节充分性：天光(月光柔晕)+薄云(缓慢横渡条带)+星点(少而暗)+地平线剪影+
    #   极缓横移+极低对比度 全部写明。
    # ②契合分镜主旨：s4 讲「生物钟按点发放清醒信号」，夜晚与月光正是生物钟运转的直观语境；
    #   画面里没有任何会与双曲线图表抢注意力的主体。
    # ③与概念帧一致：src/c4.html 已重画为月夜云天（柔月光+薄云+星点+地平线），无机械物件。
    # ④风险规避：显式声明 no machinery / no clocks / no objects / no text。
    4: ("A serene deep night sky at the blue hour, a soft pale moon glow behind thin "
        "clouds slowly drifting across the sky, a few faint scattered stars, a dark "
        "distant horizon silhouette, extremely dim and very low contrast, a very slow "
        "horizontal camera drift, shallow depth of field, photorealistic, quiet, calm "
        "and subdued. No people, no buildings, no machinery, no clocks, no objects, "
        "no text."),
    # —— s5 皮质醇 自查 ——
    # ①主体(逆光侧影)+光(背后冷窗、轮廓光)+运动(呼吸越来越快、肩膀绷紧)+运镜(极缓漂移)写明。
    # ②功能化：皮质醇=「应急贷款」→ 身体以为出事了 → 肩膀绷紧、呼吸变快。这是外显的人体表现。
    # ③概念帧 c5：窗边逆光侧影，肩线清晰。
    # ④可测量：胸口/肩线的明暗起伏频率 → 驱动心率数字。剪影形态，畸变风险低。
    5: ("Tight close-up of a man's shoulder and upper chest in a dark bedroom, wearing a "
        "plain dark t-shirt, the fabric rising and falling faster and faster as the breath "
        "quickens, faint cool window light raking across the shoulder and collarbone, a "
        "subtle tension in the neck, shallow depth of field, photorealistic skin and cotton "
        "fabric texture, natural human anatomy, no face, no hands, no text"),
    # —— s6 多巴胺 自查 ——
    # ①主体(背影剪影+手机)+光(屏幕光闪动、溢到墙与肩背)+运动(不停上滑)+运镜(极缓)写明。
    # ②功能化：多巴胺=「还想要的冲动」→ 停不下来地刷。用行为本身演，不用任何化学符号。
    # ③概念帧 c6：背影 + 右下手机蓝光。
    # ④可测量：手机屏幕区域的亮度闪动 → 驱动「刺激」条与文字闪动。
    6: ("Over-the-shoulder view of a person in a dark room looking at a glowing smartphone, "
        "the phone screen bright and flickering as content scrolls, cold blue light spilling "
        "onto the person's cheek and shoulder, the back of the head a soft dark foreground, "
        "a thumb scrolling upward again and again, shallow depth of field, photorealistic, "
        "natural hand anatomy with five fingers, no text on screen"),
    # —— s7 前额叶 自查 ——
    # ①主体(伏案侧影)+光(左侧冷光+桌面微亮)+运动(长时间完全不动→缓慢抬头茫然)+运镜写明。
    # ②功能化：前额叶=「刹车片和总指挥」→ 缺觉先罢工 → 长时间呆滞、反应变慢。
    # ③概念帧 c7：伏案低头剪影 + 桌面上微亮的矩形。
    # ④可测量：运动量（帧差）先趋近于零、随后抬头时突增 → 驱动「判断力」下跌。
    # —— s7 前额叶 自查（v2：qc_rhythm 实测旧素材最长静止 8.0s，"入场即停"缺陷）——
    # ①保留 c7 首帧设定（暗房、下方冷光、面部），但删除 "completely still"；
    # ②加入可感运动：缓慢眨眼一次、呼吸起伏、下方屏幕光在脸上缓缓明灭、极缓推近；
    # ③"判断力下线"= 眼神放空但画面活着，不是死帧。
    7: ("Close-up of a young man's face in a dark room, lit only by a dim cool glow from "
        "below, eyes unfocused and staring blankly into the middle distance, the eyelids "
        "closing into one slow heavy blink then barely reopening, shallow tired breathing "
        "moving his shoulders slightly, the under-light flickering very gently like a "
        "screen glow breathing on his face, the camera dollies in extremely slowly, jaw "
        "slightly slack, shallow depth of field, photorealistic skin texture with fine "
        "pores, natural human anatomy, no hands, no text"),
    8: ("Three laboratory glass tubes with glowing cyan liquid slowly draining, backlit "
        "reflections on the glass, a single droplet falling, the light dimming as the level "
        "descends, dark background, a static camera with a faint push-in, cinematic, "
        "photorealistic, ominous and inevitable"),
    9: ("Warm dawn sunlight streaming through a sheer curtain, soft golden rays, the curtain "
        "gently billowing in a breeze, dust particles floating in the light shaft, a very "
        "slow camera drift, peaceful and tender, photorealistic, hopeful"),
    # —— s10 入睡阈值 自查（新建）——
    # ①主体(单眼极近特写)+光(左侧冷光)+运动(眼睑缓慢合上直至全闭、光随之变暗)写明。
    # ②功能化：入睡阈值=撑不住的那一刻 → 眼睛最终合上、世界变黑。与 s3「强撑」形成递进。
    # ③概念帧 c10：与 s3 同源但张得更开（给"合上"留出行程）。
    # ④可测量：眼开合高度→0，整体亮度→0。
    10: ("Extreme close-up of a single human eye in near darkness, lit by a faint cold blue "
         "light from the left, photorealistic skin texture with fine pores and fine "
         "eyelashes, the eye open, then the upper eyelid slowly and steadily closing "
         "completely until the eye is fully shut, the light dimming as it closes, shallow "
         "depth of field, cinematic low-key lighting, extremely slow, heavy and final, "
         "no text"),
    # —— s11 肾上腺素 自查（新建）——
    # ①主体(侧脸剪影)+光(背后冷光、颈侧暖光)+运动(颈动脉有节律地跳、越来越快)+运镜写明。
    # ②功能化：肾上腺素=「加速踏板」→ 心跳被顶起来、颈侧能看到脉搏。
    # ③概念帧 c11：侧脸剪影，颈前缘有柔光标记动脉位置。
    # ④可测量：颈侧柔光区域的亮度搏动 → 驱动心跳数字与脉冲线。
    11: ("Tight close-up of a man's neck and jaw in profile, lit by a faint warm lamp from "
         "the side, the skin and the neck tendon subtly tightening and relaxing as the "
         "heartbeat quickens, a faint sheen of sweat on the skin, shallow depth of field, "
         "photorealistic skin pores and light stubble, natural human anatomy, no glow, no text"),
    # —— s12 杏仁核 自查（新建）——
    # ①主体(侧影上半身)+光(右侧冷轮廓光)+运动(先完全静止→肩膀猛地一颤→回落)+运镜写明。
    # ②功能化：杏仁核=「警报器」→ 一点动静就炸 → 被细微声响惊得一颤。
    # ③概念帧 c12：肩膀耸起的紧张侧影。
    # ④可测量：运动量在惊颤瞬间突增 → 驱动红色警示数字跳一下。
    # —— s13 生物钟：月光扫过卧室地板（时间是靠光的角度走的）——
    # ①细节：暗房 + 窗 + 地板上的斜向月光亮斑 + 光斑角度极缓变化 + 浮尘 + 床沿剪影。
    # ②契合：生物钟讲的是"按点发放"，月光的角度变化就是最直白的"时间在走"。
    # ③与概念帧一致：src/c13.html 已按"窗+斜切光斑+床沿"画，提示词与它同向。
    # ④风险：显式 no people / no text；负面词已含 cartoon/illustration/cgi。
    13: ("Interior of a dark bedroom at night, a tall window with soft moonlight casting "
         "a long diagonal patch of light across a wooden floor, the light angle shifting "
         "extremely slowly, a thin curtain edge moving faintly, fine dust motes drifting "
         "through the beam, deep shadows, a bed edge silhouette in the foreground, "
         "static camera with an almost imperceptible drift, photorealistic, cinematic "
         "low-key lighting, quiet and timeless, no people, no text"),
    # —— s14 肾上腺素：侧脸 + 颈侧脉搏，主体压在下半部 ——
    # ①细节：近黑环境 + 下颌/颈侧冷轮廓光 + 颈动脉处随心跳收紧的皮肤 + 薄汗。
    # ②契合：肾上腺素是"加速踏板"，颈侧脉搏是最直接可读的心跳证据。
    # ③与概念帧一致：src/c14.html 主体只画在 y>700 的下半部，上半留给文字。
    # ④风险：显式 no hands / no text；负面词含 deformed/glowing skin。
    14: ("Side profile of a person's head and neck in near total darkness, lit only by a "
         "faint cold rim light tracing the jawline and the side of the neck, the skin "
         "subtly tightening and relaxing as the heartbeat quickens, a faint sheen of sweat, "
         "shallow depth of field, photorealistic skin texture with fine pores, natural human "
         "anatomy, static camera, tense and alert, no face detail, no hands, no text"),
    12: ("Close-up of a young man's face in a dark room lit by faint cool light, calm and "
         "still, then a sudden small flinch: the eyes widen and the head jerks back slightly, "
         "the shoulders tensing, then slowly settling back, shallow depth of field, "
         "photorealistic skin texture, natural human anatomy, no hands, no text"),
}

# —— 其余 7 镜提示词复查结论（写完逐条二次自查：细节充分性 / 契合分镜主旨 / 与概念帧一致 / 与其它镜头区分度）——
# s1 卧室 02:47  主体+手机冷蓝光源+极慢推近+浅景深+低落氛围齐备，与 s9 构成首尾明暗反转；pass。
# s4 生物钟       【已重写】月夜云天（柔月光+薄云横渡+星点+地平线剪影），极暗低对比；
#   夜晚正是生物钟运转的直观语境，且不给双曲线图表制造干扰；第一版的齿轮天体钟已废弃。
# s5 应激        半透明心脏暖金脉冲、能量沿血管游走，对应皮质醇/肾上腺素拉升心率；pass。
# s6 多巴胺      金色神经森林穿行、突触火花明灭，对应奖赏回路被改写；与概念帧 c6 一致；pass。
# s7 前额叶      侧脸剪影、一区点燃余部沉入阴影，对应"前额叶先罢工、杏仁核反扑"；与概念帧 c7 一致；pass。
# s8 额度        试管冷液缓降+单滴坠落+光渐暗，静态机轻微推近，对应"清醒额度被消耗"；pass。
# s9 黎明        晨光穿帘+尘在光柱+极缓漂移，温柔收尾；pass。
# 差异化总核查：9 镜的主体 / 运镜 / 运动逻辑两两不同，任何镜头都不做播放-倒放复用，特效也不重复。

# ============ 影片级配置（多片共用本脚本） ============
# FILM 环境变量存在时，从 films/<FILM>/wan22-prompts.json 覆盖上面这套（旧片）提示词与负面词。
#
# 为什么必须分片配置负面词：旧片的 NEG 里含 "glowing skin, bioluminescence, cgi,
# 3d render, illustration" —— 那是为了压住插画感。但本片的内耳/脑干/神经元概念帧
# 本来就是发光半透明的医学渲染，这几个词会与首帧直接对抗，生成结果要么被拉灰，
# 要么把结构抹掉。所以本片把负面词拆成两套：
#   neg_base  只压瑕疵与解剖错误（两套共用）
#   neg_photo neg_base + 反插画词（仅用于真人实景镜）
# 解剖/抽象镜不加反插画词，否则等于自我否定。
FILM_CFG = None
_cfg_path = os.path.join(_film.FILMROOT, "wan22-prompts.json") if _film.FILM else ""
if _cfg_path and os.path.exists(_cfg_path):
    with open(_cfg_path, "r", encoding="utf-8") as _f:
        FILM_CFG = json.load(_f)
    SCENES = {int(k.lstrip("s")): v["prompt"] for k, v in FILM_CFG["scenes"].items()}
    NEG_BASE = FILM_CFG["neg_base"]
    NEG_PHOTO = NEG_BASE + FILM_CFG.get("neg_photo_extra", "")
    NEG = NEG_BASE          # 兜底：未标注 neg 类型的镜头用基础负面词
    DEFAULT_SEED = FILM_CFG.get("seed", 20261020)
    DEFAULT_LENGTH = FILM_CFG.get("length", 121)
    DEFAULT_STEPS = FILM_CFG.get("steps", 4)
    print(f"[wan22] 载入影片配置 {_cfg_path}（{len(SCENES)} 镜）", flush=True)
else:
    DEFAULT_SEED = 20261020
    DEFAULT_LENGTH = 121
    DEFAULT_STEPS = 4


def neg_for(sid):
    """按镜头取负面词：photo=真人实景（反插画），其余=解剖/抽象（只用基础词）。"""
    if not FILM_CFG:
        return NEG
    kind = FILM_CFG["scenes"].get(f"s{sid}", {}).get("neg", "anat")
    return NEG_PHOTO if kind == "photo" else NEG_BASE


if __name__ == "__main__":
    _argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    USE_GATE = "--no-gate" not in sys.argv          # 默认开启 GPU 让渡门控
    ids = [int(a) for a in _argv[0].split(",")]
    seed = int(_argv[1]) if len(_argv) > 1 else DEFAULT_SEED
    length = int(_argv[2]) if len(_argv) > 2 else DEFAULT_LENGTH
    print("[gate] GPU 让渡门控：" + (
        f"开启（每 {gpu_gate.GPU_INTERVAL}s 复查 GPU/ComfyUI 队列/外部进程，被占用则让渡等待）"
        if USE_GATE else "已用 --no-gate 关闭"), flush=True)
    for i in ids:
        if USE_GATE:                                  # 每一镜提交前都确认 GPU 空闲
            gpu_gate.wait_gpu()
        src = os.path.join(AI, "concepts", f"c{i}.png")
        name = upload_image(src)
        ok = False
        for attempt in range(20):
            if attempt:
                time.sleep(12)
                print(f"[{i}] 第 {attempt+1} 次尝试（并发抢占导致中断）… ", flush=True)
            wf = build(SCENES[i], name, seed + i, length=length, neg=neg_for(i))
            wf["prompt"]["20"]["inputs"]["filename_prefix"] = f"wan22/s{i}"
            try:
                pid = submit(wf)
            except RuntimeError as e:
                print(f"[{i}] 提交失败 {str(e)[:200]}")
                continue
            t0 = time.time()
            try:
                rec = wait(pid)
            except RuntimeError as e:
                if str(e) == "__INTERRUPTED__":
                    continue
                print(f"[{i}] ✖ {str(e)[:200]}")
                break
            el = time.time() - t0
            outs = outputs(rec)
            if not outs:
                print(f"[{i}] ✖ 无输出")
                break
            fn, sub, typ = outs[0]
            dest = os.path.join(AI, f"s{i}.mp4")
            n = download(fn, sub, typ, dest)
            print(f"[{i}] ✔ {el:.0f}s  {dest}  {n/1048576:.1f} MB")
            ok = True
            break
        if not ok:
            print(f"[{i}] ✖ 场景 {i} 生成失败")
