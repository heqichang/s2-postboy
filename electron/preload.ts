import { contextBridge, ipcRenderer } from 'electron'
import type { HttpRequest, HttpResponse } from '../src/types'

contextBridge.exposeInMainWorld('electronAPI', {
  sendRequest: (request: HttpRequest) => ipcRenderer.invoke('http:request', request),
  cancelRequest: (requestId: string) => ipcRenderer.invoke('http:cancel', requestId),
})

declare global {
  interface Window {
    electronAPI: {
      sendRequest: (request: HttpRequest) => Promise<HttpResponse>
      cancelRequest: (requestId: string) => Promise<void>
    }
  }
}
