export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql'
export type RawSubType = 'Text' | 'JSON' | 'XML' | 'HTML' | 'JavaScript'
export type AuthType = 'no-auth' | 'basic' | 'bearer' | 'api-key' | 'oauth2'
export type ApiKeyIn = 'header' | 'query'

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface FormDataField extends KeyValuePair {
  type: 'text' | 'file'
  fileName?: string
  fileData?: string
}

export interface RawBody {
  content: string
  subType: RawSubType
}

export interface BinaryBody {
  fileName: string
  fileData: string
}

export interface GraphQLBody {
  query: string
  variables: string
}

export interface RequestBody {
  type: BodyType
  formData?: FormDataField[]
  urlEncoded?: KeyValuePair[]
  raw?: RawBody
  binary?: BinaryBody
  graphql?: GraphQLBody
}

export interface BasicAuth {
  username: string
  password: string
}

export interface BearerAuth {
  token: string
}

export interface ApiKeyAuth {
  key: string
  value: string
  in: ApiKeyIn
}

export interface OAuth2Auth {
  token: string
}

export interface AuthConfig {
  type: AuthType
  basic?: BasicAuth
  bearer?: BearerAuth
  apiKey?: ApiKeyAuth
  oauth2?: OAuth2Auth
}

export interface CookieItem {
  id: string
  name: string
  value: string
  domain: string
  path: string
  expires?: string
  httpOnly: boolean
  secure: boolean
  enabled: boolean
}

export interface HttpRequest {
  id: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body?: string
  bodyConfig?: RequestBody
  auth?: AuthConfig
  cookies?: CookieItem[]
  timeout: number
}

export interface HttpResponse {
  statusCode: number
  statusText: string
  headers: Record<string, string | string[]>
  body: string
  time: number
  size: number
  cookies?: CookieItem[]
}
