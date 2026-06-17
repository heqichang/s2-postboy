import type {
  KeyValuePair,
  HttpResponse,
  FormDataField,
  CookieItem,
  RequestBody,
  AuthConfig,
  RawSubType,
  HttpRequest,
} from './types'

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

export function createEmptyPair(): KeyValuePair {
  return {
    id: generateId(),
    key: '',
    value: '',
    enabled: true,
  }
}

export function createEmptyFormDataField(): FormDataField {
  return {
    id: generateId(),
    key: '',
    value: '',
    enabled: true,
    type: 'text',
  }
}

export function createEmptyCookie(): CookieItem {
  return {
    id: generateId(),
    name: '',
    value: '',
    domain: '',
    path: '/',
    httpOnly: false,
    secure: false,
    enabled: true,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatTime(ms: number): string {
  if (ms < 1000) return ms + ' ms'
  return (ms / 1000).toFixed(2) + ' s'
}

export function formatJson(jsonStr: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(jsonStr)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: jsonStr, isJson: false }
  }
}

export function getStatusClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'warning'
  if (statusCode >= 400) return 'error'
  return ''
}

export function buildUrlWithParams(baseUrl: string, params: KeyValuePair[]): string {
  const enabledParams = params.filter((p) => p.enabled && p.key.trim() !== '')
  if (enabledParams.length === 0) return baseUrl

  const url = new URL(baseUrl)
  enabledParams.forEach((p) => {
    url.searchParams.append(p.key, p.value)
  })
  return url.toString()
}

export function headersToObject(headers: KeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {}
  headers
    .filter((h) => h.enabled && h.key.trim() !== '')
    .forEach((h) => {
      result[h.key] = h.value
    })
  return result
}

export function formatResponseHeaders(headers: HttpResponse['headers']): { name: string; value: string }[] {
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: Array.isArray(value) ? value.join(', ') : value,
  }))
}

export function getRawContentType(subType: RawSubType): string {
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

export function buildAuthHeaders(auth: AuthConfig | undefined): { headers: Record<string, string>; queryParams: KeyValuePair[] } {
  const headers: Record<string, string> = {}
  const queryParams: KeyValuePair[] = []

  if (!auth || auth.type === 'no-auth') {
    return { headers, queryParams }
  }

  switch (auth.type) {
    case 'basic':
      if (auth.basic) {
        const credentials = `${auth.basic.username}:${auth.basic.password}`
        headers['Authorization'] = 'Basic ' + btoa(credentials)
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

export function buildCookieHeader(cookies: CookieItem[], url: string): string {
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
    return cookies.filter((c) => c.enabled && c.name).map((c) => `${c.name}=${c.value}`).join('; ')
  }
}

export function parseSetCookie(setCookieValue: string, url: string): CookieItem {
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

export function generateCurlCommand(request: HttpRequest): string {
  let curl = `curl -X ${request.method}`

  const allHeaders = { ...headersToObject(request.headers) }

  const { headers: authHeaders } = buildAuthHeaders(request.auth)
  Object.assign(allHeaders, authHeaders)

  if (request.cookies && request.cookies.length > 0) {
    const cookieHeader = buildCookieHeader(request.cookies, request.url)
    if (cookieHeader) {
      allHeaders['Cookie'] = cookieHeader
    }
  }

  Object.entries(allHeaders).forEach(([key, value]) => {
    curl += ` \\\n  -H "${key}: ${value.replace(/"/g, '\\"')}"`
  })

  if (request.bodyConfig) {
    const bodyData = serializeBodyForCurl(request.bodyConfig)
    if (bodyData) {
      curl += ` \\\n  ${bodyData}`
    }
  } else if (request.body) {
    curl += ` \\\n  -d '${request.body.replace(/'/g, "'\\''")}'`
  }

  curl += ` \\\n  "${request.url}"`

  return curl
}

function serializeBodyForCurl(bodyConfig: RequestBody): string {
  switch (bodyConfig.type) {
    case 'none':
      return ''
    case 'x-www-form-urlencoded':
      if (bodyConfig.urlEncoded) {
        const params = bodyConfig.urlEncoded
          .filter((p) => p.enabled && p.key.trim())
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&')
        if (params) {
          return `--data '${params.replace(/'/g, "'\\''")}'`
        }
      }
      return ''
    case 'raw':
      if (bodyConfig.raw?.content) {
        return `--data '${bodyConfig.raw.content.replace(/'/g, "'\\''")}'`
      }
      return ''
    case 'graphql':
      if (bodyConfig.graphql?.query) {
        try {
          let variables = {}
          if (bodyConfig.graphql.variables) {
            variables = JSON.parse(bodyConfig.graphql.variables)
          }
          const data = JSON.stringify({ query: bodyConfig.graphql.query, variables })
          return `--data '${data.replace(/'/g, "'\\''")}'`
        } catch {
          return `--data '${JSON.stringify({ query: bodyConfig.graphql.query }).replace(/'/g, "'\\''")}'`
        }
      }
      return ''
    case 'form-data':
      if (bodyConfig.formData) {
        let result = ''
        bodyConfig.formData
          .filter((f) => f.enabled && f.key.trim())
          .forEach((f) => {
            if (f.type === 'file') {
              result += `-F "${f.key}=@${f.fileName || 'file'}" `
            } else {
              result += `-F "${f.key}=${f.value.replace(/"/g, '\\"')}" `
            }
          })
        return result.trim()
      }
      return ''
    case 'binary':
      if (bodyConfig.binary?.fileName) {
        return `--data-binary "@${bodyConfig.binary.fileName}"`
      }
      return ''
    default:
      return ''
  }
}

export function generateHttpRequestPreview(request: HttpRequest): string {
  let result = `${request.method} ${request.url} HTTP/1.1\n`

  const allHeaders = { ...headersToObject(request.headers) }

  const { headers: authHeaders } = buildAuthHeaders(request.auth)
  Object.assign(allHeaders, authHeaders)

  if (request.cookies && request.cookies.length > 0) {
    const cookieHeader = buildCookieHeader(request.cookies, request.url)
    if (cookieHeader) {
      allHeaders['Cookie'] = cookieHeader
    }
  }

  if (request.bodyConfig && !allHeaders['Content-Type']) {
    const contentType = getBodyContentType(request.bodyConfig)
    if (contentType) {
      allHeaders['Content-Type'] = contentType
    }
  }

  Object.entries(allHeaders).forEach(([key, value]) => {
    result += `${key}: ${value}\n`
  })

  result += '\n'

  if (request.bodyConfig) {
    const bodyText = serializeBodyPreview(request.bodyConfig)
    if (bodyText) {
      result += bodyText
    }
  } else if (request.body) {
    result += request.body
  }

  return result
}

export function getBodyContentType(bodyConfig: RequestBody): string {
  switch (bodyConfig.type) {
    case 'form-data':
      return 'multipart/form-data'
    case 'x-www-form-urlencoded':
      return 'application/x-www-form-urlencoded'
    case 'raw':
      return bodyConfig.raw ? getRawContentType(bodyConfig.raw.subType) : 'text/plain'
    case 'graphql':
      return 'application/json'
    case 'binary':
      return 'application/octet-stream'
    default:
      return ''
  }
}

function serializeBodyPreview(bodyConfig: RequestBody): string {
  switch (bodyConfig.type) {
    case 'none':
      return ''
    case 'x-www-form-urlencoded':
      if (bodyConfig.urlEncoded) {
        return bodyConfig.urlEncoded
          .filter((p) => p.enabled && p.key.trim())
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&')
      }
      return ''
    case 'raw':
      return bodyConfig.raw?.content || ''
    case 'graphql':
      if (bodyConfig.graphql?.query) {
        try {
          let variables = {}
          if (bodyConfig.graphql.variables) {
            variables = JSON.parse(bodyConfig.graphql.variables)
          }
          return JSON.stringify({ query: bodyConfig.graphql.query, variables }, null, 2)
        } catch {
          return JSON.stringify({ query: bodyConfig.graphql.query }, null, 2)
        }
      }
      return ''
    case 'form-data':
      if (bodyConfig.formData) {
        return bodyConfig.formData
          .filter((f) => f.enabled && f.key.trim())
          .map((f) => {
            if (f.type === 'file') {
              return `${f.key}: <file>${f.fileName || 'file'}`
            }
            return `${f.key}: ${f.value}`
          })
          .join('\n')
      }
      return ''
    case 'binary':
      return bodyConfig.binary ? `<binary file: ${bodyConfig.binary.fileName || 'file'}>` : ''
    default:
      return ''
  }
}

export function mergeCookies(existing: CookieItem[], newCookies: CookieItem[]): CookieItem[] {
  const result = [...existing]
  newCookies.forEach((newCookie) => {
    const index = result.findIndex(
      (c) => c.name === newCookie.name && c.domain === newCookie.domain && c.path === newCookie.path
    )
    if (index >= 0) {
      result[index] = { ...result[index], ...newCookie, id: result[index].id }
    } else {
      result.push(newCookie)
    }
  })
  return result
}
