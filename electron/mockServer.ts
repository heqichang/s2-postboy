import * as http from 'http'
import type { MockRule, MockServerConfig, MockLogEntry } from '../src/types'
import { findMatchingRule, renderBody, renderHeaders, TemplateContext } from '../src/mockEngine'

export interface MockServerState {
  server: http.Server | null
  running: boolean
  port: number
  host: string
  startTime: number | null
  requestCount: number
  rules: MockRule[]
  config: MockServerConfig
  logs: MockLogEntry[]
  logCallback: ((log: MockLogEntry) => void) | null
}

const state: MockServerState = {
  server: null,
  running: false,
  port: 3001,
  host: '127.0.0.1',
  startTime: null,
  requestCount: 0,
  rules: [],
  config: {
    enabled: false,
    port: 3001,
    host: '127.0.0.1',
    globalDelay: 0,
    corsEnabled: true,
  },
  logs: [],
  logCallback: null,
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'))
    })
    req.on('error', () => {
      resolve('')
    })
  })
}

function addLog(log: Omit<MockLogEntry, 'id' | 'timestamp'>): void {
  const entry: MockLogEntry = {
    ...log,
    id: Math.random().toString(36).substring(2, 15),
    timestamp: Date.now(),
  }
  state.logs.unshift(entry)
  if (state.logs.length > 500) {
    state.logs = state.logs.slice(0, 500)
  }
  if (state.logCallback) {
    state.logCallback(entry)
  }
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const startTime = Date.now()
  state.requestCount++

  const method = req.method || 'GET'
  const url = req.url || '/'
  const headers: Record<string, string> = {}
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value
    }
  })

  if (state.config.corsEnabled) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Expose-Headers', '*')
  }

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    addLog({
      method,
      url,
      statusCode: 204,
      requestHeaders: headers,
      responseHeaders: {},
      responseTime: Date.now() - startTime,
    })
    return
  }

  readRequestBody(req).then((body) => {
    const matched = findMatchingRule(state.rules, {
      url,
      method,
      headers,
      body,
    })

    if (!matched) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      const notFoundBody = JSON.stringify(
        { error: 'No mock rule matched', path: url, method },
        null,
        2
      )
      const finalDelay = state.config.globalDelay
      setTimeout(() => {
        res.end(notFoundBody)
        addLog({
          method,
          url,
          statusCode: 404,
          requestHeaders: headers,
          requestBody: body,
          responseHeaders: { 'Content-Type': 'application/json' },
          responseBody: notFoundBody,
          responseTime: Date.now() - startTime,
        })
      }, finalDelay)
      return
    }

    const { rule, response: mockResp, pathParams, queryParams } = matched

    const context: TemplateContext = {
      request: {
        url,
        method,
        pathParams,
        queryParams,
        headers,
        body,
        parsedBody: (() => {
          try {
            return body ? JSON.parse(body) : undefined
          } catch {
            return undefined
          }
        })(),
      },
    }

    const responseBody = renderBody(mockResp.body, context)
    const responseHeaders = renderHeaders(mockResp.headers, context)

    res.statusCode = mockResp.statusCode

    let hasContentType = false
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value)
      if (key.toLowerCase() === 'content-type') {
        hasContentType = true
      }
    })

    if (!hasContentType) {
      switch (mockResp.bodyType) {
        case 'json':
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          break
        case 'xml':
          res.setHeader('Content-Type', 'application/xml; charset=utf-8')
          break
        case 'html':
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          break
        case 'text':
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          break
      }
    }

    const finalDelay = state.config.globalDelay + mockResp.delay

    setTimeout(() => {
      res.end(responseBody)
      addLog({
        method,
        url,
        matchedRuleId: rule.id,
        matchedResponseId: mockResp.id,
        statusCode: mockResp.statusCode,
        requestHeaders: headers,
        requestBody: body,
        responseHeaders: {
          ...responseHeaders,
          ...(res.getHeaders() as Record<string, string>),
        },
        responseBody,
        responseTime: Date.now() - startTime,
      })
    }, finalDelay)
  })
}

export function setRules(rules: MockRule[]): void {
  state.rules = rules
}

export function setConfig(config: MockServerConfig): void {
  state.config = { ...state.config, ...config }
}

export function setLogCallback(callback: (log: MockLogEntry) => void): void {
  state.logCallback = callback
}

export function getStatus() {
  return {
    running: state.running,
    port: state.port,
    host: state.host,
    url: state.running ? `http://${state.host}:${state.port}` : '',
    startTime: state.startTime,
    requestCount: state.requestCount,
  }
}

export function getLogs(): MockLogEntry[] {
  return state.logs
}

export function clearLogs(): void {
  state.logs = []
}

export function startServer(port: number, host: string, rules: MockRule[], config: MockServerConfig): Promise<{ success: boolean; error?: string; url?: string }> {
  return new Promise((resolve) => {
    if (state.running && state.server) {
      resolve({ success: true, url: `http://${state.host}:${state.port}` })
      return
    }

    state.rules = rules
    state.config = { ...state.config, ...config }
    state.port = port
    state.host = host
    state.requestCount = 0

    const server = http.createServer(handleRequest)

    server.on('error', (err: NodeJS.ErrnoException) => {
      resolve({ success: false, error: err.message })
    })

    server.listen(port, host, () => {
      state.server = server
      state.running = true
      state.startTime = Date.now()
      resolve({ success: true, url: `http://${host}:${port}` })
    })
  })
}

export function stopServer(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!state.running || !state.server) {
      resolve({ success: true })
      return
    }

    state.server.close((err) => {
      if (err) {
        resolve({ success: false, error: err.message })
      } else {
        state.server = null
        state.running = false
        state.startTime = null
        resolve({ success: true })
      }
    })
  })
}

export function restartServer(port: number, host: string, rules: MockRule[], config: MockServerConfig): Promise<{ success: boolean; error?: string; url?: string }> {
  return new Promise(async (resolve) => {
    if (state.running) {
      await stopServer()
    }
    const result = await startServer(port, host, rules, config)
    resolve(result)
  })
}
