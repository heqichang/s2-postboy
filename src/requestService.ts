import type { HttpRequest, HttpResponse, KeyValuePair } from './types'

const abortControllers = new Map<string, AbortController>()

function buildHeaders(pairs: KeyValuePair[]): Record<string, string> {
  const headers: Record<string, string> = {}
  pairs
    .filter((p) => p.enabled && p.key.trim() !== '')
    .forEach((p) => {
      headers[p.key] = p.value
    })
  return headers
}

async function fetchRequest(request: HttpRequest): Promise<HttpResponse> {
  const controller = new AbortController()
  abortControllers.set(request.id, controller)

  const startTime = Date.now()
  const headers = buildHeaders(request.headers)

  if (request.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, request.timeout)

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body: request.body || undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const text = await response.text()
    const endTime = Date.now()

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value
    })

    abortControllers.delete(request.id)

    const size = new Blob([text]).size

    return {
      statusCode: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: text,
      time: endTime - startTime,
      size,
    }
  } catch (error) {
    abortControllers.delete(request.id)
    clearTimeout(timeoutId)

    if ((error as Error).name === 'AbortError') {
      throw new Error('Request cancelled')
    }
    throw error
  }
}

export function sendRequest(request: HttpRequest): Promise<HttpResponse> {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.sendRequest(request)
  }
  return fetchRequest(request)
}

export function cancelRequest(requestId: string): void {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.cancelRequest(requestId)
    return
  }
  const controller = abortControllers.get(requestId)
  if (controller) {
    controller.abort()
    abortControllers.delete(requestId)
  }
}
