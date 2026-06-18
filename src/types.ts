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
  preRequestScript?: string
  postRequestScript?: string
  assertions?: Assertion[]
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

export interface SavedRequest extends HttpRequest {
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  description: string
  folders: Folder[]
  requests: SavedRequest[]
  createdAt: number
  updatedAt: number
}

export interface Collection {
  id: string
  name: string
  description: string
  folders: Folder[]
  requests: SavedRequest[]
  variables: Variable[]
  createdAt: number
  updatedAt: number
}

export interface HistoryItem {
  id: string
  request: HttpRequest
  response?: HttpResponse
  timestamp: number
  statusCode?: number
  error?: string
}

export type TreeNodeType = 'collection' | 'folder' | 'request'

export interface TreeNode {
  id: string
  type: TreeNodeType
  name: string
  children?: TreeNode[]
  data?: Collection | Folder | SavedRequest
}

export type ImportFormat = 'postman' | 'openapi' | 'curl' | 'har' | 'json'
export type ExportFormat = 'postman' | 'json' | 'html'

export interface CollectionStore {
  collections: Collection[]
  activeCollectionId: string | null
}

export interface HistoryStore {
  items: HistoryItem[]
}

export interface SaveRequestDialogData {
  name: string
  description: string
  collectionId: string | null
  folderId: string | null
}

export interface TreeNodeWithPath extends TreeNode {
  path: string[]
}

export interface PostmanCollectionV21 {
  info: {
    name: string
    description?: string
    schema: string
  }
  item: PostmanItem[]
}

export interface PostmanItem {
  name: string
  description?: string
  request?: PostmanRequest
  item?: PostmanItem[]
}

export interface PostmanRequest {
  method: string
  url: {
    raw: string
    protocol?: string
    host?: string[]
    path?: string[]
    query?: PostmanQueryParam[]
  }
  header?: PostmanHeader[]
  body?: PostmanBody
}

export interface PostmanQueryParam {
  key: string
  value: string
  disabled?: boolean
}

export interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
}

export interface PostmanBody {
  mode: string
  raw?: string
  urlencoded?: PostmanFormParam[]
  formdata?: PostmanFormData[]
}

export interface PostmanFormParam {
  key: string
  value: string
  disabled?: boolean
}

export interface PostmanFormData extends PostmanFormParam {
  type?: string
  src?: string
}

export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description?: string
  }
  paths: Record<string, OpenAPIPathItem>
}

export interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation | undefined
}

export interface OpenAPIOperation {
  summary?: string
  description?: string
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
}

export interface OpenAPIParameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  description?: string
  required?: boolean
  schema?: {
    type: string
    default?: string
  }
}

export interface OpenAPIRequestBody {
  content?: Record<string, OpenAPIMediaType>
}

export interface OpenAPIMediaType {
  schema?: {
    type: string
    example?: unknown
  }
  example?: unknown
}

export interface HARFormat {
  log: {
    entries: HAREntry[]
  }
}

export interface HAREntry {
  startedDateTime: string
  request: HARRequest
  response: HARResponse
}

export interface HARRequest {
  method: string
  url: string
  queryString: HARParam[]
  headers: HARParam[]
  postData?: {
    mimeType: string
    text?: string
    params?: HARParam[]
  }
}

export interface HARResponse {
  status: number
  statusText: string
}

export interface HARParam {
  name: string
  value: string
}

export interface Variable {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface Environment {
  id: string
  name: string
  variables: Variable[]
  createdAt: number
  updatedAt: number
}

export type VariableScope = 'global' | 'environment' | 'collection' | 'data' | 'local'

export interface VariableStore {
  global: Record<string, string>
  environment: Record<string, string>
  collection: Record<string, string>
  data: Record<string, string>
  local: Record<string, string>
}

export interface ScriptContext {
  environment: {
    get: (key: string) => string | undefined
    set: (key: string, value: string) => void
    unset: (key: string) => void
    clear: () => void
  }
  global: {
    get: (key: string) => string | undefined
    set: (key: string, value: string) => void
    unset: (key: string) => void
    clear: () => void
  }
  collectionVariables: {
    get: (key: string) => string | undefined
    set: (key: string, value: string) => void
    unset: (key: string) => void
    clear: () => void
  }
  variables: {
    get: (key: string) => string | undefined
    set: (key: string, value: string) => void
    unset: (key: string) => void
    clear: () => void
  }
  response?: {
    json: () => unknown
    text: () => string
    status: number
    headers: Record<string, string | string[]>
  }
  request?: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }
  info?: {
    eventName: 'prerequest' | 'test'
  }
  test: (name: string, fn: () => void) => void
  expect: (value: unknown) => {
    to: {
      equal: (expected: unknown) => void
      eql: (expected: unknown) => void
      be: {
        above: (n: number) => void
        below: (n: number) => void
        ok: () => void
        true: () => void
        false: () => void
      }
      include: (value: unknown) => void
      have: {
        property: (key: string) => void
        status: (code: number) => void
      }
    }
  }
  console: Console
}

export interface ScriptResult {
  success: boolean
  error?: string
  tests: { name: string; passed: boolean; error?: string }[]
  variables: Partial<VariableStore>
}

export interface EnvironmentStore {
  environments: Environment[]
  activeEnvironmentId: string | null
  globalVariables: Variable[]
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export type AssertionType =
  | 'statusCode'
  | 'responseTime'
  | 'responseBody'
  | 'jsonValue'
  | 'header'
  | 'contentType'
  | 'jsonSchema'

export type AssertionOperator =
  | 'equal'
  | 'notEqual'
  | 'contains'
  | 'notContains'
  | 'lessThan'
  | 'greaterThan'
  | 'exists'
  | 'notExists'

export interface Assertion {
  id: string
  type: AssertionType
  property?: string
  operator: AssertionOperator
  expectedValue?: string | number
  enabled: boolean
}

export interface AssertionResult {
  assertion: Assertion
  passed: boolean
  actualValue?: unknown
  error?: string
}

export interface RunConfig {
  collectionId: string
  folderId?: string | null
  environmentId?: string | null
  iterations: number
  delay: number
  dataFile?: DataFile | null
  stopOnError?: boolean
}

export interface DataFile {
  type: 'csv' | 'json'
  data: Record<string, string>[]
  fileName: string
}

export interface RequestRunResult {
  requestId: string
  requestName: string
  request: HttpRequest
  response?: HttpResponse
  error?: string
  testResults: TestResult[]
  assertionResults: AssertionResult[]
  allPassed: boolean
  iteration: number
  dataRow?: Record<string, string>
}

export interface CollectionRunResult {
  id: string
  name: string
  startTime: number
  endTime?: number
  totalRequests: number
  passedRequests: number
  failedRequests: number
  totalTests: number
  passedTests: number
  failedTests: number
  totalAssertions: number
  passedAssertions: number
  failedAssertions: number
  averageResponseTime: number
  results: RequestRunResult[]
  config: RunConfig
}

export interface TestReportData {
  summary: {
    totalRequests: number
    passedRequests: number
    failedRequests: number
    totalTests: number
    passedTests: number
    failedTests: number
    totalAssertions: number
    passedAssertions: number
    failedAssertions: number
    averageResponseTime: number
    totalTime: number
  }
  results: RequestRunResult[]
  config: RunConfig
  exportedAt: number
}
