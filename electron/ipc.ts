import { ipcMain } from 'electron'
import * as http from 'http'
import * as https from 'https'
import type {
  HttpRequest,
  HttpResponse,
  KeyValuePair,
  CookieItem,
  RawSubType,
} from '../src/types'
import { URL } from 'url'

const pendingRequests = new Map<string, http.ClientRequest>()
const cookieJar: CookieItem[] = []

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function buildHeaders(pairs: KeyValuePair[]): Record<string, string> {
  const headers: Record<string, string> = {}
  pairs
    .filter((p) => p.enabled && p.key.trim() !== '')
    .forEach((p) => {
      headers[p.key] = p.value
    })
  return headers
}

function getRawContentType(subType: RawSubType): string {
  switch (subType) {
    case 'JSON':
      return 'application/json'
    case 'XML':
      return 'application/xml'
    case 'HTML':
      return 'text/html'
    case 'JavaScript':
      return 'application/javascript'
    case 'Text':
    default:
      return 'text/plain'
  }
}

function buildAuthHeaders(auth: HttpRequest['auth']): {
  headers: Record<string, string>
  queryParams: KeyValuePair[]
} {
  const headers: Record<string, string> = {}
  const queryParams: KeyValuePair[] = []

  if (!auth || auth.type === 'no-auth') {
    return { headers, queryParams }
  }

  switch (auth.type) {
    case 'basic':
      if (auth.basic) {
        const credentials = `${auth.basic.username}:${auth.basic.password}`
        headers['Authorization'] = 'Basic ' + Buffer.from(credentials).toString('base64')
      }
      break
    case 'bearer':
      if (auth.bearer?.token) {
        headers['Authorization'] = 'Bearer ' + auth.bearer.token
      }
      break
    case 'api-key':
      if (auth.apiKey?.key && auth.apiKey.value) {
        if (auth.apiKey.in === 'header') {
          headers[auth.apiKey.key] = auth.apiKey.value
        } else {
          queryParams.push({
            id: generateId(),
            key: auth.apiKey.key,
            value: auth.apiKey.value,
            enabled: true,
          })
        }
      }
      break
    case 'oauth2':
      if (auth.oauth2?.token) {
        headers['Authorization'] = 'Bearer ' + auth.oauth2.token
      }
      break
  }

  return { headers, queryParams }
}

function buildCookieHeader(cookies: CookieItem[], url: string): string {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname

    const matchedCookies = cookies.filter((cookie) => {
      if (!cookie.enabled || !cookie.name) return false
      if (cookie.domain) {
        const domainMatch = host.endsWith(cookie.domain) || host === cookie.domain
        if (!domainMatch) return false
      }
      if (cookie.path && !parsedUrl.pathname.startsWith(cookie.path)) {
        return false
      }
      return true
    })

    return matchedCookies.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    return cookies
      .filter((c) => c.enabled && c.name)
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')
  }
}

function parseSetCookie(setCookieValue: string, url: string): CookieItem {
  const parts = setCookieValue.split(';').map((p) => p.trim())
  const [nameValue, ...attrs] = parts
  const [name, ...valueParts] = nameValue.split('=')
  const value = valueParts.join('=')

  const cookie: CookieItem = {
    id: generateId(),
    name: name?.trim() || '',
    value: value?.trim() || '',
    domain: '',
    path: '/',
    httpOnly: false,
    secure: false,
    enabled: true,
  }

  try {
    const parsedUrl = new URL(url)
    cookie.domain = parsedUrl.hostname
  } catch {}

  attrs.forEach((attr) => {
    const [attrName, attrValue] = attr.split('=')
    const lowerName = attrName?.trim().toLowerCase()

    if (lowerName === 'httponly') {
      cookie.httpOnly = true
    } else if (lowerName === 'secure') {
      cookie.secure = true
    } else if (lowerName === 'domain') {
      cookie.domain = attrValue?.trim() || cookie.domain
    } else if (lowerName === 'path') {
      cookie.path = attrValue?.trim() || '/'
    } else if (lowerName === 'expires' || lowerName === 'max-age') {
      cookie.expires = attrValue?.trim()
    }
  })

  return cookie
}

function mergeCookies(existing: CookieItem[], newCookies: CookieItem[]): CookieItem[] {
  const result = [...existing]
  newCookies.forEach((newCookie) => {
    const index = result.findIndex(
      (c) =>
        c.name === newCookie.name && c.domain === newCookie.domain && c.path === newCookie.path
    )
    if (index >= 0) {
      result[index] = { ...result[index], ...newCookie, id: result[index].id }
    } else {
      result.push(newCookie)
    }
  })
  return result
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const parts = dataUrl.split(',')
  const meta = parts[0]
  const base64Data = parts[1]
  const contentType = meta.split(':')[1].split(';')[0]
  const buffer = Buffer.from(base64Data, 'base64')
  return { buffer, contentType }
}

function buildRequestBody(
  request: HttpRequest
): { body: Buffer | string | null; contentType: string | null; isFormData: boolean } {
  if (!request.bodyConfig) {
    return { body: request.body || null, contentType: null, isFormData: false }
  }

  const bodyConfig = request.bodyConfig

  switch (bodyConfig.type) {
    case 'none':
      return { body: null, contentType: null, isFormData: false }

    case 'x-www-form-urlencoded':
      if (bodyConfig.urlEncoded) {
        const params = new URLSearchParams()
        bodyConfig.urlEncoded
          .filter((p) => p.enabled && p.key.trim())
          .forEach((p) => {
            params.append(p.key, p.value)
          })
        return {
          body: params.toString(),
          contentType: 'application/x-www-form-urlencoded',
          isFormData: false,
        }
      }
      return { body: null, contentType: null, isFormData: false }

    case 'raw':
      if (bodyConfig.raw) {
        const contentType = getRawContentType(bodyConfig.raw.subType)
        return { body: bodyConfig.raw.content, contentType, isFormData: false }
      }
      return { body: null, contentType: null, isFormData: false }

    case 'graphql':
      if (bodyConfig.graphql?.query) {
        try {
          let variables = {}
          if (bodyConfig.graphql.variables) {
            variables = JSON.parse(bodyConfig.graphql.variables)
          }
          return {
            body: JSON.stringify({ query: bodyConfig.graphql.query, variables }),
            contentType: 'application/json',
            isFormData: false,
          }
        } catch {
          return {
            body: JSON.stringify({ query: bodyConfig.graphql.query }),
            contentType: 'application/json',
            isFormData: false,
          }
        }
      }
      return { body: null, contentType: null, isFormData: false }

    case 'form-data':
      if (bodyConfig.formData) {
        const boundary = '----PostBoyBoundary' + Date.now().toString(16)
        const chunks: Buffer[] = []

        bodyConfig.formData
          .filter((f) => f.enabled && f.key.trim())
          .forEach((f) => {
            chunks.push(Buffer.from(`--${boundary}\r\n`))
            if (f.type === 'file' && f.fileData && f.fileName) {
              try {
                const { buffer, contentType } = dataUrlToBuffer(f.fileData)
                chunks.push(
                  Buffer.from(
                    `Content-Disposition: form-data; name="${f.key}"; filename="${f.fileName}"\r\n`
                  )
                )
                chunks.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`))
                chunks.push(buffer)
              } catch {
                chunks.push(
                  Buffer.from(`Content-Disposition: form-data; name="${f.key}"\r\n\r\n`)
                )
                chunks.push(Buffer.from(f.value))
              }
            } else {
              chunks.push(
                Buffer.from(`Content-Disposition: form-data; name="${f.key}"\r\n\r\n`)
              )
              chunks.push(Buffer.from(f.value))
            }
            chunks.push(Buffer.from('\r\n'))
          })

        chunks.push(Buffer.from(`--${boundary}--\r\n`))

        return {
          body: Buffer.concat(chunks),
          contentType: `multipart/form-data; boundary=${boundary}`,
          isFormData: true,
        }
      }
      return { body: null, contentType: null, isFormData: false }

    case 'binary':
      if (bodyConfig.binary?.fileData && bodyConfig.binary.fileName) {
        try {
          const { buffer, contentType } = dataUrlToBuffer(bodyConfig.binary.fileData)
          return { body: buffer, contentType, isFormData: false }
        } catch {
          return { body: null, contentType: null, isFormData: false }
        }
      }
      return { body: null, contentType: null, isFormData: false }

    default:
      return { body: request.body || null, contentType: null, isFormData: false }
  }
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

    const { headers: authHeaders, queryParams: authQueryParams } = buildAuthHeaders(request.auth)
    Object.assign(headers, authHeaders)

    if (authQueryParams.length > 0) {
      authQueryParams.forEach((p) => {
        parsedUrl.searchParams.append(p.key, p.value)
      })
    }

    const allCookies = [...cookieJar, ...(request.cookies || [])]
    const cookieHeader = buildCookieHeader(allCookies, parsedUrl.toString())
    if (cookieHeader && !headers['Cookie']) {
      headers['Cookie'] = cookieHeader
    }

    const { body, contentType } = buildRequestBody(request)
    if (contentType && !headers['Content-Type']) {
      headers['Content-Type'] = contentType
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

        const setCookieValues: string | string[] = res.headers['set-cookie'] || []
        const setCookieArray = Array.isArray(setCookieValues)
          ? setCookieValues
          : [setCookieValues]
        const responseCookies: CookieItem[] = setCookieArray.map((v) =>
          parseSetCookie(v, parsedUrl.toString())
        )

        if (responseCookies.length > 0) {
          const merged = mergeCookies(cookieJar, responseCookies)
          cookieJar.length = 0
          cookieJar.push(...merged)
        }

        const response: HttpResponse = {
          statusCode: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: res.headers as Record<string, string | string[]>,
          body: buffer.toString('utf-8'),
          time: endTime - startTime,
          size: buffer.length,
          cookies: responseCookies,
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

    if (body) {
      req.write(body)
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

ipcMain.handle('http:getCookies', async () => {
  return cookieJar
})

ipcMain.handle('http:clearCookies', async () => {
  cookieJar.length = 0
  return { success: true }
})
