import { generateId, createEmptyPair } from '../utils'
import type {
  MockRule,
  MockResponse,
  MockServerConfig,
  MockLogEntry,
  MockMatchCondition,
  HttpMethod,
  KeyValuePair,
  HttpRequest,
  HttpResponse,
} from '../types'

const MOCK_STORAGE_KEY = 'postboy_mock'
const DEFAULT_CONFIG: MockServerConfig = {
  enabled: false,
  port: 3001,
  host: '127.0.0.1',
  globalDelay: 0,
  corsEnabled: true,
}

let rules: MockRule[] = []
let config: MockServerConfig = { ...DEFAULT_CONFIG }
let logs: MockLogEntry[] = []
const listeners = new Set<() => void>()

function load(): void {
  try {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      rules = Array.isArray(parsed.rules) ? parsed.rules.map(normalizeRule) : []
      config = parsed.config ? { ...DEFAULT_CONFIG, ...parsed.config } : { ...DEFAULT_CONFIG }
      logs = Array.isArray(parsed.logs) ? parsed.logs : []
    }
  } catch {
    rules = []
    config = { ...DEFAULT_CONFIG }
    logs = []
  }
}

function normalizeCondition(c: any): MockMatchCondition {
  return {
    id: c.id || generateId(),
    type: c.type || 'exact',
    key: c.key || '',
    value: c.value || '',
    operator: c.operator || 'equal',
    enabled: c.enabled !== false,
  }
}

function normalizeResponse(r: any): MockResponse {
  return {
    id: r.id || generateId(),
    name: r.name || '默认响应',
    statusCode: r.statusCode || 200,
    headers: Array.isArray(r.headers) ? r.headers : [createEmptyPair()],
    body: r.body || '',
    bodyType: r.bodyType || 'json',
    delay: r.delay || 0,
    isDefault: r.isDefault || false,
    matchConditions: Array.isArray(r.matchConditions) ? r.matchConditions.map(normalizeCondition) : [],
  }
}

function normalizeRule(r: any): MockRule {
  return {
    id: r.id || generateId(),
    name: r.name || '新建 Mock',
    description: r.description || '',
    enabled: r.enabled !== false,
    method: r.method || 'GET',
    path: r.path || '/api/example',
    priority: r.priority || 0,
    responses: Array.isArray(r.responses) ? r.responses.map(normalizeResponse) : [createDefaultResponse()],
    createdAt: r.createdAt || Date.now(),
    updatedAt: r.updatedAt || Date.now(),
  }
}

function save(): void {
  try {
    localStorage.setItem(
      MOCK_STORAGE_KEY,
      JSON.stringify({ rules, config, logs: logs.slice(0, 500) })
    )
  } catch {}
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

export function createEmptyMatchCondition(): MockMatchCondition {
  return {
    id: generateId(),
    type: 'query',
    key: '',
    value: '',
    operator: 'equal',
    enabled: true,
  }
}

export function createDefaultResponse(): MockResponse {
  return {
    id: generateId(),
    name: '默认响应',
    statusCode: 200,
    headers: [createEmptyPair()],
    body: JSON.stringify({ message: 'success' }, null, 2),
    bodyType: 'json',
    delay: 0,
    isDefault: true,
    matchConditions: [],
  }
}

export function createEmptyRule(): MockRule {
  const now = Date.now()
  return {
    id: generateId(),
    name: '新建 Mock',
    description: '',
    enabled: true,
    method: 'GET',
    path: '/api/example',
    priority: 0,
    responses: [createDefaultResponse()],
    createdAt: now,
    updatedAt: now,
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRules(): MockRule[] {
  return rules
}

export function getEnabledRules(): MockRule[] {
  return rules.filter((r) => r.enabled)
}

export function getConfig(): MockServerConfig {
  return { ...config }
}

export function getLogs(): MockLogEntry[] {
  return logs
}

export function getRule(id: string): MockRule | undefined {
  return rules.find((r) => r.id === id)
}

export function addRule(rule: Omit<MockRule, 'id' | 'createdAt' | 'updatedAt'>): MockRule {
  const now = Date.now()
  const newRule: MockRule = {
    ...rule,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }
  rules.push(newRule)
  save()
  notifyListeners()
  return newRule
}

export function updateRule(id: string, updates: Partial<MockRule>): void {
  const rule = rules.find((r) => r.id === id)
  if (rule) {
    Object.assign(rule, updates, { updatedAt: Date.now() })
    save()
    notifyListeners()
  }
}

export function deleteRule(id: string): void {
  const index = rules.findIndex((r) => r.id === id)
  if (index >= 0) {
    rules.splice(index, 1)
    save()
    notifyListeners()
  }
}

export function duplicateRule(id: string): MockRule | null {
  const rule = rules.find((r) => r.id === id)
  if (!rule) return null
  const now = Date.now()
  const duplicated: MockRule = {
    ...JSON.parse(JSON.stringify(rule)),
    id: generateId(),
    name: `${rule.name} (副本)`,
    enabled: false,
    createdAt: now,
    updatedAt: now,
  }
  duplicated.responses = duplicated.responses.map((r) => ({
    ...r,
    id: generateId(),
  }))
  rules.push(duplicated)
  save()
  notifyListeners()
  return duplicated
}

export function updateConfig(updates: Partial<MockServerConfig>): void {
  Object.assign(config, updates)
  save()
  notifyListeners()
}

export function addLog(entry: Omit<MockLogEntry, 'id' | 'timestamp'>): MockLogEntry {
  const log: MockLogEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  }
  logs.unshift(log)
  if (logs.length > 500) {
    logs = logs.slice(0, 500)
  }
  save()
  notifyListeners()
  return log
}

export function clearLogs(): void {
  logs = []
  save()
  notifyListeners()
}

export function replaceLogs(newLogs: MockLogEntry[]): void {
  logs = newLogs.slice(0, 500)
  save()
  notifyListeners()
}

export function createRuleFromRequest(
  request: HttpRequest,
  response?: HttpResponse
): MockRule {
  const now = Date.now()
  let path = '/'
  try {
    const url = new URL(request.url)
    path = url.pathname
  } catch {
    path = request.url
  }

  const responseHeaders: KeyValuePair[] = []
  if (response) {
    Object.entries(response.headers).forEach(([key, value]) => {
      responseHeaders.push({
        id: generateId(),
        key,
        value: Array.isArray(value) ? value.join(', ') : value,
        enabled: true,
      })
    })
  }

  const mockResponse: MockResponse = {
    id: generateId(),
    name: '默认响应',
    statusCode: response?.statusCode || 200,
    headers: responseHeaders.length > 0 ? responseHeaders : [createEmptyPair()],
    body: response?.body || JSON.stringify({ message: 'success' }, null, 2),
    bodyType: 'json',
    delay: 0,
    isDefault: true,
    matchConditions: [],
  }

  const rule: MockRule = {
    id: generateId(),
    name: `Mock ${request.method} ${path}`,
    description: '',
    enabled: true,
    method: request.method as HttpMethod,
    path,
    priority: 0,
    responses: [mockResponse],
    createdAt: now,
    updatedAt: now,
  }

  rules.push(rule)
  save()
  notifyListeners()
  return rule
}

export function getAllData(): { rules: MockRule[]; config: MockServerConfig; logs: MockLogEntry[] } {
  return {
    rules: JSON.parse(JSON.stringify(rules)),
    config: { ...config },
    logs: JSON.parse(JSON.stringify(logs)),
  }
}

load()
