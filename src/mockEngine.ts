import type {
  MockRule,
  MockResponse,
  MockMatchCondition,
  KeyValuePair,
} from './types'

const FIRST_NAMES = [
  '张', '李', '王', '赵', '刘', '陈', '杨', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '郑',
]
const LAST_NAMES = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平',
]
const DOMAINS = ['gmail.com', 'qq.com', '163.com', 'outlook.com', 'yahoo.com', 'foxmail.com']
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆']
const COMPANIES = ['科技有限公司', '网络科技', '信息技术', '电子商务', '软件开发', '数据服务']

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function randomFullName(): string {
  return randomElement(FIRST_NAMES) + randomElement(LAST_NAMES)
}

export function randomFirstName(): string {
  return randomElement(FIRST_NAMES)
}

export function randomLastName(): string {
  return randomElement(LAST_NAMES)
}

export function randomEmail(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let name = ''
  const len = randomInt(5, 12)
  for (let i = 0; i < len; i++) {
    name += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${name}@${randomElement(DOMAINS)}`
}

export function randomPhone(): string {
  const prefixes = ['138', '139', '150', '151', '152', '158', '159', '186', '187', '188', '189']
  let phone = randomElement(prefixes)
  for (let i = 0; i < 8; i++) {
    phone += randomInt(0, 9).toString()
  }
  return phone
}

export function randomCity(): string {
  return randomElement(CITIES)
}

export function randomCompany(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let name = ''
  const len = randomInt(3, 8)
  for (let i = 0; i < len; i++) {
    name += chars[Math.floor(Math.random() * chars.length)]
  }
  return name.charAt(0).toUpperCase() + name.slice(1) + randomElement(COMPANIES)
}

export function randomBoolean(): boolean {
  return Math.random() > 0.5
}

export function randomNumber(min?: number, max?: number): number {
  const lo = min ?? 0
  const hi = max ?? 1000
  return randomInt(lo, hi)
}

export function randomFloat(min?: number, max?: number, decimals?: number): number {
  const lo = min ?? 0
  const hi = max ?? 1000
  const dec = decimals ?? 2
  const value = Math.random() * (hi - lo) + lo
  return Number(value.toFixed(dec))
}

export function randomImage(width?: number, height?: number): string {
  const w = width ?? 200
  const h = height ?? 200
  return `https://picsum.photos/${w}/${h}?random=${Date.now()}`
}

export function randomDate(start?: string, end?: string): string {
  const startDate = start ? new Date(start).getTime() : new Date(2000, 0, 1).getTime()
  const endDate = end ? new Date(end).getTime() : Date.now()
  const timestamp = randomInt(startDate, endDate)
  return new Date(timestamp).toISOString().split('T')[0]
}

export function randomDateTime(): string {
  return new Date(randomInt(new Date(2000, 0, 1).getTime(), Date.now())).toISOString()
}

export function timestamp(): number {
  return Date.now()
}

export function timestampISO(): string {
  return new Date().toISOString()
}

export function randomWord(): string {
  const words = [
    'hello', 'world', 'test', 'data', 'mock', 'api', 'user', 'product',
    'order', 'service', 'system', 'result', 'success', 'error', 'message',
  ]
  return randomElement(words)
}

export function randomWords(count?: number): string {
  const n = count ?? randomInt(3, 10)
  const words: string[] = []
  for (let i = 0; i < n; i++) {
    words.push(randomWord())
  }
  return words.join(' ')
}

export function randomUrl(): string {
  return `https://www.${randomWord()}.${randomElement(['com', 'cn', 'org', 'io', 'net'])}`
}

export function randomIp(): string {
  return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`
}

export function randomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
}

export interface TemplateContext {
  request?: {
    url: string
    method: string
    pathParams: Record<string, string>
    queryParams: Record<string, string>
    headers: Record<string, string>
    body?: string
    parsedBody?: unknown
  }
  [key: string]: unknown
}

const RANDOM_FUNCTIONS: Record<string, (args: string[]) => unknown> = {
  $randomUUID: () => randomUUID(),
  $randomFullName: () => randomFullName(),
  $randomFirstName: () => randomFirstName(),
  $randomLastName: () => randomLastName(),
  $randomEmail: () => randomEmail(),
  $randomPhone: () => randomPhone(),
  $randomCity: () => randomCity(),
  $randomCompany: () => randomCompany(),
  $randomBoolean: () => randomBoolean(),
  $randomNumber: (args) => randomNumber(args[0] ? Number(args[0]) : undefined, args[1] ? Number(args[1]) : undefined),
  $randomFloat: (args) =>
    randomFloat(
      args[0] ? Number(args[0]) : undefined,
      args[1] ? Number(args[1]) : undefined,
      args[2] ? Number(args[2]) : undefined
    ),
  $randomImage: (args) => randomImage(args[0] ? Number(args[0]) : undefined, args[1] ? Number(args[1]) : undefined),
  $randomDate: (args) => randomDate(args[0], args[1]),
  $randomDateTime: () => randomDateTime(),
  $timestamp: () => timestamp(),
  $timestampISO: () => timestampISO(),
  $randomWord: () => randomWord(),
  $randomWords: (args) => randomWords(args[0] ? Number(args[0]) : undefined),
  $randomUrl: () => randomUrl(),
  $randomIp: () => randomIp(),
  $randomColor: () => randomColor(),
  $now: () => timestampISO(),
  $today: () => new Date().toISOString().split('T')[0],
}

function getFromContext(ctx: TemplateContext, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = ctx
  for (const part of parts) {
    if (current == null) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

export function renderTemplate(template: string, context: TemplateContext = {}): string {
  if (!template) return template

  const result = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr: string) => {
    const trimmed = expr.trim()

    const funcMatch = trimmed.match(/^(\$\w+)(?:\(([^)]*)\))?$/)
    if (funcMatch) {
      const funcName = funcMatch[1]
      const argsStr = funcMatch[2] || ''
      const args = argsStr
        .split(',')
        .map((a) => a.trim().replace(/^["']|["']$/g, ''))
        .filter((a) => a !== '')
      const fn = RANDOM_FUNCTIONS[funcName]
      if (fn) {
        return String(fn(args))
      }
    }

    const value = getFromContext(context, trimmed)
    if (value !== undefined) {
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
    }

    return match
  })

  return result
}

export function renderBody(body: string, context: TemplateContext = {}): string {
  return renderTemplate(body, context)
}

export function renderHeaders(headers: KeyValuePair[], context: TemplateContext = {}): Record<string, string> {
  const result: Record<string, string> = {}
  headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      result[h.key] = renderTemplate(h.value, context)
    })
  return result
}

function parsePathParams(templatePath: string, actualPath: string): Record<string, string> | null {
  const templateParts = templatePath.split('/').filter((p) => p !== '')
  const actualParts = actualPath.split('/').filter((p) => p !== '')

  if (templateParts.length !== actualParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < templateParts.length; i++) {
    const tp = templateParts[i]
    const ap = actualParts[i]

    if (tp.startsWith(':')) {
      const paramName = tp.slice(1)
      params[paramName] = decodeURIComponent(ap)
    } else if (tp !== ap) {
      return null
    }
  }

  return params
}

function matchCondition(
  condition: MockMatchCondition,
  req: {
    url: string
    method: string
    path: string
    pathParams: Record<string, string>
    queryParams: Record<string, string>
    headers: Record<string, string>
    body?: string
    parsedBody?: unknown
  }
): boolean {
  if (!condition.enabled) return true

  const op = condition.operator || 'equal'
  const key = condition.key || ''
  const expected = condition.value || ''

  let actualValue: string | undefined

  switch (condition.type) {
    case 'pathParam':
      actualValue = req.pathParams[key]
      break
    case 'query':
      actualValue = req.queryParams[key]
      break
    case 'header':
      actualValue = Object.entries(req.headers).find(
        ([k]) => k.toLowerCase() === key.toLowerCase()
      )?.[1]
      break
    case 'body': {
      if (!req.body) return op === 'exists' ? false : true
      if (key && req.parsedBody && typeof req.parsedBody === 'object') {
        const val = (req.parsedBody as Record<string, unknown>)[key]
        actualValue = val != null ? String(val) : undefined
      } else {
        actualValue = req.body
      }
      break
    }
    case 'exact':
    default:
      return true
  }

  switch (op) {
    case 'equal':
      return actualValue === expected
    case 'contains':
      return actualValue != null && actualValue.includes(expected)
    case 'regex':
      try {
        return actualValue != null && new RegExp(expected).test(actualValue)
      } catch {
        return false
      }
    case 'exists':
      return actualValue != null && actualValue !== ''
    default:
      return false
  }
}

export interface MatchedRule {
  rule: MockRule
  response: MockResponse
  pathParams: Record<string, string>
  queryParams: Record<string, string>
}

export function findMatchingRule(
  rules: MockRule[],
  request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }
): MatchedRule | null {
  const enabledRules = rules.filter((r) => r.enabled)
  enabledRules.sort((a, b) => b.priority - a.priority)

  let parsedUrl: URL | null = null
  try {
    parsedUrl = new URL(request.url, 'http://localhost')
  } catch {
    return null
  }

  const path = parsedUrl.pathname
  const queryParams: Record<string, string> = {}
  parsedUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value
  })

  let parsedBody: unknown = undefined
  if (request.body) {
    try {
      parsedBody = JSON.parse(request.body)
    } catch {
      parsedBody = undefined
    }
  }

  for (const rule of enabledRules) {
    if (rule.method.toUpperCase() !== request.method.toUpperCase()) {
      continue
    }

    const pathParams = parsePathParams(rule.path, path)
    if (pathParams === null) {
      continue
    }

    const ruleMatchConditions = rule.responses.flatMap((r) => r.matchConditions).filter((c) => c.enabled)

    let matchedResponse: MockResponse | null = null
    let defaultResponse: MockResponse | null = null

    for (const resp of rule.responses) {
      if (resp.isDefault) {
        defaultResponse = resp
      }

      const conditions = resp.matchConditions.filter((c) => c.enabled)
      if (conditions.length === 0 && resp.isDefault) {
        continue
      }

      const allMatched = conditions.every((cond) =>
        matchCondition(cond, {
          ...request,
          path,
          pathParams,
          queryParams,
          parsedBody,
        })
      )

      if (allMatched && conditions.length > 0) {
        matchedResponse = resp
        break
      }
    }

    if (matchedResponse) {
      return { rule, response: matchedResponse, pathParams, queryParams }
    }

    if (defaultResponse) {
      return { rule, response: defaultResponse, pathParams, queryParams }
    }

    if (ruleMatchConditions.length === 0 && rule.responses.length > 0) {
      return {
        rule,
        response: rule.responses[0],
        pathParams,
        queryParams,
      }
    }
  }

  return null
}
