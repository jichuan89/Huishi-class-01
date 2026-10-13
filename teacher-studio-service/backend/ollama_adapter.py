"""Local Ollama adapter for structured undergraduate lesson generation."""
from __future__ import annotations

import json
import os
from urllib.error import URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:4b")


def _request(path, payload=None, timeout=3):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        DEFAULT_BASE_URL + path,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST" if data is not None else "GET",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def status():
    try:
        payload = _request("/api/tags", timeout=1.5)
        models = [item.get("name", "") for item in payload.get("models", [])]
        available = DEFAULT_MODEL in models or any(name.split(":")[0] == DEFAULT_MODEL.split(":")[0] for name in models)
        return {
            "available": available,
            "serviceReachable": True,
            "model": DEFAULT_MODEL,
            "installedModels": models,
            "message": "本地模型可用" if available else f"Ollama 已运行，但未安装 {DEFAULT_MODEL}",
        }
    except Exception as exc:
        return {
            "available": False,
            "serviceReachable": False,
            "model": DEFAULT_MODEL,
            "installedModels": [],
            "message": f"Ollama 未连接：{exc}",
        }


def generate_json(system_prompt, user_prompt, validator=None, timeout=120, format_schema=None):
    last_error = None
    prompt = user_prompt
    for attempt in range(3):
        try:
            response = _request(
                "/api/generate",
                {
                    "model": DEFAULT_MODEL,
                    "system": system_prompt,
                    "prompt": prompt,
                    "stream": False,
                    "format": format_schema or "json",
                    "think": False,
                    "keep_alive": "15m",
                    "options": {"temperature": 0.2, "seed": 20260625, "num_ctx": 16384},
                },
                timeout=timeout,
            )
            raw = str(response.get("response") or "{}").strip()
            # Qwen can still wrap valid JSON in a markdown fence even when the
            # Ollama JSON format is requested. Extract the outer object before
            # validation so harmless presentation text does not trigger fallback.
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw
                raw = raw.rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            if validator:
                error = validator(result)
                if error:
                    last_error = error
                    prompt = user_prompt + f"\n上次输出未通过校验：{error}。只返回修正后的 JSON。"
                    continue
            return result, None
        except (ValueError, KeyError, URLError, TimeoutError, OSError) as exc:
            last_error = str(exc)
            prompt = user_prompt + f"\n上次输出失败：{last_error}。只返回合法 JSON。"
    return None, last_error or "本地模型未返回有效 JSON"


def generate_lesson_content(request, scaffold, duration, activity_count):
    """Generate the topic-specific lesson content used to build the workflow."""
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:8000]
    prompt = {
        "task": "生成一份本科课程的真实教学内容，不要套用固定器官模板",
        "course": {
            "subject": request.get("subject") or "生物医学",
            "field": request.get("field"),
            "courseName": request.get("courseName"),
            "topic": request.get("topic"),
            "duration": duration,
            "abilityLevel": request.get("abilityLevel") or "基础层",
            "priorKnowledge": request.get("prerequisites") or request.get("priorKnowledge"),
        },
        "teacherMaterial": source_text,
        "outputRules": {
            "onlyJson": True,
            "language": "简体中文",
            "noGenericPlaceholders": True,
            "noUnrelatedFacts": True,
            "activityCount": activity_count,
        },
        "output": {
            "title": "本次课标题",
            "overview": "80到140字课程概览",
            "coreQuestion": "一个需要通过结构、机制、证据或操作回答的核心问题",
            "prerequisites": ["3条具体先修基础"],
            "keyPoints": ["4条本课重点"],
            "difficulties": ["3条本课难点"],
            "contentFacts": ["4条事实性知识"],
            "contentConcepts": ["4条概念性知识"],
            "contentProcedures": ["3条程序性知识，写明动作或推理步骤"],
            "contentMetacognition": ["2条元认知知识或自检策略"],
            "misconceptions": ["3条学生可能出现的具体错误"],
            "questionChain": [{"level": "观察或理解或分析或应用或表达", "question": "问题", "followUp": "教师追问", "studentGain": "学生所得"}],
            "activities": [{"name": "活动名称", "type": "活动类型", "studentAction": "学生具体任务", "learningContent": "学习内容", "visibleOutput": "可见产出", "evaluationStandard": "量化或可检查评价标准", "remediation": "未达标补救", "caseOrEvidence": "使用的案例、材料或证据"}],
            "casePrompt": "与本课主题直接相关的教学案例或应用情境",
            "homework": "可提交、可评价的课后任务"
        }
    }

    def validate(value):
        required = ("title", "overview", "coreQuestion", "prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions", "questionChain", "activities", "casePrompt", "homework")
        if not isinstance(value, dict):
            return "顶层必须是 JSON 对象"
        if any(key not in value for key in required):
            return "缺少必需字段"
        for key in ("prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions"):
            if not isinstance(value.get(key), list) or not value[key] or any(not str(item).strip() for item in value[key]):
                return f"{key} 必须是非空文本数组"
        if not isinstance(value.get("questionChain"), list) or len(value["questionChain"]) < 3:
            return "问题链至少需要3个问题"
        if not isinstance(value.get("activities"), list) or len(value["activities"]) != activity_count:
            return f"活动数量必须为 {activity_count}"
        for item in value["questionChain"]:
            if not all(str(item.get(key) or "").strip() for key in ("level", "question", "followUp", "studentGain")):
                return "问题链字段不完整"
        for item in value["activities"]:
            if not all(str(item.get(key) or "").strip() for key in ("name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence")):
                return "活动字段不完整"
        topic = str(request.get("topic") or "").strip()
        corpus = json.dumps(value, ensure_ascii=False)
        topic_terms = [topic[index:index + 2] for index in range(max(0, len(topic) - 1)) if topic[index:index + 2].strip()]
        if topic_terms and not any(term in corpus for term in topic_terms):
            return f"生成内容与课题“{topic}”不相关，必须围绕教师输入课题重做"
        return None

    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"}, "overview": {"type": "string"}, "coreQuestion": {"type": "string"},
            **{key: {"type": "array", "items": {"type": "string"}} for key in ("prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions")},
            "questionChain": {"type": "array", "items": {"type": "object", "properties": {key: {"type": "string"} for key in ("level", "question", "followUp", "studentGain")}, "required": ["level", "question", "followUp", "studentGain"], "additionalProperties": False}},
            "activities": {"type": "array", "items": {"type": "object", "properties": {key: {"type": "string"} for key in ("name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence")}, "required": ["name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence"], "additionalProperties": False}},
            "casePrompt": {"type": "string"}, "homework": {"type": "string"},
        },
        "required": ["title", "overview", "coreQuestion", "prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions", "questionChain", "activities", "casePrompt", "homework"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是严谨的本科教学设计师。根据教师输入生成具体课程内容。不要把心脏、肺或其他固定模板内容套到不相关课题上；不确定的医学事实应依据教师资料或用教学性表述限定。只返回符合 JSON Schema 的 JSON。",
        json.dumps(prompt, ensure_ascii=False), validator=validate, timeout=180, format_schema=schema,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"本地模型回退：{error}"}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 生成课程内容"}


def enhance_lesson_language(request, lesson_context):
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:6000]
    prompt = {
        "task": "只润色本科生物医学课堂语言，不增加未提供的医学事实",
        "topic": request.get("topic"),
        "abilityLevel": request.get("abilityLevel", "基础层"),
        "sourceMaterial": source_text,
        "groundedFacts": lesson_context,
        "output": {
            "introScript": "不超过120字，保留认知缺口",
            "studentPrediction": "不超过100字",
            "summaryPrompt": "不超过100字，回扣专业能力目标",
            "homeworkPrompt": "不超过120字，可操作、可提交",
        },
    }

    def validate(value):
        required = ("introScript", "studentPrediction", "summaryPrompt", "homeworkPrompt")
        if not isinstance(value, dict) or any(not str(value.get(key) or "").strip() for key in required):
            return "缺少必需字段"
        if any(len(str(value[key])) > 180 for key in required):
            return "字段过长"
        return None

    result, error = generate_json(
        "你是严谨的本科生物医学教师。只能改写课堂语言，不得添加诊断或治疗建议，不得伪造教材来源。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validate,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"本地模型回退：{error}"}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": "已使用本地模型增强课堂语言"}


def _json_schema_for(value):
    if isinstance(value, dict):
        return {
            "type": "object",
            "properties": {key: _json_schema_for(item) for key, item in value.items()},
            "required": list(value.keys()),
            "additionalProperties": False,
        }
    if isinstance(value, list):
        return {"type": "array", "items": _json_schema_for(value[0]) if value else {}}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, (int, float)):
        return {"type": "number"}
    if value is None:
        return {"type": ["string", "number", "boolean", "null"]}
    return {"type": "string"}


def revise_lesson_step(request, step, instruction, context, validator=None):
    """Revise one seven-step lesson section without changing its JSON contract."""
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:6000]
    prompt = {
        "task": "根据教师要求修改本科教案的当前步骤",
        "teacherInstruction": instruction,
        "course": {
            "stage": request.get("stage"),
            "grade": request.get("grade"),
            "subject": request.get("subject"),
            "topic": request.get("topic"),
            "duration": request.get("duration"),
            "abilityLevel": request.get("abilityLevel"),
        },
        "sourceMaterial": source_text,
        "lessonContext": context,
        "currentStep": {
            "id": step.get("id"),
            "title": step.get("title"),
            "data": step.get("data"),
        },
        "outputContract": {
            "data": "返回修改后的完整 currentStep.data；键、数组长度、ID 和数据类型必须保持不变",
            "summary": "用一句中文概括本次修改",
        },
    }
    format_schema = {
        "type": "object",
        "properties": {
            "data": _json_schema_for(step.get("data") or {}),
            "summary": {"type": "string"},
        },
        "required": ["data", "summary"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是严谨的本科生物医学教学设计助手。严格执行教师修改要求，只编辑当前步骤。"
        "不得改变 JSON 结构、字段名、数组长度、对象 ID 或引用关系；不得伪造教材来源、医学证据、诊断或治疗建议。"
        "教学目标必须使用可观察行为，活动必须保留学生产出、评价标准和补救措施。只返回 JSON。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validator,
        timeout=180,
        format_schema=format_schema,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"本地模型编辑失败：{error}"}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 按要求编辑当前步骤"}
