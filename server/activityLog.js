import { isIP } from 'node:net';

export const DEFAULT_LOG_PAGE = 1;
export const DEFAULT_LOG_PAGE_SIZE = 50;
export const MAX_LOG_PAGE_SIZE = 100;
export const MAX_LOG_PAGE = 1_000_000;
export const MAX_SCHOOL_LENGTH = 128;
export const MAX_LOG_PATH_LENGTH = 512;
export const MAX_LOG_USER_AGENT_LENGTH = 512;
export const MAX_LOG_DESCRIPTION_LENGTH = 1000;
export const MAX_ACTIVITY_MODEL_NAME_LENGTH = 128;
export const MAX_ACTIVITY_TEXT_LENGTH = 1000;
export const MAX_ACTIVITY_CONVERSATION_TEXT_LENGTH = 400;
export const MAX_ACTIVITY_PROMPT_LENGTH = 240;

const ACTIVITY_EVENT_TYPES = new Set([
  'model.switch',
  'xiaozhi.conversation',
  'gesture.part.move',
  'gesture.mode.switch',
]);

const ACTIVITY_MODEL_SOURCES = new Map([
  ['manual', '手动操作'],
  ['local', '本地模型库'],
  ['resource', '学科资源库'],
  ['ai', '小智'],
  ['fallback', '备用模型'],
]);

const ACTION_DESCRIPTIONS = {
  'auth.register': '用户完成了注册',
  'auth.login': '用户登录了课堂',
  'auth.admin.login': '管理员登录了后台',
  'auth.logout': '用户退出了登录',
  'auth.me.view': '用户查看了当前登录状态',
  'feedback.submit': '用户提交了使用反馈',
  'profile.update': '用户更新了个人资料',
  'profile.password.update': '用户修改了登录密码',
  'admin.users.list': '管理员查看了用户列表',
  'admin.logs.view': '管理员查看了操作日志',
  'admin.user.status.update': '管理员修改了用户账号状态',
  'admin.user.role.update': '管理员调整了用户角色',
  'admin.resource.tag.create': '管理员创建了资源分类',
  'admin.resource.tag.update': '管理员更新了资源分类',
  'admin.resource.tag.delete': '管理员删除了资源分类',
  'admin.resource.model.create': '管理员上传了资源模型',
  'admin.resource.model.update': '管理员更新了资源模型',
  'admin.resource.model.delete': '管理员删除了资源模型',
  'resource.library.view': '用户查看了学科资源库',
  'resource.model.file.view': '用户打开了资源模型文件',
  'voice.preferences.view': '用户查看了声音设置',
  'voice.preferences.update': '用户保存了声音设置',
  '3d.job.submit': '用户提交了 3D 建模任务',
  '3d.job.query': '用户查询了 3D 建模任务状态',
  '3d.model.view': '用户打开了 3D 模型文件',
  'activity.event.submit': '用户提交了课堂行为记录',
  'ai.completion': '用户请求了小智课堂分析',
  'ai.stream': '用户请求了小智课堂讲解',
  'memory.session.create': '用户打开了学习记忆会话',
  'memory.session.list': '用户查看了学习记忆会话',
  'memory.session.messages.view': '用户查看了学习记忆消息',
  'memory.session.message.create': '用户保存了学习记忆消息',
  'memory.settings.view': '用户查看了学习记忆设置',
  'memory.settings.update': '用户更新了学习记忆设置',
  'memory.list': '用户查看了学习记忆内容',
  'memory.update': '用户更新了学习记忆内容',
  'memory.delete': '用户删除了学习记忆内容',
  'memory.clear': '用户清空了学习记忆内容',
};

function normalizePath(path = '') {
  const value = String(path || '').split('?')[0].replace(/\/+$/, '');
  return value || '/';
}

function normalizeDisplayText(value) {
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/data:[^,\s]+,[^\s]+/giu, '[已省略数据]')
    .replace(/https?:\/\/\S+/giu, '[已省略链接]')
    .replace(/\s+/gu, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  if (maxLength <= 1) return '…'.slice(0, maxLength);
  return `${characters.slice(0, maxLength - 1).join('')}…`;
}

function normalizeBoundedText(value, maxLength, label, { required = true } = {}) {
  if (typeof value !== 'string') {
    throw new ActivityEventValidationError(`${label}需为不超过 ${maxLength} 个字符的文本`);
  }

  const normalized = normalizeDisplayText(value);
  if (required && !normalized) {
    throw new ActivityEventValidationError(`${label}不能为空`);
  }

  return truncateText(normalized, maxLength);
}

function readOptionalActivityText(payload, key, maxLength, label) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) return undefined;
  return normalizeBoundedText(payload[key], maxLength, label);
}

function assertAllowedKeys(value, allowedKeys, label) {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new ActivityEventValidationError(`${label}包含不支持的字段`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ActivityEventValidationError(`${label}格式无效`);
  }
}

function activityActorDescription(action) {
  const baseAction = String(action || '').replace(/\.failure$/, '');
  return ACTION_DESCRIPTIONS[baseAction] || null;
}

function humanizePath(path) {
  const segmentLabels = {
    api: '接口',
    auth: '账号',
    admin: '后台管理',
    users: '用户',
    user: '用户',
    logs: '日志',
    resource: '资源',
    resources: '资源',
    library: '资源库',
    model: '模型',
    models: '模型',
    files: '文件',
    profile: '个人资料',
    password: '密码',
    voice: '声音',
    preferences: '设置',
    memory: '学习记忆',
    settings: '设置',
    sessions: '会话',
    messages: '消息',
    memories: '记忆',
    ai: '小智',
    completion: '分析',
    stream: '讲解',
    health: '服务状态',
    '3d': '3D 建模',
    submit: '提交',
    query: '查询',
    feedback: '反馈',
    activity: '课堂行为',
    events: '事件',
  };
  const labels = normalizePath(path)
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (/^\d+$/.test(segment)) return '目标';
      return segmentLabels[segment.toLowerCase()] || '功能';
    });
  return labels.length > 0 ? labels.slice(0, 4).join(' · ') : '接口功能';
}

function buildGenericActivityDescription({ method = 'GET', path = '/' } = {}) {
  const verb = {
    GET: '查看了',
    POST: '提交或创建了',
    PATCH: '更新了',
    PUT: '更新了',
    DELETE: '删除了',
  }[String(method || 'GET').toUpperCase()] || '执行了';
  return `用户${verb}${humanizePath(path)}`;
}

export function buildActivityLogDescription({ action, method = 'GET', path = '/', statusCode = 200 } = {}) {
  const description = activityActorDescription(action) || buildGenericActivityDescription({ method, path });
  return Number(statusCode) >= 400 ? `${description}（请求未成功）` : description;
}

export function build3dSubmissionDescription({ prompt, image = false } = {}) {
  if (typeof prompt === 'string' && normalizeDisplayText(prompt)) {
    const boundedPrompt = truncateText(normalizeDisplayText(prompt), MAX_ACTIVITY_PROMPT_LENGTH);
    return `用户使用了文生 3D，提示词：“${boundedPrompt}”`;
  }
  if (image) return '用户使用了图生 3D';
  return '用户提交了 3D 建模任务';
}

export class ActivityEventValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActivityEventValidationError';
    this.code = 'INVALID_ACTIVITY_EVENT';
    this.status = 400;
  }
}

export function buildSemanticActivityLog(body) {
  assertObject(body, '行为事件');
  assertAllowedKeys(body, ['type', 'payload'], '行为事件');
  if (typeof body.type !== 'string' || !ACTIVITY_EVENT_TYPES.has(body.type)) {
    throw new ActivityEventValidationError('不支持的行为事件类型');
  }
  assertObject(body.payload, '行为事件参数');

  switch (body.type) {
    case 'model.switch': {
      assertAllowedKeys(body.payload, ['fromModel', 'toModel', 'source'], '模型事件参数');
      const toModel = normalizeBoundedText(body.payload.toModel, MAX_ACTIVITY_MODEL_NAME_LENGTH, '目标模型');
      const fromModel = readOptionalActivityText(body.payload, 'fromModel', MAX_ACTIVITY_MODEL_NAME_LENGTH, '原模型');
      const source = body.payload.source === undefined ? undefined : body.payload.source;
      if (source !== undefined && (typeof source !== 'string' || !ACTIVITY_MODEL_SOURCES.has(source))) {
        throw new ActivityEventValidationError('模型来源无效');
      }
      const sourceLabel = ACTIVITY_MODEL_SOURCES.get(source) || '课堂操作';
      const description = fromModel && fromModel !== toModel
        ? `用户通过${sourceLabel}从“${fromModel}”切换到了 3D 模型“${toModel}”`
        : `用户通过${sourceLabel}打开了 3D 模型“${toModel}”`;
      return { action: body.type, description, payload: { fromModel, toModel, source } };
    }
    case 'xiaozhi.conversation': {
      assertAllowedKeys(body.payload, ['userText', 'assistantText'], '小智对话参数');
      const userText = normalizeBoundedText(body.payload.userText, MAX_ACTIVITY_CONVERSATION_TEXT_LENGTH, '用户说话内容');
      const assistantText = normalizeBoundedText(body.payload.assistantText, MAX_ACTIVITY_CONVERSATION_TEXT_LENGTH, '小智回答内容');
      return {
        action: body.type,
        description: `用户与小智完成了一轮对话：用户说“${userText}”；小智回答“${assistantText}”`,
        payload: { userText, assistantText },
      };
    }
    case 'gesture.part.move': {
      assertAllowedKeys(body.payload, ['modelName', 'partName'], '手势部件事件参数');
      const modelName = normalizeBoundedText(body.payload.modelName, MAX_ACTIVITY_MODEL_NAME_LENGTH, '模型名称');
      const partName = normalizeBoundedText(body.payload.partName, MAX_ACTIVITY_MODEL_NAME_LENGTH, '部件名称');
      return {
        action: body.type,
        description: `用户通过手势抓取、移动并释放了模型“${modelName}”的部件“${partName}”`,
        payload: { modelName, partName },
      };
    }
    case 'gesture.mode.switch': {
      assertAllowedKeys(body.payload, ['mode'], '交互模式事件参数');
      if (body.payload.mode !== 'single' && body.payload.mode !== 'dual') {
        throw new ActivityEventValidationError('交互模式必须是 single 或 dual');
      }
      const modeLabel = body.payload.mode === 'dual' ? '双手' : '单手';
      return {
        action: body.type,
        description: `用户将手势交互模式切换为${modeLabel}模式`,
        payload: { mode: body.payload.mode },
      };
    }
    default:
      throw new ActivityEventValidationError('不支持的行为事件类型');
  }
}

function normalizeMappedIpv4(value) {
  const dottedMatch = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dottedMatch && isIP(dottedMatch[1]) === 4) return dottedMatch[1];

  const hexadecimalMatch = value.match(/^::ffff:([0-9a-f]{4}):([0-9a-f]{4})$/i);
  if (!hexadecimalMatch) return null;

  const first = Number.parseInt(hexadecimalMatch[1], 16);
  const second = Number.parseInt(hexadecimalMatch[2], 16);
  const ipv4 = [first >> 8, first & 0xff, second >> 8, second & 0xff].join('.');
  return isIP(ipv4) === 4 ? ipv4 : null;
}

export function normalizeIpAddress(value) {
  if (typeof value !== 'string') return null;

  let normalized = value.trim();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }

  const mappedIpv4 = normalizeMappedIpv4(normalized);
  if (mappedIpv4) return mappedIpv4;
  if (isIP(normalized) === 0 || normalized.length > 45) return null;
  return normalized;
}

export function resolveRequestIp(req) {
  return normalizeIpAddress(req?.ip || req?.socket?.remoteAddress || req?.connection?.remoteAddress);
}

export function resolveTrustProxySetting(rawValue, production = false) {
  const fallback = production ? 1 : 'loopback';
  if (rawValue === undefined || rawValue === null || rawValue === '') return fallback;

  const value = String(rawValue).trim();
  if (!/^\d+$/.test(value)) return fallback;

  const hops = Number(value);
  return Number.isSafeInteger(hops) ? hops : fallback;
}

export function validateOptionalSchool(value) {
  if (value === undefined || value === null) return { valid: true, value: null };
  if (typeof value !== 'string') {
    return { valid: false, value: null, message: '学校需为不超过 128 个字符的文本' };
  }

  const normalized = value.trim();
  if (Array.from(normalized).length > MAX_SCHOOL_LENGTH) {
    return { valid: false, value: null, message: '学校名称不能超过 128 个字符' };
  }

  return { valid: true, value: normalized || null };
}

export function normalizeOptionalSchool(value) {
  const result = validateOptionalSchool(value);
  if (!result.valid) {
    const error = new Error(result.message);
    error.code = 'INVALID_SCHOOL';
    throw error;
  }
  return result.value;
}

export const normalizeSchool = normalizeOptionalSchool;
export const validateSchool = validateOptionalSchool;

export function parsePositiveInteger(value, fallback = null) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) return fallback;

  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function normalizeLogPagination(pageValue, pageSizeValue) {
  const requestedPage = parsePositiveInteger(pageValue, DEFAULT_LOG_PAGE) || DEFAULT_LOG_PAGE;
  const page = Math.min(requestedPage, MAX_LOG_PAGE);
  const requestedPageSize = parsePositiveInteger(pageSizeValue, DEFAULT_LOG_PAGE_SIZE) || DEFAULT_LOG_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_LOG_PAGE_SIZE);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildLogPagination({ page, pageSize, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  return {
    page,
    pageSize,
    total: safeTotal,
    totalPages: safeTotal === 0 ? 0 : Math.ceil(safeTotal / pageSize),
  };
}

function actionWithFailure(action, statusCode) {
  return Number(statusCode) >= 400 ? `${action}.failure` : action;
}

export function mapActivityAction({ method = 'GET', path = '/', statusCode = 200 } = {}) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const normalizedPath = normalizePath(path);

  if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/register') {
    return actionWithFailure('auth.register', statusCode);
  }
  if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/login') {
    return Number(statusCode) >= 400 ? 'auth.login.failure' : 'auth.login';
  }
  if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/admin/login') {
    return Number(statusCode) >= 400 ? 'auth.admin.login.failure' : 'auth.admin.login';
  }
  if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/logout') return 'auth.logout';
  if (normalizedMethod === 'GET' && normalizedPath === '/api/auth/me') return 'auth.me.view';
  if (normalizedMethod === 'POST' && normalizedPath === '/api/feedback') {
    return actionWithFailure('feedback.submit', statusCode);
  }
  if (normalizedMethod === 'PATCH' && normalizedPath === '/api/profile') {
    return actionWithFailure('profile.update', statusCode);
  }
  if (normalizedMethod === 'PATCH' && normalizedPath === '/api/profile/password') {
    return actionWithFailure('profile.password.update', statusCode);
  }
  if (normalizedMethod === 'GET' && normalizedPath === '/api/admin/users') return 'admin.users.list';
  if (normalizedMethod === 'GET' && normalizedPath === '/api/admin/logs') return 'admin.logs.view';

  if (/^\/api\/admin\/users\/\d+\/status$/.test(normalizedPath) && normalizedMethod === 'PATCH') {
    return actionWithFailure('admin.user.status.update', statusCode);
  }
  if (/^\/api\/admin\/users\/\d+\/role$/.test(normalizedPath) && normalizedMethod === 'PATCH') {
    return actionWithFailure('admin.user.role.update', statusCode);
  }
  if (normalizedPath === '/api/admin/resource-tags' && normalizedMethod === 'POST') {
    return actionWithFailure('admin.resource.tag.create', statusCode);
  }
  if (/^\/api\/admin\/resource-tags\/\d+$/.test(normalizedPath) && normalizedMethod === 'PATCH') {
    return actionWithFailure('admin.resource.tag.update', statusCode);
  }
  if (/^\/api\/admin\/resource-tags\/\d+$/.test(normalizedPath) && normalizedMethod === 'DELETE') {
    return actionWithFailure('admin.resource.tag.delete', statusCode);
  }
  if (normalizedPath === '/api/admin/resource-models' && normalizedMethod === 'POST') {
    return actionWithFailure('admin.resource.model.create', statusCode);
  }
  if (/^\/api\/admin\/resource-models\/\d+$/.test(normalizedPath) && normalizedMethod === 'PATCH') {
    return actionWithFailure('admin.resource.model.update', statusCode);
  }
  if (/^\/api\/admin\/resource-models\/\d+$/.test(normalizedPath) && normalizedMethod === 'DELETE') {
    return actionWithFailure('admin.resource.model.delete', statusCode);
  }
  if (normalizedMethod === 'GET' && normalizedPath === '/api/resource-library') return 'resource.library.view';
  if (normalizedMethod === 'GET' && /^\/api\/resource-models\/\d+\/files\/\d+$/.test(normalizedPath)) {
    return 'resource.model.file.view';
  }
  if (normalizedMethod === 'GET' && normalizedPath === '/api/voice/preferences') return 'voice.preferences.view';
  if (normalizedMethod === 'PATCH' && normalizedPath === '/api/voice/preferences') {
    return actionWithFailure('voice.preferences.update', statusCode);
  }
  if (normalizedMethod === 'POST' && normalizedPath === '/api/activity-events') {
    return actionWithFailure('activity.event.submit', statusCode);
  }
  if (normalizedMethod === 'POST' && normalizedPath === '/api/ai/completion') return 'ai.completion';
  if (normalizedMethod === 'POST' && normalizedPath === '/api/ai/stream') return 'ai.stream';
  if (normalizedMethod === 'POST' && normalizedPath === '/api/memory/sessions') return 'memory.session.create';
  if (normalizedMethod === 'GET' && normalizedPath === '/api/memory/sessions') return 'memory.session.list';
  if (normalizedMethod === 'GET' && /^\/api\/memory\/sessions\/\d+\/messages$/.test(normalizedPath)) {
    return 'memory.session.messages.view';
  }
  if (normalizedMethod === 'POST' && /^\/api\/memory\/sessions\/\d+\/messages$/.test(normalizedPath)) {
    return 'memory.session.message.create';
  }
  if (normalizedMethod === 'GET' && normalizedPath === '/api/memory/settings') return 'memory.settings.view';
  if (normalizedMethod === 'PATCH' && normalizedPath === '/api/memory/settings') return 'memory.settings.update';
  if (normalizedMethod === 'GET' && normalizedPath === '/api/memory/memories') return 'memory.list';
  if (normalizedMethod === 'PATCH' && /^\/api\/memory\/memories\/\d+$/.test(normalizedPath)) return 'memory.update';
  if (normalizedMethod === 'DELETE' && /^\/api\/memory\/memories\/\d+$/.test(normalizedPath)) return 'memory.delete';
  if (normalizedMethod === 'DELETE' && normalizedPath === '/api/memory/memories') return 'memory.clear';

  const fallbackPath = normalizedPath
    .replace(/^\/api\/?/, '')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '') || 'root';
  return `api.${normalizedMethod.toLowerCase()}.${fallbackPath}`.slice(0, 128);
}

export function isAnonymousAuthPath(path) {
  return /^\/api\/auth\/(register|login|admin\/login|logout)$/.test(normalizePath(path));
}

export function buildActivityLogEntry({ req, statusCode, action, description, user } = {}) {
  const resolvedUser = user === undefined ? req?.user : user;
  const numericUserId = Number(resolvedUser?.id);
  const userId = Number.isSafeInteger(numericUserId) && numericUserId > 0 ? numericUserId : null;
  const username = typeof resolvedUser?.username === 'string'
    ? resolvedUser.username.slice(0, 64)
    : null;
  const rawPath = normalizePath(req?.path || req?.originalUrl || '/');
  const numericStatusCode = Number(statusCode);
  const logAction = String(action || mapActivityAction({ method: req?.method, path: rawPath, statusCode }))
    .slice(0, 128);
  const normalizedDescription = typeof description === 'string' ? normalizeDisplayText(description) : '';

  return {
    userId,
    usernameSnapshot: username,
    action: logAction,
    description: truncateText(
      normalizedDescription || buildActivityLogDescription({
        action: logAction,
        method: req?.method,
        path: rawPath,
        statusCode,
      }),
      MAX_LOG_DESCRIPTION_LENGTH,
    ),
    method: String(req?.method || 'GET').toUpperCase().slice(0, 16),
    path: rawPath.slice(0, MAX_LOG_PATH_LENGTH),
    statusCode: Number.isInteger(numericStatusCode) ? numericStatusCode : null,
    ipAddress: resolveRequestIp(req),
    userAgent: typeof req?.headers?.['user-agent'] === 'string'
      ? req.headers['user-agent'].slice(0, MAX_LOG_USER_AGENT_LENGTH)
      : null,
  };
}

export async function writeActivityLog(pool, entry) {
  if (!pool || typeof pool.execute !== 'function') return;

  try {
    await pool.execute(
      `INSERT INTO activity_logs
        (user_id, username_snapshot, action, description, method, path, status_code, ip_address, user_agent)
       VALUES (:userId, :usernameSnapshot, :action, :description, :method, :path, :statusCode, :ipAddress, :userAgent)`,
      entry,
    );
  } catch (error) {
    console.error('Activity log write failed:', error);
  }
}

export async function updateLastAccess(pool, { userId, ipAddress } = {}) {
  const numericUserId = Number(userId);
  if (!pool || typeof pool.execute !== 'function' || !Number.isSafeInteger(numericUserId) || numericUserId <= 0) return;

  try {
    await pool.execute(
      `UPDATE users
       SET updated_at = updated_at,
           last_access_at = CURRENT_TIMESTAMP,
           last_access_ip = COALESCE(:ipAddress, last_access_ip)
       WHERE id = :userId`,
      { userId: numericUserId, ipAddress: normalizeIpAddress(ipAddress) },
    );
  } catch (error) {
    console.error('Last access update failed:', error);
  }
}

async function ensureActivityLogColumn(pool, name, definition) {
  const [columns] = await pool.query('SHOW COLUMNS FROM activity_logs LIKE ?', [name]);
  if (columns.length === 0) {
    await pool.query(`ALTER TABLE activity_logs ADD COLUMN ${name} ${definition}`);
  }
}

export async function initializeActivityLog(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      username_snapshot VARCHAR(64) NULL,
      action VARCHAR(128) NOT NULL,
      description TEXT NULL,
      method VARCHAR(16) NOT NULL,
      path VARCHAR(512) NOT NULL,
      status_code SMALLINT UNSIGNED NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY activity_logs_created_index (created_at, id),
      KEY activity_logs_user_created_index (user_id, created_at, id),
      CONSTRAINT activity_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureActivityLogColumn(pool, 'description', 'TEXT NULL AFTER action');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY user_feedback_user_created_index (user_id, created_at),
      CONSTRAINT user_feedback_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export function createActivityLogMiddleware({ getPool } = {}) {
  return (req, res, next) => {
    res.once('finish', () => {
      const user = req.activityLogUser === undefined ? req.user : req.activityLogUser;
      const shouldLog = user || req.activityLogLogAnonymous || isAnonymousAuthPath(req.path);
      if (!shouldLog) return;

      const statusCode = res.statusCode;
      const entry = buildActivityLogEntry({
        req,
        statusCode,
        action: req.activityLogAction || mapActivityAction({
          method: req.method,
          path: req.path,
          statusCode,
        }),
        description: req.activityLogDescription,
        user,
      });

      let pool;
      try {
        pool = getPool?.();
      } catch (error) {
        console.error('Activity log pool lookup failed:', error);
        return;
      }

      void writeActivityLog(pool, entry);
      if (user && !req.accessMetadataPersisted) {
        void updateLastAccess(pool, {
          userId: entry.userId,
          ipAddress: entry.ipAddress,
        });
      }
    });

    next();
  };
}
