import { ipcMain } from 'electron'
import * as http from 'http'
import * as https from 'https'
import type { HttpRequest, HttpResponse, KeyValuePair } from '../src/types'
import { URL } from 'url'

const pendingRequests = new Map<string, http.ClientRequest>()

function buildHeaders(pairs: KeyValuePair[]): Record<string, string> {
  const headers: Record<string, string> = {}
  pairs
    .filter((p) => p.enabled && p.key.trim() !== '')
    .forEach((p) => {
      headers[p.key] = p.value
    })
  return headers
}

function makeRequest(request: HttpRequest): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let parsedUrl: URL

    try {
      parsedUrl = new URL(request.url)
    } catch (e) {
      reject(new Error('无效的 URL: ' + (e as Error).message))
      return
    }

    const isHttps = parsedUrl.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const headers = buildHeaders(request.headers)
    if (request.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const options: http.RequestOptions | https.RequestOptions = {
      method: request.method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
      path: parsedUrl.pathname + parsedUrl.search,
      headers,
      timeout: request.timeout,
    }

    const req = httpModule.request(options, (res) => {
      const chunks: Buffer[] = []

      res.on('data', (chunk) => {
        chunks.push(chunk)
      })

      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const endTime = Date.now()

        const response: HttpResponse = {
          statusCode: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: res.headers as Record<string, string | string[]>,
          body: buffer.toString('utf-8'),
          time: endTime - startTime,
          size: buffer.length,
        }

        pendingRequests.delete(request.id)
        resolve(response)
      })

      res.on('error', (err) => {
        pendingRequests.delete(request.id)
        reject(err)
      })
    })

    req.on('error', (err) => {
      pendingRequests.delete(request.id)
      reject(err)
    })

    req.on('timeout', () => {
      pendingRequests.delete(request.id)
      req.destroy(new Error('请求超时'))
    })

    pendingRequests.set(request.id, req)

    if (request.body) {
      req.write(request.body)
    }

    req.end()
  })
}

ipcMain.handle('http:request', async (_event, request: HttpRequest) => {
  return makeRequest(request)
})

ipcMain.handle('http:cancel', async (_event, requestId: string) => {
  const req = pendingRequests.get(requestId)
  if (req) {
    req.destroy(new Error('Request cancelled'))
    pendingRequests.delete(requestId)
  }
  return { success: true }
})
