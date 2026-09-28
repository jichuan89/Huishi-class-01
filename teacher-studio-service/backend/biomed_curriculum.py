"""Offline undergraduate teaching plans, with explicit material provenance."""
from datetime import datetime
import re
import uuid

from biomed_models import model_plan


TOPICS = {
    "heart": {
        "keywords": ["心脏", "心房", "心室", "血流", "循环"],
        "title": "心脏血流与心脏结构", "chapter": "19.1 Heart Anatomy",
        "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy",
        "prior": ["人体解剖方位与体循环、肺循环", "压力差驱动液体流动；瓣膜限制逆流"],
        "outcomes": ["在模型中准确定位四个心腔及主要出入血管", "按顺序追踪体循环与肺循环，解释压力差和瓣膜的作用", "用结构与血流证据解释教学病例，并指出现有证据的局限"],
        "question": "肺动脉为何运送低氧血？判断动静脉应依据什么？",
        "map": ["静脉回流 → 心房 → 心室", "右心 → 肺循环 → 左心", "左心 → 体循环 → 右心"],
        "structure": ["上、下腔静脉进入右心房；肺静脉进入左心房", "右心室经肺动脉射血；左心室经主动脉射血", "室间隔分隔两侧心室；瓣膜在压力变化中限制逆流"],
        "mechanism": ["体静脉 → 右心房 → 三尖瓣 → 右心室", "肺动脉瓣 → 肺动脉 → 肺毛细血管 → 肺静脉", "左心房 → 二尖瓣 → 左心室 → 主动脉瓣 → 主动脉"],
        "case": "教学情境：某模型中室间隔存在通道，收缩期左心室压力高于右心室。预测初始分流方向，并说明哪些数据仍不足。",
        "evidence": ["已知：存在室间交通；给定左室压力高于右室", "推断：该条件下血流倾向由左向右，肺循环流量可能增加", "边界：长期改变受缺损大小与肺血管阻力影响，不能据此给出个体诊断"],
        "compare": ["正常：室间隔完整，两侧心室没有直接血流通道", "异常示意：室间交通使血流方向受两侧压力差影响"],
        "quiz": ["把腔静脉、右心房、右心室、肺动脉按血流顺序排列（1分钟）", "判断：所有动脉都含高氧血。写出反例与分类依据（1分钟）", "室间分流需要哪两项关键证据？同伴互评（1分钟）"],
        "answers": ["腔静脉 → 右心房 → 右心室 → 肺动脉；每一步核对相连结构", "错误。肺动脉运送低氧血；动脉按血液离心方向定义", "需证明异常通道及两侧压力关系；结论必须限定于给定条件"],
        "homework": "绘制双循环路径并标注四腔和大血管；用150字解释肺动脉为何属于动脉。",
    },
    "lung": {
        "keywords": ["肺", "气体交换", "呼吸", "气道", "肺泡"],
        "title": "肺结构与气体交换", "chapter": "22.4 Gas Exchange",
        "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/22-4-gas-exchange",
        "prior": ["气体分压与扩散方向", "呼吸道组成及毛细血管循环"],
        "outcomes": ["辨认左右肺、气管、支气管及肺泡示意区域", "用分压差、面积和膜厚解释气体交换", "根据给定变量解释扩散能力变化并提出验证方法"],
        "question": "肺泡通气正常时，为什么气体交换仍可能下降？",
        "map": ["传导区：气管 → 支气管", "交换区：肺泡与毛细血管界面", "驱动与限制：分压差、面积、膜厚"],
        "structure": ["气管和支气管传导空气；肺泡提供交换界面", "大交换面积和薄屏障有利于扩散", "通气与灌注的匹配影响有效交换"],
        "mechanism": ["通气更新肺泡气体 → 建立分压差", "氧由肺泡向血液扩散；二氧化碳方向相反", "血流运输气体 → 持续维持交换条件"],
        "case": "教学情境：保持交换面积、分压差和扩散系数不变，仅将交换膜厚增加为两倍。预测扩散速率，并说明模型假设。",
        "evidence": ["控制变量：面积、分压差、扩散系数不变", "费克关系：扩散速率与膜厚成反比", "预测约为原来一半；真实肺还受通气和灌注影响"],
        "compare": ["正常示意：薄屏障与充分交换面积", "异常示意：膜增厚使相同条件下的扩散速率下降"],
        "quiz": ["给肺泡、气管标记传导或交换功能", "膜厚加倍，其他变量不变，扩散速率如何变化？", "指出仅凭血氧下降不能确定病因的理由"],
        "answers": ["气管属于传导区；肺泡是主要气体交换场所", "约减半：速率与膜厚成反比，必须注明其他变量不变", "低氧可涉及通气、扩散、灌注等机制，需要更多证据"],
        "homework": "画出肺泡与毛细血管交换图，标注氧和二氧化碳方向及影响扩散的三个变量。",
    },
    "kidney": {
        "keywords": ["肾", "尿液", "尿", "滤过", "重吸收"],
        "title": "肾单位与尿液形成", "chapter": "25.4 Microscopic Anatomy of the Kidney",
        "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/25-4-microscopic-anatomy-of-the-kidney",
        "prior": ["毛细血管滤过与浓度梯度", "主动运输、被动运输和内环境稳态"],
        "outcomes": ["定位肾皮质、髓质、肾盂及肾单位示意", "区分滤过、重吸收、分泌与排泄的方向", "用物质收支关系解释给定实验数据"],
        "question": "为什么被滤过的物质不一定出现在终尿中？",
        "map": ["肾小球：血浆 → 肾小囊", "肾小管：重吸收与分泌", "集合管 → 肾盂 → 输尿管"],
        "structure": ["皮质含肾小体及曲小管；髓质含袢和集合管等结构", "肾单位执行滤过及小管处理；肾盂汇集尿液", "单个放大肾单位为功能示意，不代表真实尺度"],
        "mechanism": ["滤过：物质由血液进入肾小囊", "重吸收：管腔 → 血液；分泌：血液 → 管腔", "排泄量 = 滤过量 − 重吸收量 + 分泌量"],
        "case": "教学实验：某物质每分钟滤过100单位、重吸收70单位、分泌10单位。计算排泄量，并说明结果不代表尿液浓度。",
        "evidence": ["所有数据为同一物质、同一时间窗内的量", "计算：100 − 70 + 10 = 40单位/分钟", "浓度还需尿流率；数量、速率和浓度不可混用"],
        "compare": ["正常概念：滤过后可大量重吸收，终尿不等于滤液", "异常情境：运输能力改变可影响排泄，需控制滤过与分泌"],
        "quiz": ["指出重吸收与分泌的相反方向", "滤过100、重吸收70、分泌10，排泄量是多少？", "为何仅凭排泄量不能求尿液浓度？"],
        "answers": ["重吸收为管腔到血液，分泌为血液到管腔", "40单位/分钟；依据物质收支关系", "还缺尿流率，浓度为单位体积中物质的量"],
        "homework": "画肾单位功能流程图，自拟一组收支数据并附单位与计算过程。",
    },
    "cell": {
        "keywords": ["细胞", "细胞器", "线粒体", "内质网", "蛋白质"],
        "title": "细胞器结构与功能协作", "chapter": "3.2 The Cytoplasm and Cellular Organelles",
        "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/3-2-the-cytoplasm-and-cellular-organelles",
        "prior": ["细胞膜的选择性通透性", "DNA、RNA与蛋白质的基本关系"],
        "outcomes": ["辨认细胞膜、细胞核和主要细胞器", "追踪典型分泌蛋白的合成、加工与运输", "根据示踪结果提出运输受阻的机制假设"],
        "question": "一种分泌蛋白从合成到释放，为什么需要多种细胞器协作？",
        "map": ["信息：细胞核中的转录与RNA输出", "合成加工：核糖体、粗面内质网、高尔基体", "运输与能量：囊泡、细胞膜、线粒体"],
        "structure": ["核糖体合成蛋白质；分泌蛋白通常进入粗面内质网", "高尔基体参与修饰、分选和运输", "线粒体参与能量代谢；并非所有ATP都在线粒体形成"],
        "mechanism": ["粗面内质网上的核糖体合成，蛋白进入内质网", "运输囊泡 → 高尔基体加工与分选", "分泌囊泡 → 细胞膜融合 → 胞外释放"],
        "case": "教学实验：标记分泌蛋白后，信号持续积累在内质网，高尔基体信号降低。提出运输环节的假设及一个对照。",
        "evidence": ["证据：内质网积累、高尔基体信号减少", "假设：内质网向高尔基体的运输受阻，亦需排查折叠异常", "对照：正常细胞同时间点示踪，确认标记与细胞活性一致"],
        "compare": ["正常：内质网 → 高尔基体 → 分泌囊泡", "异常示意：内质网积累；位置变化支持假设但不足以唯一定位病因"],
        "quiz": ["给典型分泌蛋白排列细胞器经过顺序", "所有蛋白质都经过高尔基体吗？举出例外", "为示踪实验设计一个必要对照"],
        "answers": ["粗面内质网 → 高尔基体 → 囊泡 → 细胞膜", "不是；许多细胞质蛋白由游离核糖体合成并留在细胞质", "正常细胞同时间点示踪，并控制标记剂量与细胞活性"],
        "homework": "绘制分泌蛋白路径，比较游离与附着核糖体产物的典型去向。",
    },
}


def lines(value, fallback):
    values = value if isinstance(value, list) else str(value or "").splitlines()
    return [str(item).strip() for item in values if str(item).strip()] or list(fallback)


def recommend(topic):
    scores = {key: sum(word in topic for word in data["keywords"]) for key, data in TOPICS.items()}
    return max(scores, key=scores.get) if any(scores.values()) else "heart"


def build_lesson(request):
    request = dict(request)
    topic = str(request.get("topic") or "心脏血流与心脏结构")
    key = request.get("modelKey") or recommend(topic)
    if key not in TOPICS:
        raise ValueError("请选择心脏、肺、肾脏或细胞模型")
    data = TOPICS[key]
    duration = max(20, min(120, int(request.get("duration") or 45)))
    request.update(stage="本科", duration=duration, subject=request.get("subject") or "生物医学")
    outcomes = lines(request.get("learningOutcomes") or request.get("objectives"), data["outcomes"])
    prior = lines(request.get("prerequisites") or request.get("priorKnowledge"), data["prior"])
    assessment = lines(request.get("assessmentMethod") or request.get("assessment"), ["结构定位30%：准确标出关键部件", "机制解释40%：顺序、方向与依据完整", "应用判断30%：区分证据、推断和待验证问题"])
    model = model_plan(key, request.get("modelParts"), request.get("renderMode", "exploded"))
    model.update(slideNumbers=[5], observationAngles=["前视", "侧视", "旋转至后视"], classroomQuestion=data["question"])
    references = [{"title": "基础生物医学内置课程模板：" + data["title"], "author": "Teacher Studio", "year": "2026", "sourceType": "builtin-template", "sourceUrl": "", "license": "项目内置教学示意", "usedIn": [f"slide-{i}" for i in range(1, 15)] + ["model-" + key]},
                  {"title": "Anatomy and Physiology 2e / " + data["chapter"], "author": "OpenStax", "year": "2022", "sourceType": "web-reference", "sourceUrl": data["url"], "license": "CC BY 4.0（教材）；本课无转载图片", "usedIn": ["slide-13"]}]
    material = str(request.get("materialText") or "").strip()
    excerpts = [s.strip() for s in re.split(r"[\n。！？]+", material) if len(s.strip()) >= 8]
    matched = [s for s in excerpts if any(word in s for word in data["keywords"])]
    evidence = matched or excerpts
    if material:
        references.insert(0, {"title": request.get("materialName") or "教师粘贴资料", "author": "用户提供", "year": "未注明", "sourceType": "user-material", "sourceUrl": "", "license": "用户资料，授权范围待教师核对", "usedIn": ["slide-6"]})
    case_enabled = request.get("includeCase", "包含") != "不包含"
    case = data["case"] if case_enabled else "实际应用任务：" + data["question"]
    homework = str(request.get("homework") or data["homework"])
    if request.get("includeResearch") == "包含":
        homework += " 阅读参考教材对应章节，提出一个可检验问题并列出证据需求。"
    stages = ["生物医学问题导入", "先修知识检查", "结构观察与3D任务", "机制或过程讲解", "病例讨论" if case_enabled else "实际应用", "结构对比与辨析", "课堂练习与即时评价", "总结与课后任务"]
    weights = [4, 4, 8, 9, 7, 4, 6, 3]
    times = [round(duration * w / 45) for w in weights]
    times[-1] += duration - sum(times)
    teachers = [data["question"], "检查：" + "；".join(prior), "按观察任务切换模型部件，并核对解剖方向", "用板书箭头串联：" + "；".join(data["mechanism"]), case, "；".join(data["compare"]), "逐题收集答案后再揭示依据；" + "；".join(assessment), "回扣学习成果；布置：" + homework]
    students = ["独立判断并保留最初理由", "用一句话解释一个先修概念", "小组标注结构、隐藏指定部件并记录连接关系", "补全方向与条件，口述机制链", "列出证据、解释和仍缺的数据", "找出变化的结构及其功能后果", "独立作答、同伴按评分点互评", "提交出口条：一个机制与一个待解决问题"]
    if request.get("includeExperiment") == "包含":
        students[2] += "；用观察记录表区分直接观察与机制推断"
    checks = ["是否指出分类依据", "两项先修概念是否正确", "部件名称与连接是否准确", "箭头方向及条件是否完整", "是否区分证据与推断", "是否控制其他变量", "记录各学习成果达成情况", "出口条是否回应核心问题"]
    phases = [{"id": f"phase-{i+1}", "time": times[i], "name": name, "teacher": teachers[i], "student": students[i], "check": checks[i]} for i, name in enumerate(stages)]
    slides = []
    def page(kind, title, items, layout, phase, purpose):
        slides.append({"type": kind, "title": title, "items": items, "layout": layout, "phaseId": f"phase-{phase}", "purpose": purpose, "proof": kind, "visual": "结构、机制与证据", "interaction": purpose, "sourceIds": [1 if material else 0]})
    page("封面", topic, [request.get("courseName") or "基础生物医学", f"本科 / {duration}分钟 / 理论·结构·应用·评价"], "hero-stack", 1, data["question"])
    page("学习成果", "学习成果与先修知识", outcomes + ["先修：" + "；".join(prior)], "three-column", 2, "说出可观察、可评价的学习表现")
    page("问题", "核心生物医学问题", [request.get("coreQuestion") or data["question"], "先判断，再写出一条依据"], "question-split", 2, "保留初始答案，课末重新解释")
    page("知识结构", "建立知识结构", data["map"], "layer-map", 3, "从结构走向功能")
    page("观察", "3D结构观察", ["部件：" + "、".join(p["name"] for p in model["partDetails"]), model["observationTasks"][0], model["observationTasks"][-1]], "observation-stage", 3, "前视定位、侧视确认、隐藏部件核对；见模型面板")
    structure = data["structure"][:]
    if evidence:
        structure = ["用户资料摘录：" + evidence[0][:120], *data["structure"][:2]]
    page("结构功能", "结构与功能关系", structure, "three-column", 4, "资料优先核对，模板作为补充")
    if material:
        slides[-1]["sourceIds"] = [0, 1]
    page("机制", "沿着机制追踪过程", data["mechanism"], "step-flow", 4, "为每一步注明方向和依据")
    page("案例", "病例证据链" if case_enabled else "实际应用任务", [case, *data["evidence"][:2]] if case_enabled else [case, *data["structure"][:2]], "evidence-list", 5, "区分已知证据、解释与结论边界")
    page("辨析", "正常与异常对比", data["compare"], "compare-duo", 6, "先指出变化，再解释功能后果")
    page("练习", "独立判断与即时评价", data["quiz"], "task-timer", 7, "三分钟作答，再按结构、机制、证据互评")
    page("揭示", "答案与机制解释", data["answers"], "answer-rail", 7, "逐项核对，不只记录对错")
    page("总结", "从结构回到解释", [data["map"][0], data["mechanism"][-1], "出口条：回答核心问题并说明适用条件"], "loop-summary", 8, "回看最初判断并修订理由")
    page("参考资料", "参考资料与来源", [f"[{i+1}] {r['title']} / {r['author']} / {r['year']}" for i,r in enumerate(references)], "source-quote", 8, "用户资料优先；内置示意需结合教材核对")
    slides[-1]["sourceIds"] = list(range(len(references)))
    page("作业", "课后学习任务", [homework, "提交：结构图、机制解释与引用来源", "评价：结构准确、方向完整、证据可追溯"], "take-home", 8, "用学习成果检验迁移")
    return {"id": uuid.uuid4().hex, "createdAt": datetime.now().isoformat(timespec="seconds"), "request": request, "title": topic,
            "overview": f"本科生物医学，{duration}分钟。结构观察、机制解释与实际应用。" + ("用户资料优先，内置模板补充。" if material else "使用内置基础医学教学模板。"),
            "courseProfile": {"stage": "本科", "field": request.get("field") or "生物医学", "courseName": request.get("courseName") or "基础生物医学", "courseType": request.get("courseType") or "专业核心课", "semester": request.get("semester") or "大一上", "credits": request.get("credits") or "2", "courseHours": request.get("courseHours") or "32"},
            "learningOutcomes": outcomes, "prerequisites": prior, "knowledgeMap": data["map"], "casePrompt": case, "assessmentPlan": assessment, "references": references, "modelPlan": model,
            "objectives": outcomes, "situation": request.get("learningSituation") or "已修基础生物学；需从部件辨认过渡到机制解释和证据判断。",
            "keyPoints": lines(request.get("keyPoints"), data["structure"]), "difficulties": lines(request.get("difficulties"), ["将三维结构、过程方向与机制证据对应"]),
            "methods": lines(request.get("methods"), ["结构观察", "问题驱动", "同伴互评"]), "resources": request.get("resources") or "教材、3D教学示意模型、课堂任务单", "assessment": "；".join(assessment), "homework": homework, "phases": phases, "blackboard": data["map"], "slides": slides,
            "materialCoverage": {"matched": bool(matched), "excerptCount": len(evidence), "note": "当前为可追溯摘录与内置模板组合；上传全文保留于教材面板，教师需核对专业表述。"},
            "visualProfile": {"stage": "本科", "subject": "生物医学", "density": "balanced", "theme": "医学高对比", "visualLanguage": "器官标注、机制箭头、病例证据链、3D观察任务", "assetQueries": []}}
