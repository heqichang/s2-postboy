import { generateId, createEmptyPair } from '../utils'
import type {
  Collection,
  Folder,
  SavedRequest,
  HttpRequest,
  KeyValuePair,
  HttpMethod,
  ImportFormat,
  ExportFormat,
  PostmanCollectionV21,
  PostmanItem,
  PostmanRequest,
  OpenAPISpec,
  HARFormat,
  HAREntry,
  RequestBody,
} from '../types'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

function isValidHttpMethod(method: string): method is HttpMethod {
  return HTTP_METHODS.includes(method.toUpperCase() as HttpMethod)
}

function normalizeMethod(method: string): HttpMethod {
  const upper = method.toUpperCase()
  return isValidHttpMethod(upper) ? (upper as HttpMethod) : 'GET'
}

function createEmptyHttpRequest(): HttpRequest {
  return {
    id: generateId(),
    method: 'GET',
    url: '',
    headers: [createEmptyPair()],
    queryParams: [createEmptyPair()],
    bodyConfig: { type: 'none' },
    auth: { type: 'no-auth' },
    cookies: [],
    timeout: 30000,
  }
}

function createSavedRequestFromHttpRequest(
  request: HttpRequest,
  name: string,
  description: string = ''
): SavedRequest {
  const now = Date.now()
  return {
    ...request,
    id: generateId(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
  }
}

function createEmptyFolder(name: string, description: string = ''): Folder {
  const now = Date.now()
  return {
    id: generateId(),
    name,
    description,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  }
}

export async function importFromFile(
  file: File,
  format: ImportFormat
): Promise<Collection[]> {
  const text = await file.text()
  return importFromString(text, format, file.name.replace(/\.[^.]+$/, ''))
}

export function importFromString(
  content: string,
  format: ImportFormat,
  defaultName: string = '导入集合'
): Collection[] {
  switch (format) {
    case 'postman':
      return importFromPostman(content, defaultName)
    case 'openapi':
      return importFromOpenAPI(content, defaultName)
    case 'curl':
      return importFromCurl(content, defaultName)
    case 'har':
      return importFromHAR(content, defaultName)
    case 'json':
      return importFromJSON(content)
    default:
      throw new Error(`不支持的导入格式: ${format}`)
  }
}

function importFromPostman(content: string, defaultName: string): Collection[] {
  try {
    const data: PostmanCollectionV21 = JSON.parse(content)
    const now = Date.now()

    const collection: Collection = {
      id: generateId(),
      name: data.info?.name || defaultName,
      description: data.info?.description || '',
      folders: [],
      requests: [],
      variables: [],
      createdAt: now,
      updatedAt: now,
    }

    const processItem = (item: PostmanItem, parentFolder: Folder | null) => {
      if (item.item && item.item.length > 0) {
        const folder = createEmptyFolder(item.name, item.description || '')
        if (parentFolder) {
          parentFolder.folders.push(folder)
        } else {
          collection.folders.push(folder)
        }
        item.item.forEach((child) => processItem(child, folder))
      } else if (item.request) {
        const request = convertPostmanRequest(item.request, item.name, item.description)
        if (parentFolder) {
          parentFolder.requests.push(request)
        } else {
          collection.requests.push(request)
        }
      }
    }

    data.item?.forEach((item) => processItem(item, null))
    return [collection]
  } catch (error) {
    throw new Error(`解析 Postman 集合失败: ${(error as Error).message}`)
  }
}

function convertPostmanRequest(
  req: PostmanRequest,
  name: string,
  description: string = ''
): SavedRequest {
  const httpRequest = createEmptyHttpRequest()
  httpRequest.method = normalizeMethod(req.method)
  httpRequest.url = req.url?.raw || ''

  if (req.url?.query) {
    httpRequest.queryParams = req.url.query
      .filter((q) => q.key)
      .map((q) => ({
        id: generateId(),
        key: q.key,
        value: q.value || '',
        enabled: !q.disabled,
      }))
  }

  if (req.header) {
    httpRequest.headers = req.header
      .filter((h) => h.key)
      .map((h) => ({
        id: generateId(),
        key: h.key,
        value: h.value || '',
        enabled: !h.disabled,
      }))
  }

  if (req.body) {
    httpRequest.bodyConfig = convertPostmanBody(req.body)
  }

  return createSavedRequestFromHttpRequest(httpRequest, name, description)
}

function convertPostmanBody(body: PostmanRequest['body']): RequestBody {
  if (!body) return { type: 'none' }

  switch (body.mode) {
    case 'raw':
      return {
        type: 'raw',
        raw: {
          content: body.raw || '',
          subType: 'JSON',
        },
      }
    case 'urlencoded':
      return {
        type: 'x-www-form-urlencoded',
        urlEncoded: (body.urlencoded || [])
          .filter((p) => p.key)
          .map((p) => ({
            id: generateId(),
            key: p.key,
            value: p.value || '',
            enabled: !p.disabled,
          })),
      }
    case 'formdata':
      return {
        type: 'form-data',
        formData: (body.formdata || [])
          .filter((p) => p.key)
          .map((p) => ({
            id: generateId(),
            key: p.key,
            value: p.value || '',
            type: p.type === 'file' ? 'file' : 'text',
            fileName: p.src,
            enabled: !p.disabled,
          })),
      }
    default:
      return { type: 'none' }
  }
}

function importFromOpenAPI(content: string, defaultName: string): Collection[] {
  try {
    const data: OpenAPISpec = JSON.parse(content)
    const now = Date.now()

    const collection: Collection = {
      id: generateId(),
      name: data.info?.title || defaultName,
      description: data.info?.description || '',
      folders: [],
      requests: [],
      variables: [],
      createdAt: now,
      updatedAt: now,
    }

    const pathFolders: Record<string, Folder> = {}

    Object.entries(data.paths || {}).forEach(([path, pathItem]) => {
      if (!pathItem) return

      const pathSegments = path.split('/').filter(Boolean)
      const folderName = pathSegments[0] || 'default'

      let folder = pathFolders[folderName]
      if (!folder) {
        folder = createEmptyFolder(folderName)
        collection.folders.push(folder)
        pathFolders[folderName] = folder
      }

      Object.entries(pathItem).forEach(([method, operation]) => {
        if (!operation || typeof operation !== 'object') return
        if (['summary', 'description', 'parameters', 'servers'].includes(method)) return

        const httpRequest = createEmptyHttpRequest()
        httpRequest.method = normalizeMethod(method)
        httpRequest.url = path

        if (operation.parameters) {
          operation.parameters.forEach((param) => {
            const pair: KeyValuePair = {
              id: generateId(),
              key: param.name,
              value: param.schema?.default?.toString() || `{{${param.name}}}`,
              enabled: true,
            }

            if (param.in === 'query') {
              httpRequest.queryParams.push(pair)
            } else if (param.in === 'header') {
              httpRequest.headers.push(pair)
            }
          })
        }

        if (operation.requestBody?.content) {
          const jsonContent = operation.requestBody.content['application/json']
          if (jsonContent) {
            let example = ''
            if (jsonContent.example) {
              example = JSON.stringify(jsonContent.example, null, 2)
            } else if (jsonContent.schema?.example) {
              example = JSON.stringify(jsonContent.schema.example, null, 2)
            }
            httpRequest.bodyConfig = {
              type: 'raw',
              raw: {
                content: example,
                subType: 'JSON',
              },
            }
          }
        }

        const requestName = operation.summary || `${method.toUpperCase()} ${path}`
        const savedRequest = createSavedRequestFromHttpRequest(
          httpRequest,
          requestName,
          operation.description || ''
        )
        folder.requests.push(savedRequest)
      })
    })

    return [collection]
  } catch (error) {
    throw new Error(`解析 OpenAPI 文档失败: ${(error as Error).message}`)
  }
}

function importFromCurl(content: string, defaultName: string): Collection[] {
  const now = Date.now()
  const collection: Collection = {
    id: generateId(),
    name: defaultName,
    description: '',
    folders: [],
    requests: [],
    variables: [],
    createdAt: now,
    updatedAt: now,
  }

  const curlCommands = content
    .split(/\n(?=curl\s)/i)
    .map((cmd) => cmd.trim())
    .filter((cmd) => cmd.toLowerCase().startsWith('curl '))

  curlCommands.forEach((curlCmd, index) => {
    try {
      const request = parseCurlCommand(curlCmd)
      const savedRequest = createSavedRequestFromHttpRequest(
        request,
        `请求 ${index + 1}`,
        curlCmd
      )
      collection.requests.push(savedRequest)
    } catch (error) {
      console.warn(`解析 cURL 命令失败 (第 ${index + 1} 个):`, error)
    }
  })

  if (collection.requests.length === 0) {
    throw new Error('未找到有效的 cURL 命令')
  }

  return [collection]
}

function parseCurlCommand(curlCmd: string): HttpRequest {
  const request = createEmptyHttpRequest()

  const urlMatch = curlCmd.match(/curl\s+['"]?([^'">\s]+)['"]?/i)
  if (urlMatch) {
    request.url = urlMatch[1]
  } else {
    throw new Error('未找到 URL')
  }

  const methodMatch = curlCmd.match(/-X\s+(\w+)/i)
  if (methodMatch) {
    request.method = normalizeMethod(methodMatch[1])
  }

  const headerMatches = curlCmd.match(/-H\s+['"]([^'"]+)['"]/gi)
  if (headerMatches) {
    request.headers = []
    headerMatches.forEach((match) => {
      const headerMatch = match.match(/-H\s+['"]([^'"]+)['"]/i)
      if (headerMatch) {
        const [name, ...valueParts] = headerMatch[1].split(':')
        const value = valueParts.join(':').trim()
        if (name) {
          request.headers.push({
            id: generateId(),
            key: name.trim(),
            value,
            enabled: true,
          })
        }
      }
    })
  }

  const bodyMatch = curlCmd.match(/--data(?:-raw)?\s+['"]([^'"]+)['"]/i)
  if (bodyMatch) {
    request.method = request.method === 'GET' ? 'POST' : request.method
    request.bodyConfig = {
      type: 'raw',
      raw: {
        content: bodyMatch[1],
        subType: 'JSON',
      },
    }
  }

  const formMatches = curlCmd.match(/-F\s+['"]([^'"]+)['"]/gi)
  if (formMatches) {
    request.method = request.method === 'GET' ? 'POST' : request.method
    const formData: RequestBody['formData'] = []
    request.bodyConfig = {
      type: 'form-data',
      formData,
    }
    formMatches.forEach((match) => {
      const formMatch = match.match(/-F\s+['"]([^'"]+)['"]/i)
      if (formMatch) {
        const [key, ...valueParts] = formMatch[1].split('=')
        const value = valueParts.join('=')
        if (key) {
          formData.push({
            id: generateId(),
            key: key.trim(),
            value: value.startsWith('@') ? '' : value,
            type: value.startsWith('@') ? 'file' : 'text',
            fileName: value.startsWith('@') ? value.slice(1) : undefined,
            enabled: true,
          })
        }
      }
    })
  }

  return request
}

function importFromHAR(content: string, defaultName: string): Collection[] {
  try {
    const data: HARFormat = JSON.parse(content)
    const now = Date.now()

    const collection: Collection = {
      id: generateId(),
      name: defaultName,
      description: '',
      folders: [],
      requests: [],
      variables: [],
      createdAt: now,
      updatedAt: now,
    }

    const entries = data.log?.entries || []
    entries.forEach((entry: HAREntry, index: number) => {
      const httpRequest = createEmptyHttpRequest()
      httpRequest.method = normalizeMethod(entry.request.method)
      httpRequest.url = entry.request.url

      if (entry.request.queryString) {
        httpRequest.queryParams = entry.request.queryString
          .filter((q) => q.name)
          .map((q) => ({
            id: generateId(),
            key: q.name,
            value: q.value || '',
            enabled: true,
          }))
      }

      if (entry.request.headers) {
        httpRequest.headers = entry.request.headers
          .filter((h) => h.name)
          .map((h) => ({
            id: generateId(),
            key: h.name,
            value: h.value || '',
            enabled: true,
          }))
      }

      if (entry.request.postData) {
        if (entry.request.postData.mimeType.includes('json')) {
          httpRequest.bodyConfig = {
            type: 'raw',
            raw: {
              content: entry.request.postData.text || '',
              subType: 'JSON',
            },
          }
        } else if (entry.request.postData.mimeType.includes('x-www-form-urlencoded')) {
          httpRequest.bodyConfig = {
            type: 'x-www-form-urlencoded',
            urlEncoded: (entry.request.postData.params || [])
              .filter((p) => p.name)
              .map((p) => ({
                id: generateId(),
                key: p.name,
                value: p.value || '',
                enabled: true,
              })),
          }
        } else if (entry.request.postData.mimeType.includes('form-data')) {
          httpRequest.bodyConfig = {
            type: 'form-data',
            formData: (entry.request.postData.params || [])
              .filter((p) => p.name)
              .map((p) => ({
                id: generateId(),
                key: p.name,
                value: p.value || '',
                type: 'text',
                enabled: true,
              })),
          }
        }
      }

      const savedRequest = createSavedRequestFromHttpRequest(
        httpRequest,
        `${entry.request.method} ${entry.request.url.split('?')[0].split('/').pop() || `请求 ${index + 1}`}`,
        `状态码: ${entry.response.status}`
      )
      collection.requests.push(savedRequest)
    })

    if (collection.requests.length === 0) {
      throw new Error('HAR 文件中未找到请求记录')
    }

    return [collection]
  } catch (error) {
    throw new Error(`解析 HAR 文件失败: ${(error as Error).message}`)
  }
}

function importFromJSON(content: string): Collection[] {
  try {
    const data = JSON.parse(content)

    if (Array.isArray(data)) {
      return data.map((item) => validateCollection(item))
    } else if (data && typeof data === 'object') {
      return [validateCollection(data)]
    } else {
      throw new Error('JSON 格式不正确')
    }
  } catch (error) {
    throw new Error(`解析 JSON 文件失败: ${(error as Error).message}`)
  }
}

function validateCollection(data: unknown): Collection {
  if (!data || typeof data !== 'object') {
    throw new Error('集合数据格式不正确')
  }

  const obj = data as Record<string, unknown>
  const now = Date.now()

  return {
    id: typeof obj.id === 'string' ? obj.id : generateId(),
    name: typeof obj.name === 'string' ? obj.name : '未命名集合',
    description: typeof obj.description === 'string' ? obj.description : '',
    folders: Array.isArray(obj.folders) ? obj.folders.map(validateFolder) : [],
    requests: Array.isArray(obj.requests) ? obj.requests.map(validateSavedRequest) : [],
    variables: Array.isArray(obj.variables) ? obj.variables : [],
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : now,
  }
}

function validateFolder(data: unknown): Folder {
  if (!data || typeof data !== 'object') {
    throw new Error('文件夹数据格式不正确')
  }

  const obj = data as Record<string, unknown>
  const now = Date.now()

  return {
    id: typeof obj.id === 'string' ? obj.id : generateId(),
    name: typeof obj.name === 'string' ? obj.name : '未命名文件夹',
    description: typeof obj.description === 'string' ? obj.description : '',
    folders: Array.isArray(obj.folders) ? obj.folders.map(validateFolder) : [],
    requests: Array.isArray(obj.requests) ? obj.requests.map(validateSavedRequest) : [],
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : now,
  }
}

function validateSavedRequest(data: unknown): SavedRequest {
  if (!data || typeof data !== 'object') {
    throw new Error('请求数据格式不正确')
  }

  const obj = data as Record<string, unknown>
  const now = Date.now()

  return {
    ...createEmptyHttpRequest(),
    ...(obj as Partial<HttpRequest>),
    id: typeof obj.id === 'string' ? obj.id : generateId(),
    name: typeof obj.name === 'string' ? obj.name : '未命名请求',
    description: typeof obj.description === 'string' ? obj.description : '',
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : now,
  }
}

export function exportCollection(
  collection: Collection,
  format: ExportFormat
): string {
  switch (format) {
    case 'postman':
      return exportToPostman(collection)
    case 'json':
      return JSON.stringify(collection, null, 2)
    default:
      throw new Error(`不支持的导出格式: ${format}`)
  }
}

export function exportCollections(
  collections: Collection[],
  format: ExportFormat
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(collections, null, 2)
    case 'postman':
      if (collections.length === 1) {
        return exportToPostman(collections[0])
      }
      throw new Error('Postman 格式只能导出单个集合')
    default:
      throw new Error(`不支持的导出格式: ${format}`)
  }
}

function exportToPostman(collection: Collection): string {
  const postmanItems: PostmanItem[] = []

  const processFolder = (folder: Folder): PostmanItem => {
    const items: PostmanItem[] = [
      ...folder.folders.map(processFolder),
      ...folder.requests.map(exportRequestToPostman),
    ]
    return {
      name: folder.name,
      description: folder.description,
      item: items,
    }
  }

  postmanItems.push(...collection.folders.map(processFolder))
  postmanItems.push(...collection.requests.map(exportRequestToPostman))

  const postmanCollection: PostmanCollectionV21 = {
    info: {
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: postmanItems,
  }

  return JSON.stringify(postmanCollection, null, 2)
}

function exportRequestToPostman(request: SavedRequest): PostmanItem {
  const url = request.url
  const queryParams = request.queryParams
    .filter((p) => p.enabled && p.key)
    .map((p) => ({
      key: p.key,
      value: p.value,
      disabled: !p.enabled,
    }))

  const headers = request.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => ({
      key: h.key,
      value: h.value,
      disabled: !h.enabled,
    }))

  let body: PostmanRequest['body'] | undefined

  if (request.bodyConfig) {
    switch (request.bodyConfig.type) {
      case 'raw':
        if (request.bodyConfig.raw?.content) {
          body = {
            mode: 'raw',
            raw: request.bodyConfig.raw.content,
          }
        }
        break
      case 'x-www-form-urlencoded':
        if (request.bodyConfig.urlEncoded) {
          body = {
            mode: 'urlencoded',
            urlencoded: request.bodyConfig.urlEncoded
              .filter((p) => p.key)
              .map((p) => ({
                key: p.key,
                value: p.value,
                disabled: !p.enabled,
              })),
          }
        }
        break
      case 'form-data':
        if (request.bodyConfig.formData) {
          body = {
            mode: 'formdata',
            formdata: request.bodyConfig.formData
              .filter((p) => p.key)
              .map((p) => ({
                key: p.key,
                value: p.value,
                type: p.type,
                src: p.fileName,
                disabled: !p.enabled,
              })),
          }
        }
        break
    }
  }

  return {
    name: request.name,
    description: request.description,
    request: {
      method: request.method,
      url: {
        raw: url,
        query: queryParams,
      },
      header: headers,
      body,
    },
  }
}

export function detectFormat(content: string, fileName?: string): ImportFormat {
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop()
    if (ext === 'har') return 'har'
    if (ext === 'curl' || ext === 'txt') return 'curl'
  }

  try {
    const data = JSON.parse(content)

    if (data.info?.schema?.includes('postman')) {
      return 'postman'
    }

    if (data.openapi || data.swagger) {
      return 'openapi'
    }

    if (data.log?.entries) {
      return 'har'
    }

    if (Array.isArray(data) && data.length > 0 && data[0].requests) {
      return 'json'
    }

    if (data.requests || data.folders) {
      return 'json'
    }
  } catch {
    if (content.trim().toLowerCase().startsWith('curl ')) {
      return 'curl'
    }
  }

  return 'json'
}

export function downloadFile(content: string, fileName: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
