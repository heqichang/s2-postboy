import { useState } from 'react'
import type { HttpMethod, KeyValuePair, HttpResponse } from './types'
import { generateId, createEmptyPair, buildUrlWithParams } from './utils'
import RequestBar from './components/RequestBar'
import RequestTabs from './components/RequestTabs'
import ResponsePanel from './components/ResponsePanel'

export default function App() {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [timeout, setTimeout] = useState(30)
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([createEmptyPair()])
  const [headers, setHeaders] = useState<KeyValuePair[]>([createEmptyPair()])
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)

  const handleSend = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    const requestId = generateId()
    setCurrentRequestId(requestId)

    try {
      const fullUrl = buildUrlWithParams(url, queryParams)
      const result = await window.electronAPI.sendRequest({
        id: requestId,
        method,
        url: fullUrl,
        headers,
        queryParams: [],
        body: body || undefined,
        timeout: timeout * 1000,
      })
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

  const handleCancel = async () => {
    if (currentRequestId) {
      await window.electronAPI.cancelRequest(currentRequestId)
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
        body={body}
        onQueryParamsChange={setQueryParams}
        onHeadersChange={setHeaders}
        onBodyChange={setBody}
        disabled={loading}
      />
      <ResponsePanel response={response} loading={loading} error={error} />
    </div>
  )
}
