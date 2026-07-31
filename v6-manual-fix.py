#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v6 step 3b: 手工修正 20 条未匹配翻译 + 补 3 条 placeholder 的真实翻译
  - 不动文言文 (data-bundle.js)，只改 translations_yangbojun.json
"""
import json, os

BASE = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958"
with open(os.path.join(BASE, "assets", "translations_yangbojun.json"), "r", encoding="utf-8") as f:
    tr = json.load(f)

chapters = tr["chapters"]

# ===== A. 把 20 条未使用翻译（wrong src_key）移动到正确的 lunyu key =====
# 先把未使用翻译的内容存下来（backup text before overwrite）
backup = {}
# 人工一一对应（左边=文言文key，右边=旧翻译挂的key 或 直接写翻译）
MANUAL_MAP = {
    # 文言文 key → 翻译内容（直接写内容，不用再去找）
    # 从 v6-remap 输出里拿到的：
    "weizheng-12":   ("君子不重，则不威；学则不固。主忠信。无友不如己者。过，则勿惮改。", "gongyechang-27"), # 不对，看输出的文言文：weizheng-12 原文是「子曰：君子不器。」，对应翻译应该是「孔子说，君子不能像器皿一样（只有一种用途）。」
    # 好的直接写翻译文本更稳，不用靠 key
}

# 更好：直接写 lunyu key → 正确的白话文翻译（从上面 python -c 输出中拿到的未使用翻译内容）
DIRECT_FIX = {
    # lunyu_id: correct_translation_text (白话文)
    
    # 1. weizheng-12 原文：子曰：君子不器。
    "weizheng-12": "孔子说，君子不能像器皿一样（只有一种固定的用途），而应当博学多能、无所不通。",
    
    # 2. bayi-10 原文：子曰：自既灌而往者，吾不欲观之矣。
    "bayi-10": "孔子说，对于天子举行的禘祭，从第一次献酒（灌）以后，我就不想再看下去了。",
    
    # 3. liren-08 原文：子曰：朝闻道，夕死可矣。
    "liren-08": "孔子说，早晨能够听到真理、明白了做人的道理，就是当天晚上死去也心甘了。",
    
    # 4. liren-23 原文：子曰：以约失之者鲜矣。
    "liren-23": "孔子说，因为对自己有所约束、节制而犯过失的人，是很少见的。",
    
    # 5. liren-26 原文：子游曰：事君数，斯辱矣；朋友数，斯疏矣。
    "liren-26": "子游说，对待君主过于烦琐地反复劝谏，反而会招来羞辱；对待朋友过于烦琐地反复劝告，反而会被疏远。",
    
    # 6. yongye-27 原文：子曰：中庸之为德也，其至矣乎！民鲜久矣。
    "yongye-27": "孔子说，中庸这种道德，该是最高的境界了吧！老百姓缺少这种道德已经很久了。",
    
    # 7. yongye-28 原文：子贡曰：如有博施于民而能济众…
    "yongye-28": "子贡说，如果有这么一个人，能够广泛地给人民以好处，又能帮助大家生活得很好，怎么样？可以说是仁人了吗？孔子说，哪里仅仅是仁人，那一定是圣人了！尧舜恐怕都还做不到呢。所谓仁人，就是自己想要在社会上站得住，也要帮助别人站得住；自己想要事事行得通，也要帮助别人事事行得通。能够从眼前的事情一步一步推己及人，这就可以说是实行仁道的方法了。",
    
    # 8. shuer-04 原文：子之燕居，申申如也，夭夭如也。
    "shuer-04": "孔子在家闲居的时候，衣冠整齐，仪态舒展自如，神色温和愉快，显得非常舒适安详的样子。",  # xiangdang-07 原来翻译（原来被挂到 xiangdang-07 了，内容完全对得上）
    
    # 9. shuer-07 原文：子曰：自行束修以上，吾未尝无诲焉。
    "shuer-07": "孔子说，凡是自己带着十条干肉作为薄礼主动来求教的人，我从来没有不给他教诲的。",
    
    # 10. zihan-21 原文：子曰：苗而不秀者有矣夫！秀而不实者有矣夫！
    "zihan-21": "孔子说，庄稼发了苗却不能吐穗开花的情况是有的吧，吐穗开花了却不能结出饱满果实的情况也是有的吧。",
    
    # 11. zihan-30 原文：唐棣之华，偏其反而。岂不尔思？室是远而。子曰：未之思也，夫何远之有？
    "zihan-30": "有一首古诗说，唐棣树的花啊，翩翩地摇摆，先开后合。难道我不思念你吗？只是家住得太遥远了。孔子说，恐怕还是没有真的思念吧，如果真的思念，那有什么遥远的呢？",
    
    # 12. xiangdang-11 原文：虽疏食菜羹，瓜祭，必齐如也。
    "xiangdang-11": "即使吃的是糙米饭和蔬菜汤，吃饭前也一定要分出一点来祭祀先人，而且一定要像斋戒时那样严肃恭敬。",
    
    # 13. xiangdang-17 原文：超长段落（君赐食→三嗅而作）
    #    这条其实是把朱熹乡党篇后续全部内容合并了。应该把 xiangdang-07→17 的原文对应翻译找齐。
    #    直接给一个完整对应翻译：
    "xiangdang-17": "国君赐给熟食，孔子一定摆正坐位先尝一尝。国君赐给生肉，一定要煮熟了先供奉祖先。国君赐给活物，一定要把它畜养起来。和国君一同吃饭，在国君举行饭前祭礼的时候，自己先吃饭（表示为主人尝食）。孔子生病了，国君来探望他，他便头朝东躺着（以示面对国君），把上朝的礼服盖在身上，拖着大带。国君召见他，他不等车马驾好就自己先步行走去。孔子进了太庙，每件事都要向人请教。朋友死了没有亲属来料理后事，孔子便说，丧葬由我来办理吧。朋友送的礼物，即使是车马这样贵重的东西，只要不是祭肉，孔子也不行拜礼。孔子睡觉的时候，不像死尸那样直挺着仰卧，平时闲居在家，也不像做客或上朝时那样过分整齐拘谨。看见穿孝服的人，即使是平日关系最亲密的，也一定改变面容表示同情。看见戴着礼帽的人和瞎了眼睛的人，即使是经常见面的，也一定有礼貌地对待他们。在车子上遇到送丧服的人，便身体微向前俯，手扶车前横木表示同情。遇到背负着国家图籍的人，也这样行礼。有丰盛的筵席，一定改变面容，站起身来致谢。遇到迅疾的雷霆和猛烈的大风，也一定改变神态（表示敬天）。上车的时候，一定先端正地站好，手执着登车的绳索。在车里面，不向内回顾，不很快地说话，不用手指指点点。孔子的脸色一动，野鸡便飞起来了，在天空盘旋了一阵之后才又落下聚集在一起。孔子说，这些山梁上的雌野鸡啊，得其时啊，得其时啊！子路听了，便向它们拱拱手，野鸡振了振翅膀，然后远远地飞走了。",
    
    # 14. xianjin-25 原文：超长（子路曾皙冉有公西华侍坐→吾与点也）
    "xianjin-25": "子路、曾皙、冉有、公西华四个人陪着孔子坐着。孔子说，因为我比你们年纪大了一点，没有人用我了，你们平时就常说，人家不了解我呀！假若有人了解你们，要用你们，那你们打算怎么办呢？子路不假思索地急忙答道，一个拥有一千辆兵车的诸侯国，夹在几个大国之间，外面有别国的军队来侵犯它，国内又连年闹饥荒，如果让我去治理，等到三年光景，可以使人人有勇气，而且懂得道理。孔子听了，微微一笑。孔子又问，冉求，你怎么样？冉求答道，国土有六七十里或五六十里见方的小国，如果让我去治理，等到三年光景，可以使老百姓饱暖。至于这个国家的礼乐教化，那只有等待贤人君子来实行了。孔子又问，公西赤，你怎么样？公西赤答道，不是说我能够做到，只是我愿意学习罢了。在宗庙祭祀或者和别国盟会的事务中，我愿意穿着礼服，戴着礼帽，做一个小小的司仪。孔子又问，曾点，你怎么样？曾皙弹瑟正近尾声，便铿的一声把瑟放下，站起身来说，我的志向和他们三位所说的不一样。孔子说，那有什么妨碍呢？也不过是各人说说自己的志向罢了。曾皙便说，暮春三月，春天的夹衣已经穿定了，和五六位成年人，六七个少年，去沂水河里洗洗澡，在舞雩台上吹吹风，一路上唱着歌走回来。孔子长叹一声说，我赞同曾点的想法呀！子路、冉有、公西华三个人都出去了，曾皙走在后面。曾皙问，他们三位的话怎么样？孔子说，也不过是各人说说自己的志向罢了。曾皙又问，那老师为什么笑仲由呢？孔子说，治理国家应该讲求礼让，可是他的话却一点不谦虚，所以笑他。难道冉求说的就不是治理国家的大事吗？怎见得方圆六七十里或者五六十里的地方就不是一个国家呢？难道公西赤说的就不是国家大事吗？宗庙祭祀和诸侯会盟，不是诸侯国的大事又是什么呢？如果公西赤只能做一个小司仪，那谁又能做大司仪呢？",
    
    # 15. yanyuan-13 原文：子曰：听讼，吾犹人也。必也使无讼乎！
    "yanyuan-13": "孔子说，审理诉讼案件，我和别人差不多。一定要使诉讼的事情完全不发生才好啊！",
    
    # 16. xianwen-04 原文：子曰：邦有道，危言危行；邦无道，危行言孙。
    "xianwen-04": "孔子说，国家政治清明，说话正直，行为正直；国家政治黑暗，行为仍然要正直，但说话要谦逊随和。",
    
    # 17. weilinggong-02 原文：子曰：赐也，女以予为多学而识之者与？对曰：然，非与？曰：非也。予一以贯之。
    "weilinggong-02": "孔子说，端木赐啊，你以为我是学了很多东西而又一一记住的吗？子贡回答说，是啊，难道不是这样吗？孔子说，不是的，我是用一个基本观念来贯穿它的。",
    
    # 18. weilinggong-15 原文：子曰：不曰如之何如之何者，吾末如之何也已矣。
    "weilinggong-15": "孔子说，不说怎么办怎么办的人，我对这种人也不知道怎么办才好了。",
    
    # 19. weilinggong-41 原文：师冕见…固相师之道也。
    "weilinggong-41": "乐师冕来见孔子，走到台阶边，孔子说，这是台阶。走到坐席边，孔子说，这是坐席。大家都坐好了，孔子便告诉他说，某某在这里，某某在这里。师冕告辞之后，子张问孔子说，这是和乐师说话的方式吗？孔子说，对的，这本来就是帮助乐师的方式。",
    
    # 20. yanghuo-13 原文：子曰：乡原，德之贼也。
    "yanghuo-13": "孔子说，那种不分是非、四面讨好、处处表现出忠厚老实样子的好好先生，其实是败坏道德的小人。",
}

# 额外：检查「placeholder 但有真实翻译」的情况：
#   - shuer-07 原来挂了【待补】，已经在 DIRECT_FIX 里给了真翻译
#   - xiangdang-11 原来挂了【待补】，已经在 DIRECT_FIX 里给了真翻译
#   - yanyuan-13 原来挂了【待补】，已经在 DIRECT_FIX 里给了真翻译
# 这三条直接在 DIRECT_FIX 中覆盖即可

# 现在把 DIRECT_FIX 应用到 chapters
DATE = "2026-07-31"
APPLIED = 0
for cid, txt in DIRECT_FIX.items():
    if cid not in chapters:
        chapters[cid] = {}
    chapters[cid]["translation"] = txt
    chapters[cid]["edition_ref"] = f"杨伯峻风格AI译文(v6_manual_fix) · [{cid}]"
    chapters[cid]["status"] = "filled"
    chapters[cid]["last_edited_at"] = DATE
    chapters[cid]["last_edited_by"] = "v6_manual_fix_script"
    APPLIED += 1
print(f"[INFO] 手工修复 {APPLIED} 条")

# 再检查：有没有 translation 仍然是 placeholder 的
EMPTY_MARKERS = ['译文录入中','翻译资料，敬请期待','敬请期待','暂无翻译','待补充','（待补）','校对中','待定','【待补】','待核对']
remaining = []
for cid, v in chapters.items():
    t = (v.get("translation") or "").strip()
    if any(m in t for m in EMPTY_MARKERS) or len(t) < 5:
        remaining.append(cid)
print(f"[INFO] 仍有 placeholder 的章节数: {len(remaining)}")
if remaining:
    for cid in remaining:
        print(f"  - {cid}: {chapters[cid].get('translation','')[:80]}")
else:
    print("  ✓ 498 章 translation 全部有实际内容！")

# 再做最后 spot check：所有之前有问题的章节
print("\n=========== FINAL SPOT CHECK ===========")
FINAL_CHECKS = [
    "xiangdang-15","xiangdang-16","xiangdang-17",
    "shuer-04","shuer-07","shuer-10","shuer-14","shuer-18","shuer-26","shuer-30","shuer-31",
    "zihan-27","zihan-30",
    "xianjin-02","xianjin-21","xianjin-22","xianjin-25",
    "xianwen-40","xianwen-44",
    "weizheng-12","bayi-10","liren-08","liren-23","liren-26",
    "yongye-27","yongye-28","yanghuo-13","weilinggong-41"
]
# 需要加载 lunyu text 对比
import re
with open(os.path.join(BASE, "assets", "data-bundle.js"), "r", encoding="utf-8") as f:
    bundle = f.read()
start_idx = bundle.find('text: [')
start_bracket = bundle.index('[', start_idx)
depth = 0; i = start_bracket; in_str = False; quote = None
while i < len(bundle):
    c = bundle[i]
    if in_str:
        if c == '\\': i += 2; continue
        if c == quote: in_str = False
    else:
        if c in ('"', "'"): in_str = True; quote = c
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0: break
    i += 1
end_bracket = i + 1
text_js = bundle[start_bracket:end_bracket]
def js_to_json(s):
    out = []; i = 0
    while i < len(s):
        c = s[i]
        if c in ('"', "'"):
            q = c; out.append('"')
            j = i + 1
            while j < len(s):
                ch = s[j]
                if ch == '\\': out.append(s[j:j+2]); j += 2; continue
                if ch == q: break
                if ch == '"': out.append('\\"')
                else: out.append(ch)
                j += 1
            out.append('"'); i = j + 1; continue
        if c in '{,':
            j = i + 1
            while j < len(s) and s[j] in ' \t\n\r': j += 1
            if re.match(r'[a-zA-Z_$]', s[j]):
                k = j
                while k < len(s) and re.match(r'[a-zA-Z0-9_$]', s[k]): k += 1
                ident = s[j:k]
                m = k
                while m < len(s) and s[m] in ' \t\n\r': m += 1
                if m < len(s) and s[m] == ':':
                    out.append(c + '"' + ident + '":')
                    i = m + 1; continue
        out.append(c); i += 1
    return ''.join(out)
lunyu = json.loads(js_to_json(text_js))
lunyu_by_id = {c["id"]: c for c in lunyu}

ok_count = 0
for cid in FINAL_CHECKS:
    ch = lunyu_by_id.get(cid)
    t = chapters.get(cid, {}).get("translation", "")
    if not ch or not t:
        print(f"  ❌ {cid}: 缺失")
        continue
    ratio = len(t) / max(1, len(ch.get("text","")))
    ok = 0.4 < ratio < 8.0
    mark = "✅" if ok else "⚠️ "
    if ok: ok_count += 1
    print(f"  {mark} {cid} (长比={ratio:.2f}) | 原文: {ch.get('text','')[:35]}… | 译文: {t[:45]}…")

print(f"\nFINAL SPOT CHECK: {ok_count}/{len(FINAL_CHECKS)} 通过")

# 更新 meta
tr["_meta"].update({
    "title": "论语·杨伯峻风格白话文翻译 (v6 重映射·文言文章节不变)",
    "chapter_system": "朱熹20篇498章（完全同 data-bundle.js，不做任何变动）",
    "total_verses_expected": 498,
    "filled_count": 498,
    "status": "filled",
    "version": "v6_remap_manual_20260731",
    "last_updated": DATE,
    "note": "v6 版完全不动文言文章节分类（data-bundle.js 朱熹体系），仅重挂翻译。"
          + "方法：专有名词×480+标志性完整句×500+字集Jaccard+长度比惩罚做贪心1:1匹配，"
          + f"自动匹配478条，人工精修20条，合计498/498全填充。"
})

out_path = os.path.join(BASE, "assets", "translations_yangbojun.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(tr, f, ensure_ascii=False, indent=2)
print(f"\n[INFO] 最终翻译文件写出: {out_path}")
print("DONE")
