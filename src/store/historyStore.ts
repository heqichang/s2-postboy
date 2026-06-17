import { generateId } from '../utils'
import type { HistoryItem, HttpRequest, HttpResponse } from '../types'

const HISTORY_STORAGE_KEY = 'postboy_history'
const MAX_HISTORY_ITEMS = 100

let items: HistoryItem[] = []
const listeners = new Set<() => void>()

function loadHistory(): void {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (stored) {
      items = JSON.parse(stored)
    }
  } catch {
    items = []
  }
}

function saveHistory(): void {
  try {
    const data = items.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHistory(): HistoryItem[] {
  return items
}

export function addHistoryItem(
  request: HttpRequest,
  response?: HttpResponse,
  error?: string
): HistoryItem {
  const historyItem: HistoryItem = {
    id: generateId(),
    request: JSON.parse(JSON.stringify(request)),
    response: response ? JSON.parse(JSON.stringify(response)) : undefined,
    timestamp: Date.now(),
    statusCode: response?.statusCode,
    error,
  }

  items.unshift(historyItem)

  if (items.length > MAX_HISTORY_ITEMS) {
    items = items.slice(0, MAX_HISTORY_ITEMS)
  }

  saveHistory()
  notifyListeners()
  return historyItem
}

export function clearHistory(): void {
  items = []
  saveHistory()
  notifyListeners()
}

export function deleteHistoryItem(id: string): void {
  const index = items.findIndex((item) => item.id === id)
  if (index >= 0) {
    items.splice(index, 1)
    saveHistory()
    notifyListeners()
  }
}

export function searchHistory(keyword: string): HistoryItem[] {
  const lowerKeyword = keyword.toLowerCase()
  return items.filter(
    (item) =>
      item.request.url.toLowerCase().includes(lowerKeyword) ||
      item.request.method.toLowerCase().includes(lowerKeyword)
  )
}

export function resendRequest(historyItem: HistoryItem): HttpRequest {
  return JSON.parse(JSON.stringify(historyItem.request))
}

loadHistory()
