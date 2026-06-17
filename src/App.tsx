import { useState, useMemo, useCallback } from 'react'
import type {
  HttpMethod,
  KeyValuePair,
  HttpResponse,
  RequestBody,
  AuthConfig,
  CookieItem,
  HttpRequest,
  SavedRequest,
} from './types'
import { generateId, createEmptyPair, buildUrlWithParams, mergeCookies } from './utils'
import { sendRequest, cancelRequest, isElectron, getAllCookies, setCookieStorage } from './requestService'
import * as historyStore from './store/historyStore'
import RequestBar from './components/RequestBar'
import RequestTabs from './components/RequestTabs'
import ResponsePanel from './components/ResponsePanel'
import Sidebar from './components/Sidebar'
import SaveRequestDialog from './components/SaveRequestDialog'
import ImportDialog from './components/ImportDialog'

const STORAGE_KEY = 'postboy_cookies'

if (!isElectron()) {
  setCookieStorage({
    getCookies: () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    },
    setCookies: (cookies: CookieItem[]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cookies))
      } catch {}
    },
  })
}

export default function App() {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [timeout, setTimeout] = useState(30)
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([createEmptyPair()])
  const [headers, setHeaders] = useState<KeyValuePair[]>([createEmptyPair()])
  const [bodyConfig, setBodyConfig] = useState<RequestBody>({ type: 'none' })
  const [auth, setAuth] = useState<AuthConfig>({ type: 'no-auth' })
  const [cookies, setCookies] = useState<CookieItem[]>([])
  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const fullUrl = useMemo(() => {
    try {
      return buildUrlWithParams(url, queryParams)
    } catch {
      return url
    }
  }, [url, queryParams])

  const currentRequest: HttpRequest = useMemo(
    () => ({
      id: 'current',
      method,
      url: fullUrl,
      headers,
      queryParams,
      bodyConfig,
      auth,
      cookies: [...getAllCookies(), ...cookies],
      timeout: timeout * 1000,
    }),
    [method, fullUrl, headers, queryParams, bodyConfig, auth, cookies, timeout]
  )

  const requestPreview: HttpRequest = useMemo(
    () => ({
      ...currentRequest,
      id: 'preview',
    }),
    [currentRequest]
  )

  const loadRequest = useCallback((request: HttpRequest | SavedRequest) => {
    setMethod(request.method)
    setUrl(request.url)
    setTimeout(Math.ceil(request.timeout / 1000))
    setQueryParams(request.queryParams.length > 0 ? [...request.queryParams] : [createEmptyPair()])
    setHeaders(request.headers.length > 0 ? [...request.headers] : [createEmptyPair()])
    setBodyConfig(request.bodyConfig || { type: 'none' })
    setAuth(request.auth || { type: 'no-auth' })
    setCookies(request.cookies || [])
    setResponse(null)
    setError(null)
  }, [])

  const handleSend = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    const requestId = generateId()
    setCurrentRequestId(requestId)

    const requestToSend: HttpRequest = {
      ...currentRequest,
      id: requestId,
      queryParams: [],
    }

    try {
      const result = await sendRequest(requestToSend)

      if (result.cookies && result.cookies.length > 0) {
        const merged = mergeCookies(cookies, result.cookies)
        setCookies(merged)
      }

      setResponse(result)
      historyStore.addHistoryItem(requestToSend, result)
    } catch (e) {
      if ((e as Error).message !== 'Request cancelled') {
        const errorMessage = (e as Error).message
        setError(errorMessage)
        historyStore.addHistoryItem(requestToSend, undefined, errorMessage)
      }
    } finally {
      setLoading(false)
      setCurrentRequestId(null)
    }
  }

  const handleCancel = () => {
    if (currentRequestId) {
      cancelRequest(currentRequestId)
      setLoading(false)
      setError('请求已取消')
    }
  }

  const handleShowSaveDialog = () => {
    setShowSaveDialog(true)
  }

  const handleShowImportDialog = () => {
    setShowImportDialog(true)
  }

  const handleSaved = () => {
    alert('请求已保存')
  }

  const handleImported = () => {
    alert('导入成功')
  }

  return (
    <div className="app">
      <div className="header">
        <h1>PostBoy - HTTP 请求调试工具</h1>
      </div>
      <div className="main-content">
        <Sidebar
          onSelectRequest={loadRequest}
          onShowSaveDialog={handleShowSaveDialog}
          onShowImportDialog={handleShowImportDialog}
        />
        <div className="request-content">
          <RequestBar
            method={method}
            url={url}
            timeout={timeout}
            loading={loading}
            onMethodChange={setMethod}
            onUrlChange={setUrl}
            onTimeoutChange={setTimeout}
            onSend={handleSend}
            onCancel={handleCancel}
          />
          <RequestTabs
            queryParams={queryParams}
            headers={headers}
            bodyConfig={bodyConfig}
            auth={auth}
            cookies={cookies}
            requestPreview={requestPreview}
            onQueryParamsChange={setQueryParams}
            onHeadersChange={setHeaders}
            onBodyChange={setBodyConfig}
            onAuthChange={setAuth}
            onCookiesChange={setCookies}
            disabled={loading}
          />
          <ResponsePanel response={response} loading={loading} error={error} />
        </div>
      </div>
      {showSaveDialog && (
        <SaveRequestDialog
          request={currentRequest}
          onClose={() => setShowSaveDialog(false)}
          onSaved={handleSaved}
        />
      )}
      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onImported={handleImported}
        />
      )}
    </div>
  )
}
