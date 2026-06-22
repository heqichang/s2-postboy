import { useState, useMemo, useCallback, useEffect } from 'react'
import type {
  HttpMethod,
  KeyValuePair,
  HttpResponse,
  RequestBody,
  AuthConfig,
  CookieItem,
  HttpRequest,
  SavedRequest,
  ScriptResult,
  Assertion,
  AssertionResult,
} from './types'
import { generateId, createEmptyPair, buildUrlWithParams, mergeCookies } from './utils'
import { sendRequest, cancelRequest, isElectron, getAllCookies, setCookieStorage } from './requestService'
import * as historyStore from './store/historyStore'
import * as environmentStore from './store/environmentStore'
import * as collectionStore from './store/collectionStore'
import * as mockStore from './store/mockStore'
import { replaceVariablesInObject, buildVariableStore } from './variableReplacer'
import { runPreRequestScript, runPostRequestScript } from './scriptRunner'
import { runAssertions } from './assertionEngine'
import RequestBar from './components/RequestBar'
import RequestTabs from './components/RequestTabs'
import ResponsePanel from './components/ResponsePanel'
import Sidebar from './components/Sidebar'
import EnvironmentSelector from './components/EnvironmentSelector'
import SaveRequestDialog from './components/SaveRequestDialog'
import ImportDialog from './components/ImportDialog'
import TestRunner from './components/TestRunner'
import { ModalProvider, useModal } from './components/ModalContext'

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

function AppContent() {
  const { showAlert } = useModal()
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [timeout, setTimeout] = useState(30)
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([createEmptyPair()])
  const [headers, setHeaders] = useState<KeyValuePair[]>([createEmptyPair()])
  const [bodyConfig, setBodyConfig] = useState<RequestBody>({ type: 'none' })
  const [auth, setAuth] = useState<AuthConfig>({ type: 'no-auth' })
  const [cookies, setCookies] = useState<CookieItem[]>([])
  const [preRequestScript, setPreRequestScript] = useState('')
  const [postRequestScript, setPostRequestScript] = useState('')
  const [assertions, setAssertions] = useState<Assertion[]>([])
  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showTestRunner, setShowTestRunner] = useState(false)
  const [testRunnerConfig, setTestRunnerConfig] = useState<{ collectionId: string; folderId?: string | null } | null>(null)
  const [scriptResults, setScriptResults] = useState<{
    preRequest?: ScriptResult
    postRequest?: ScriptResult
  }>({})
  const [assertionResults, setAssertionResults] = useState<AssertionResult[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(collectionStore.getActiveCollectionId())
  const [, forceUpdate] = useState({})

  useEffect(() => {
    const unsubEnv = environmentStore.subscribe(() => {
      forceUpdate({})
    })
    const unsubCol = collectionStore.subscribe(() => {
      setActiveCollectionId(collectionStore.getActiveCollectionId())
      forceUpdate({})
    })
    return () => {
      unsubEnv()
      unsubCol()
    }
  }, [])

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
      preRequestScript,
      postRequestScript,
      assertions,
    }),
    [method, fullUrl, headers, queryParams, bodyConfig, auth, cookies, timeout, preRequestScript, postRequestScript, assertions]
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
    setPreRequestScript(request.preRequestScript || '')
    setPostRequestScript(request.postRequestScript || '')
    setAssertions(request.assertions || [])
    setResponse(null)
    setError(null)
    setScriptResults({})
    setAssertionResults([])
  }, [])

  const handleSend = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)
    setScriptResults({})
    setAssertionResults([])

    const requestId = generateId()
    setCurrentRequestId(requestId)

    try {
      let variableStore = buildVariableStore(activeCollectionId)

      if (preRequestScript) {
        const { result: preResult, finalStore } = runPreRequestScript(preRequestScript, activeCollectionId)
        setScriptResults((prev) => ({ ...prev, preRequest: preResult }))
        variableStore = finalStore

        if (!preResult.success) {
          throw new Error(`预请求脚本执行失败: ${preResult.error}`)
        }
      }

      const requestToSend: HttpRequest = {
        ...currentRequest,
        id: requestId,
        queryParams: [],
      }

      const { result: processedRequest, missingVariables } = replaceVariablesInObject(requestToSend, variableStore)

      if (missingVariables.length > 0) {
        console.warn(`未找到的变量: ${missingVariables.join(', ')}`)
      }

      const result = await sendRequest(processedRequest)

      if (result.cookies && result.cookies.length > 0) {
        const merged = mergeCookies(cookies, result.cookies)
        setCookies(merged)
      }

      setResponse(result)

      if (assertions.length > 0) {
        const assertionResults = runAssertions(assertions, result)
        setAssertionResults(assertionResults)
      }

      if (postRequestScript) {
        const { result: postResult } = runPostRequestScript(
          postRequestScript,
          processedRequest,
          result,
          activeCollectionId
        )
        setScriptResults((prev) => ({ ...prev, postRequest: postResult }))

        if (postResult.variables.environment) {
          const activeEnv = environmentStore.getActiveEnvironment()
          if (activeEnv) {
            const updatedVariables = [...activeEnv.variables]
            Object.entries(postResult.variables.environment).forEach(([key, value]) => {
              const existingIndex = updatedVariables.findIndex((v) => v.key === key)
              if (existingIndex >= 0) {
                updatedVariables[existingIndex] = {
                  ...updatedVariables[existingIndex],
                  value,
                  enabled: true,
                }
              } else {
                updatedVariables.push({
                  id: generateId(),
                  key,
                  value,
                  enabled: true,
                })
              }
            })
            environmentStore.updateEnvironment(activeEnv.id, { variables: updatedVariables })
          }
        }

        if (postResult.variables.global) {
          const currentGlobal = environmentStore.getGlobalVariables()
          const updatedVariables = [...currentGlobal]
          Object.entries(postResult.variables.global).forEach(([key, value]) => {
            const existingIndex = updatedVariables.findIndex((v) => v.key === key)
            if (existingIndex >= 0) {
              updatedVariables[existingIndex] = {
                ...updatedVariables[existingIndex],
                value,
                enabled: true,
              }
            } else {
              updatedVariables.push({
                id: generateId(),
                key,
                value,
                enabled: true,
              })
            }
          })
          environmentStore.updateGlobalVariables(updatedVariables)
        }
      }

      historyStore.addHistoryItem(processedRequest, result)
    } catch (e) {
      if ((e as Error).message !== 'Request cancelled') {
        const errorMessage = (e as Error).message
        setError(errorMessage)
        const requestToSend: HttpRequest = {
          ...currentRequest,
          id: requestId,
          queryParams: [],
        }
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
    showAlert({ message: '请求已保存' })
  }

  const handleImported = () => {
    showAlert({ message: '导入成功' })
  }

  const handleRunCollection = (collectionId: string, folderId?: string | null) => {
    setTestRunnerConfig({ collectionId, folderId })
    setShowTestRunner(true)
  }

  const handleSaveAsMock = useCallback(() => {
    if (!response) return
    mockStore.createRuleFromRequest(currentRequest, response)
    showAlert({ message: '已保存为 Mock 规则，请在 Mock 面板中查看' })
  }, [currentRequest, response, showAlert])

  return (
    <div className="app">
      <div className="header">
        <h1>PostBoy - HTTP 请求调试工具</h1>
        <EnvironmentSelector />
      </div>
      <div className="main-content">
        <Sidebar
          onSelectRequest={loadRequest}
          onShowSaveDialog={handleShowSaveDialog}
          onShowImportDialog={handleShowImportDialog}
          onRunCollection={handleRunCollection}
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
            preRequestScript={preRequestScript}
            postRequestScript={postRequestScript}
            assertions={assertions}
            requestPreview={requestPreview}
            assertionResults={assertionResults}
            onQueryParamsChange={setQueryParams}
            onHeadersChange={setHeaders}
            onBodyChange={setBodyConfig}
            onAuthChange={setAuth}
            onCookiesChange={setCookies}
            onPreRequestScriptChange={setPreRequestScript}
            onPostRequestScriptChange={setPostRequestScript}
            onAssertionsChange={setAssertions}
            disabled={loading}
          />
          <ResponsePanel
            response={response}
            loading={loading}
            error={error}
            scriptResults={scriptResults}
            assertionResults={assertionResults}
            onSaveAsMock={handleSaveAsMock}
          />
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
      {showTestRunner && testRunnerConfig && (
        <TestRunner
          collectionId={testRunnerConfig.collectionId}
          folderId={testRunnerConfig.folderId}
          onClose={() => setShowTestRunner(false)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ModalProvider>
      <AppContent />
    </ModalProvider>
  )
}
