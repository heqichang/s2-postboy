import { contextBridge, ipcRenderer } from 'electron'
import type { HttpRequest, HttpResponse, CookieItem, MockRule, MockServerConfig, MockServerStatus, MockLogEntry } from '../src/types'

contextBridge.exposeInMainWorld('electronAPI', {
  sendRequest: (request: HttpRequest) => ipcRenderer.invoke('http:request', request),
  cancelRequest: (requestId: string) => ipcRenderer.invoke('http:cancel', requestId),
  getCookies: () => ipcRenderer.invoke('http:getCookies'),
  clearCookies: () => ipcRenderer.invoke('http:clearCookies'),
  mockStart: (port: number, host: string, rules: MockRule[], config: MockServerConfig) =>
    ipcRenderer.invoke('mock:start', port, host, rules, config),
  mockStop: () => ipcRenderer.invoke('mock:stop'),
  mockRestart: (port: number, host: string, rules: MockRule[], config: MockServerConfig) =>
    ipcRenderer.invoke('mock:restart', port, host, rules, config),
  mockStatus: () => ipcRenderer.invoke('mock:status'),
  mockLogs: () => ipcRenderer.invoke('mock:logs'),
  mockClearLogs: () => ipcRenderer.invoke('mock:clearLogs'),
  mockUpdateRules: (rules: MockRule[]) => ipcRenderer.invoke('mock:updateRules', rules),
  mockUpdateConfig: (config: MockServerConfig) => ipcRenderer.invoke('mock:updateConfig', config),
})

declare global {
  interface Window {
    electronAPI: {
      sendRequest: (request: HttpRequest) => Promise<HttpResponse>
      cancelRequest: (requestId: string) => Promise<void>
      getCookies: () => Promise<CookieItem[]>
      clearCookies: () => Promise<{ success: boolean }>
      mockStart: (port: number, host: string, rules: MockRule[], config: MockServerConfig) => Promise<{ success: boolean; error?: string; url?: string }>
      mockStop: () => Promise<{ success: boolean; error?: string }>
      mockRestart: (port: number, host: string, rules: MockRule[], config: MockServerConfig) => Promise<{ success: boolean; error?: string; url?: string }>
      mockStatus: () => Promise<MockServerStatus>
      mockLogs: () => Promise<MockLogEntry[]>
      mockClearLogs: () => Promise<{ success: boolean }>
      mockUpdateRules: (rules: MockRule[]) => Promise<{ success: boolean }>
      mockUpdateConfig: (config: MockServerConfig) => Promise<{ success: boolean }>
    }
  }
}
