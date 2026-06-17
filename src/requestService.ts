import type { HttpRequest, HttpResponse, KeyValuePair, CookieItem } from './types'
import {
  buildAuthHeaders,
  buildCookieHeader,
  getBodyContentType,
  getRawContentType,
  parseSetCookie,
  mergeCookies,
} from './utils'

const abortControllers = new Map<string, AbortController>()

export interface CookieStorage {
  getCookies: () => CookieItem[]
  setCookies: (cookies: CookieItem[]) => void
}

const inMemoryCookies: CookieItem[] = []

const defaultCookieStorage: CookieStorage = {
  getCookies: () => inMemoryCookies,
  setCookies: (cookies: CookieItem[]) => {
    inMemoryCookies.length = 0
    inMemoryCookies.push(...cookies)
  },
}

let cookieStorage: CookieStorage = defaultCookieStorage

export function setCookieStorage(storage: CookieStorage) {
  cookieStorage = storage
}

export function getAllCookies(): CookieItem[] {
  return cookieStorage.getCookies()
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

function buildRequestBody(
  request: HttpRequest
): { body: BodyInit | null | undefined; contentType: string | null } {
  if (!request.bodyConfig) {
    return { body: request.body || undefined, contentType: null }
  }

  const bodyConfig = request.bodyConfig

  switch (bodyConfig.type) {
    case 'none':
      return { body: undefined, contentType: null }

    case 'x-www-form-urlencoded':
      if (bodyConfig.urlEncoded) {
        const params = new URLSearchParams()
        bodyConfig.urlEncoded
          .filter((p) => p.enabled && p.key.trim())
          .forEach((p) => {
            params.append(p.key, p.value)
          })
        return { body: params.toString(), contentType: 'application/x-www-form-urlencoded' }
      }
      return { body: undefined, contentType: null }

    case 'raw':
      if (bodyConfig.raw) {
        const contentType = getRawContentType(bodyConfig.raw.subType)
        return { body: bodyConfig.raw.content, contentType }
      }
      return { body: undefined, contentType: null }

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
          }
        } catch {
          return {
            body: JSON.stringify({ query: bodyConfig.graphql.query }),
            contentType: 'application/json',
          }
        }
      }
      return { body: undefined, contentType: null }

    case 'form-data':
      if (bodyConfig.formData) {
        const formData = new FormData()
        bodyConfig.formData
          .filter((f) => f.enabled && f.key.trim())
          .forEach((f) => {
            if (f.type === 'file' && f.fileData && f.fileName) {
              try {
                const byteString = atob(f.fileData.split(',')[1])
                const mimeString = f.fileData.split(',')[0].split(':')[1].split(';')[0]
                const ab = new ArrayBuffer(byteString.length)
                const ia = new Uint8Array(ab)
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i)
                }
                const blob = new Blob([ab], { type: mimeString })
                formData.append(f.key, blob, f.fileName)
              } catch {
                formData.append(f.key, f.value)
              }
            } else {
              formData.append(f.key, f.value)
            }
          })
        return { body: formData, contentType: null }
      }
      return { body: undefined, contentType: null }

    case 'binary':
      if (bodyConfig.binary?.fileData && bodyConfig.binary.fileName) {
        try {
          const byteString = atob(bodyConfig.binary.fileData.split(',')[1])
          const mimeString = bodyConfig.binary.fileData.split(',')[0].split(':')[1].split(';')[0]
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
          }
          const blob = new Blob([ab], { type: mimeString })
          return { body: blob, contentType: mimeString }
        } catch {
          return { body: undefined, contentType: null }
        }
      }
      return { body: undefined, contentType: null }

    default:
      return { body: request.body || undefined, contentType: null }
  }
}

async function fetchRequest(request: HttpRequest): Promise<HttpResponse> {
  const controller = new AbortController()
  abortControllers.set(request.id, controller)

  const startTime = Date.now()
  const headers = buildHeaders(request.headers)

  const { headers: authHeaders, queryParams: authQueryParams } = buildAuthHeaders(request.auth)
  Object.assign(headers, authHeaders)

  let finalUrl = request.url
  if (authQueryParams.length > 0) {
    const url = new URL(request.url)
    authQueryParams.forEach((p) => {
      url.searchParams.append(p.key, p.value)
    })
    finalUrl = url.toString()
  }

  const existingCookies = cookieStorage.getCookies()
  const allCookies = [...existingCookies, ...(request.cookies || [])]
  const cookieHeader = buildCookieHeader(allCookies, finalUrl)
  if (cookieHeader && !headers['Cookie']) {
    headers['Cookie'] = cookieHeader
  }

  const { body, contentType } = buildRequestBody(request)
  if (contentType && !headers['Content-Type']) {
    headers['Content-Type'] = contentType
  }
  if (request.bodyConfig && !headers['Content-Type']) {
    const ct = getBodyContentType(request.bodyConfig)
    if (ct && ct !== 'multipart/form-data') {
      headers['Content-Type'] = ct
    }
  }

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, request.timeout)

  try {
    const response = await fetch(finalUrl, {
      method: request.method,
      headers,
      body: body as BodyInit | null | undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const text = await response.text()
    const endTime = Date.now()

    const responseHeaders: Record<string, string> = {}
    const setCookieValues: string[] = []
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value
      if (name.toLowerCase() === 'set-cookie') {
        setCookieValues.push(value)
      }
    })

    const responseCookies: CookieItem[] = setCookieValues.map((v) => parseSetCookie(v, finalUrl))
    if (responseCookies.length > 0) {
      const merged = mergeCookies(existingCookies, responseCookies)
      cookieStorage.setCookies(merged)
    }

    abortControllers.delete(request.id)

    const size = new Blob([text]).size

    return {
      statusCode: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: text,
      time: endTime - startTime,
      size,
      cookies: responseCookies,
    }
  } catch (error) {
    abortControllers.delete(request.id)
    clearTimeout(timeoutId)

    const err = error as Error
    if (err.name === 'AbortError') {
      throw new Error('请求已取消')
    }

    let message = err.message || '请求失败'
    if (message === 'Failed to fetch') {
      message = `请求失败 (Failed to fetch)

可能的原因:
1. 网络连接问题
2. 目标服务器不可达
3. 跨域 (CORS) 限制（浏览器环境）
4. URL 地址不正确

提示: 如果在浏览器中遇到 CORS 限制，请使用 Electron 桌面端。`
    }
    throw new Error(message)
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'
}

export function sendRequest(request: HttpRequest): Promise<HttpResponse> {
  if (isElectron()) {
    return window.electronAPI.sendRequest(request)
  }
  return fetchRequest(request)
}

export function cancelRequest(requestId: string): void {
  if (isElectron()) {
    window.electronAPI.cancelRequest(requestId)
    return
  }
  const controller = abortControllers.get(requestId)
  if (controller) {
    controller.abort()
    abortControllers.delete(requestId)
  }
}
