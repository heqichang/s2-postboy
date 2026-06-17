import { contextBridge, ipcRenderer } from 'electron'
import type { HttpRequest, HttpResponse, CookieItem } from '../src/types'

contextBridge.exposeInMainWorld('electronAPI', {
  sendRequest: (request: HttpRequest) => ipcRenderer.invoke('http:request', request),
  cancelRequest: (requestId: string) => ipcRenderer.invoke('http:cancel', requestId),
  getCookies: () => ipcRenderer.invoke('http:getCookies'),
  clearCookies: () => ipcRenderer.invoke('http:clearCookies'),
})

declare global {
  interface Window {
    electronAPI: {
      sendRequest: (request: HttpRequest) => Promise<HttpResponse>
      cancelRequest: (requestId: string) => Promise<void>
      getCookies: () => Promise<CookieItem[]>
      clearCookies: () => Promise<{ success: boolean }>
    }
  }
}
