import type { KeyValuePair, HttpResponse } from './types'

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
