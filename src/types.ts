export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface HttpRequest {
  id: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body?: string
  timeout: number
}

export interface HttpResponse {
  statusCode: number
  statusText: string
  headers: Record<string, string | string[]>
  body: string
  time: number
  size: number
}
