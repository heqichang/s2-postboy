import { useState, useMemo } from 'react'
import type {
  HttpMethod,
  KeyValuePair,
  HttpResponse,
  RequestBody,
  AuthConfig,
  CookieItem,
  HttpRequest,
} from './types'
import { generateId, createEmptyPair, buildUrlWithParams, mergeCookies } from './utils'
import { sendRequest, cancelRequest, isElectron, getAllCookies, setCookieStorage } from './requestService'
import RequestBar from './components/RequestBar'
import RequestTabs from './components/RequestTabs'
import ResponsePanel from './components/ResponsePanel'

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

  const fullUrl = useMemo(() => {
    try {
      return buildUrlWithParams(url, queryParams)
    } catch {
      return url
    }
  }, [url, queryParams])

  const requestPreview: HttpRequest = useMemo(
    () => ({
      id: 'preview',
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

  const handleSend = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    const requestId = generateId()
    setCurrentRequestId(requestId)

    try {
      const storedCookies = getAllCookies()
      const result = await sendRequest({
        id: requestId,
        method,
        url: fullUrl,
        headers,
        queryParams: [],
        bodyConfig,
        auth,
        cookies: [...storedCookies, ...cookies],
        timeout: timeout * 1000,
      })

      if (result.cookies && result.cookies.length > 0) {
        const merged = mergeCookies(cookies, result.cookies)
        setCookies(merged)
      }

      setResponse(result)
    } catch (e) {
      if ((e as Error).message !== 'Request cancelled') {
        setError((e as Error).message)
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

  return (
    <div className="app">
      <div className="header">
        <h1>PostBoy - HTTP 请求调试工具</h1>
      </div>
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
  )
}
