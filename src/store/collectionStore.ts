import { generateId } from '../utils'
import type {
  Collection,
  Folder,
  SavedRequest,
  HttpRequest,
  TreeNode,
  TreeNodeType,
  Variable,
} from '../types'

const COLLECTIONS_STORAGE_KEY = 'postboy_collections'

let collections: Collection[] = []
let activeCollectionId: string | null = null
const listeners = new Set<() => void>()

function loadCollections(): void {
  try {
    const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      collections = Array.isArray(parsed) ? parsed.map(normalizeCollection) : []
    }
  } catch {
    collections = []
  }
}

function normalizeCollection(c: any): Collection {
  return {
    id: c.id || generateId(),
    name: c.name || 'Unnamed Collection',
    description: c.description || '',
    folders: Array.isArray(c.folders) ? c.folders.map(normalizeFolder) : [],
    requests: Array.isArray(c.requests) ? c.requests : [],
    variables: Array.isArray(c.variables) ? c.variables : [],
    createdAt: c.createdAt || Date.now(),
    updatedAt: c.updatedAt || Date.now(),
  }
}

function normalizeFolder(f: any): Folder {
  return {
    id: f.id || generateId(),
    name: f.name || 'Unnamed Folder',
    description: f.description || '',
    folders: Array.isArray(f.folders) ? f.folders.map(normalizeFolder) : [],
    requests: Array.isArray(f.requests) ? f.requests : [],
    createdAt: f.createdAt || Date.now(),
    updatedAt: f.updatedAt || Date.now(),
  }
}

function saveCollections(): void {
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections))
  } catch {}
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCollections(): Collection[] {
  return collections
}

export function getActiveCollectionId(): string | null {
  return activeCollectionId
}

export function setActiveCollectionId(id: string | null): void {
  activeCollectionId = id
  notifyListeners()
}

export function createCollection(name: string, description: string = ''): Collection {
  const now = Date.now()
  const collection: Collection = {
    id: generateId(),
    name,
    description,
    folders: [],
    requests: [],
    variables: [],
    createdAt: now,
    updatedAt: now,
  }
  collections.push(collection)
  saveCollections()
  notifyListeners()
  return collection
}

export function renameCollection(collectionId: string, name: string): void {
  const collection = collections.find((c) => c.id === collectionId)
  if (collection) {
    collection.name = name
    collection.updatedAt = Date.now()
    saveCollections()
    notifyListeners()
  }
}

export function deleteCollection(collectionId: string): void {
  const index = collections.findIndex((c) => c.id === collectionId)
  if (index >= 0) {
    collections.splice(index, 1)
    if (activeCollectionId === collectionId) {
      activeCollectionId = null
    }
    saveCollections()
    notifyListeners()
  }
}

export function createFolder(
  collectionId: string,
  parentFolderId: string | null,
  name: string,
  description: string = ''
): Folder | null {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return null

  const now = Date.now()
  const folder: Folder = {
    id: generateId(),
    name,
    description,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  }

  if (parentFolderId) {
    const parentFolder = findFolderInCollection(collection, parentFolderId)
    if (parentFolder) {
      parentFolder.folders.push(folder)
    } else {
      return null
    }
  } else {
    collection.folders.push(folder)
  }

  collection.updatedAt = now
  saveCollections()
  notifyListeners()
  return folder
}

export function renameFolder(collectionId: string, folderId: string, name: string): void {
  const folder = findFolder(collectionId, folderId)
  if (folder) {
    folder.name = name
    folder.updatedAt = Date.now()
    const collection = collections.find((c) => c.id === collectionId)
    if (collection) {
      collection.updatedAt = Date.now()
    }
    saveCollections()
    notifyListeners()
  }
}

export function deleteFolder(collectionId: string, folderId: string): void {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return

  const deleteFromFolder = (folders: Folder[]): boolean => {
    const index = folders.findIndex((f) => f.id === folderId)
    if (index >= 0) {
      folders.splice(index, 1)
      return true
    }
    for (const folder of folders) {
      if (deleteFromFolder(folder.folders)) {
        return true
      }
    }
    return false
  }

  if (deleteFromFolder(collection.folders)) {
    collection.updatedAt = Date.now()
    saveCollections()
    notifyListeners()
  }
}

export function saveRequest(
  request: HttpRequest,
  name: string,
  description: string = '',
  collectionId: string,
  folderId: string | null = null
): SavedRequest | null {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return null

  const now = Date.now()
  const savedRequest: SavedRequest = {
    ...request,
    id: generateId(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
  }

  if (folderId) {
    const folder = findFolderInCollection(collection, folderId)
    if (folder) {
      folder.requests.push(savedRequest)
    } else {
      return null
    }
  } else {
    collection.requests.push(savedRequest)
  }

  collection.updatedAt = now
  saveCollections()
  notifyListeners()
  return savedRequest
}

export function updateRequest(
  collectionId: string,
  requestId: string,
  updates: Partial<SavedRequest>
): void {
  const request = findRequest(collectionId, requestId)
  if (request) {
    Object.assign(request, updates, { updatedAt: Date.now() })
    const collection = collections.find((c) => c.id === collectionId)
    if (collection) {
      collection.updatedAt = Date.now()
    }
    saveCollections()
    notifyListeners()
  }
}

export function moveRequest(
  sourceCollectionId: string,
  sourceFolderId: string | null,
  requestId: string,
  targetCollectionId: string,
  targetFolderId: string | null
): void {
  const sourceCollection = collections.find((c) => c.id === sourceCollectionId)
  const targetCollection = collections.find((c) => c.id === targetCollectionId)

  if (!sourceCollection || !targetCollection) return

  let request: SavedRequest | null = null
  let sourceRequests: SavedRequest[] | null = null

  if (sourceFolderId) {
    const sourceFolder = findFolderInCollection(sourceCollection, sourceFolderId)
    if (sourceFolder) {
      sourceRequests = sourceFolder.requests
    }
  } else {
    sourceRequests = sourceCollection.requests
  }

  if (sourceRequests) {
    const index = sourceRequests.findIndex((r) => r.id === requestId)
    if (index >= 0) {
      request = sourceRequests[index]
      sourceRequests.splice(index, 1)
    }
  }

  if (!request) return

  if (targetFolderId) {
    const targetFolder = findFolderInCollection(targetCollection, targetFolderId)
    if (targetFolder) {
      targetFolder.requests.push(request)
    }
  } else {
    targetCollection.requests.push(request)
  }

  sourceCollection.updatedAt = Date.now()
  targetCollection.updatedAt = Date.now()
  saveCollections()
  notifyListeners()
}

export function copyRequest(
  sourceCollectionId: string,
  requestId: string,
  targetCollectionId: string,
  targetFolderId: string | null
): SavedRequest | null {
  const sourceRequest = findRequest(sourceCollectionId, requestId)
  if (!sourceRequest) return null

  const targetCollection = collections.find((c) => c.id === targetCollectionId)
  if (!targetCollection) return null

  const now = Date.now()
  const copiedRequest: SavedRequest = {
    ...JSON.parse(JSON.stringify(sourceRequest)),
    id: generateId(),
    name: `${sourceRequest.name} (副本)`,
    createdAt: now,
    updatedAt: now,
  }

  if (targetFolderId) {
    const targetFolder = findFolderInCollection(targetCollection, targetFolderId)
    if (targetFolder) {
      targetFolder.requests.push(copiedRequest)
    } else {
      return null
    }
  } else {
    targetCollection.requests.push(copiedRequest)
  }

  targetCollection.updatedAt = now
  saveCollections()
  notifyListeners()
  return copiedRequest
}

export function deleteRequest(collectionId: string, folderId: string | null, requestId: string): void {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return

  let requests: SavedRequest[] | null = null

  if (folderId) {
    const folder = findFolderInCollection(collection, folderId)
    if (folder) {
      requests = folder.requests
    }
  } else {
    requests = collection.requests
  }

  if (requests) {
    const index = requests.findIndex((r) => r.id === requestId)
    if (index >= 0) {
      requests.splice(index, 1)
      collection.updatedAt = Date.now()
      saveCollections()
      notifyListeners()
    }
  }
}

export function searchRequests(keyword: string): SavedRequest[] {
  const results: SavedRequest[] = []
  const lowerKeyword = keyword.toLowerCase()

  const searchInFolder = (folder: Folder): void => {
    folder.requests.forEach((r) => {
      if (
        r.name.toLowerCase().includes(lowerKeyword) ||
        r.description.toLowerCase().includes(lowerKeyword) ||
        r.url.toLowerCase().includes(lowerKeyword)
      ) {
        results.push(r)
      }
    })
    folder.folders.forEach(searchInFolder)
  }

  collections.forEach((collection) => {
    collection.requests.forEach((r) => {
      if (
        r.name.toLowerCase().includes(lowerKeyword) ||
        r.description.toLowerCase().includes(lowerKeyword) ||
        r.url.toLowerCase().includes(lowerKeyword)
      ) {
        results.push(r)
      }
    })
    collection.folders.forEach(searchInFolder)
  })

  return results
}

export function findFolder(collectionId: string, folderId: string): Folder | null {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return null
  return findFolderInCollection(collection, folderId)
}

function findFolderInCollection(collection: Collection, folderId: string): Folder | null {
  const search = (folders: Folder[]): Folder | null => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder
      const found = search(folder.folders)
      if (found) return found
    }
    return null
  }
  return search(collection.folders)
}

export function findRequest(collectionId: string, requestId: string): SavedRequest | null {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return null

  const request = collection.requests.find((r) => r.id === requestId)
  if (request) return request

  const searchInFolder = (folder: Folder): SavedRequest | null => {
    const req = folder.requests.find((r) => r.id === requestId)
    if (req) return req
    for (const f of folder.folders) {
      const found = searchInFolder(f)
      if (found) return found
    }
    return null
  }

  for (const folder of collection.folders) {
    const found = searchInFolder(folder)
    if (found) return found
  }

  return null
}

export function getTreeNodes(): TreeNode[] {
  return collections.map((collection) => ({
    id: collection.id,
    type: 'collection' as TreeNodeType,
    name: collection.name,
    children: [
      ...collection.folders.map((folder) => buildFolderTreeNode(folder)),
      ...collection.requests.map((request) => ({
        id: request.id,
        type: 'request' as TreeNodeType,
        name: request.name,
        data: request,
      })),
    ],
    data: collection,
  }))
}

function buildFolderTreeNode(folder: Folder): TreeNode {
  return {
    id: folder.id,
    type: 'folder' as TreeNodeType,
    name: folder.name,
    children: [
      ...folder.folders.map((f) => buildFolderTreeNode(f)),
      ...folder.requests.map((request) => ({
        id: request.id,
        type: 'request' as TreeNodeType,
        name: request.name,
        data: request,
      })),
    ],
    data: folder,
  }
}

export function findRequestLocation(
  requestId: string
): { collectionId: string; folderId: string | null } | null {
  for (const collection of collections) {
    if (collection.requests.some((r) => r.id === requestId)) {
      return { collectionId: collection.id, folderId: null }
    }

    const searchInFolder = (folder: Folder): string | null => {
      if (folder.requests.some((r) => r.id === requestId)) {
        return folder.id
      }
      for (const f of folder.folders) {
        const found = searchInFolder(f)
        if (found) return found
      }
      return null
    }

    for (const folder of collection.folders) {
      const folderId = searchInFolder(folder)
      if (folderId) {
        return { collectionId: collection.id, folderId }
      }
    }
  }
  return null
}

export function importCollections(newCollections: Collection[]): void {
  collections = [...collections, ...newCollections]
  saveCollections()
  notifyListeners()
}

export function exportCollection(collectionId: string): Collection | null {
  const collection = collections.find((c) => c.id === collectionId)
  return collection ? JSON.parse(JSON.stringify(collection)) : null
}

export function exportAllCollections(): Collection[] {
  return JSON.parse(JSON.stringify(collections))
}

export function createEmptyCollection(): Collection {
  const now = Date.now()
  return {
    id: generateId(),
    name: '新建集合',
    description: '',
    folders: [],
    requests: [],
    variables: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function getCollectionVariables(collectionId: string): Variable[] {
  const collection = collections.find((c) => c.id === collectionId)
  return collection?.variables || []
}

export function updateCollectionVariables(collectionId: string, variables: Variable[]): void {
  const collection = collections.find((c) => c.id === collectionId)
  if (collection) {
    collection.variables = variables
    collection.updatedAt = Date.now()
    saveCollections()
    notifyListeners()
  }
}

export function createEmptyFolder(): Folder {
  const now = Date.now()
  return {
    id: generateId(),
    name: '新建文件夹',
    description: '',
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function convertToSavedRequest(request: HttpRequest, name: string, description: string = ''): SavedRequest {
  const now = Date.now()
  return {
    ...JSON.parse(JSON.stringify(request)),
    id: generateId(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
  }
}

loadCollections()
