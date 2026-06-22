import { useState } from 'react'
import type { HttpResponse, ScriptResult, AssertionResult } from '../types'
import { formatBytes, formatTime, formatJson, getStatusClass, formatResponseHeaders } from '../utils'
import { getAssertionTypeLabel, getOperatorLabel } from '../assertionEngine'

interface ResponsePanelProps {
  response: HttpResponse | null
  loading: boolean
  error: string | null
  scriptResults?: {
    preRequest?: ScriptResult
    postRequest?: ScriptResult
  }
  assertionResults?: AssertionResult[]
  onSaveAsMock?: () => void
}

type TabType = 'body' | 'headers' | 'test-results'

function highlightJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let pos = 0
  let key = 0

  const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+\.?\d*[eE]?[+-]?\d*)|(true|false|null)/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(json)) !== null) {
    if (match.index > pos) {
      nodes.push(json.slice(pos, match.index))
    }

    if (match[1]) {
      nodes.push(<span key={key++} className="json-key">{match[1]}</span>)
      nodes.push(':')
    } else if (match[2]) {
      nodes.push(<span key={key++} className="json-string">{match[2]}</span>)
    } else if (match[3]) {
      nodes.push(<span key={key++} className="json-number">{match[3]}</span>)
    } else if (match[4]) {
      const val = match[4]
      if (val === 'true' || val === 'false') {
        nodes.push(<span key={key++} className="json-boolean">{val}</span>)
      } else {
        nodes.push(<span key={key++} className="json-null">{val}</span>)
      }
    }

    pos = match.index + match[0].length
  }

  if (pos < json.length) {
    nodes.push(json.slice(pos))
  }

  return nodes
}

export default function ResponsePanel({ response, loading, error, scriptResults, assertionResults, onSaveAsMock }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('body')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!response) return
    await navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="response-panel">
        <div className="response-body">
          <div className="loading">
            <div className="spinner"></div>
            <span>正在发送请求...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="response-panel">
        <div className="response-body">
          <div className="empty-state">
            <div className="empty-state-icon">⚠</div>
            <div className="empty-state-text" style={{ color: '#f48771' }}>{error}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="response-panel">
        <div className="response-body">
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-text">发送请求以查看响应</div>
          </div>
        </div>
      </div>
    )
  }

  const { formatted, isJson } = formatJson(response.body)

  return (
    <div className="response-panel">
      <div className="response-status-bar">
        <div className="status-item">
          <span className="status-label">状态码</span>
          <span className={`status-value ${getStatusClass(response.statusCode)}`}>
            {response.statusCode} {response.statusText}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">响应时间</span>
          <span className="status-value">{formatTime(response.time)}</span>
        </div>
        <div className="status-item">
          <span className="status-label">响应大小</span>
          <span className="status-value">{formatBytes(response.size)}</span>
        </div>
        <div className="status-item status-actions">
          {onSaveAsMock && (
            <button className="btn btn-small" onClick={onSaveAsMock}>
              🎭 保存为 Mock
            </button>
          )}
        </div>
      </div>

      <div className="response-tabs">
        <button
          className={`response-tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        <button
          className={`response-tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers
        </button>
        <button
          className={`response-tab ${activeTab === 'test-results' ? 'active' : ''}`}
          onClick={() => setActiveTab('test-results')}
        >
          Test Results
          {scriptResults?.postRequest?.tests && scriptResults.postRequest.tests.length > 0 && (
            <span className="test-badge">
              {scriptResults.postRequest.tests.filter((t) => t.passed).length}/{scriptResults.postRequest.tests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'body' && (
        <div className="response-body-container">
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '已复制' : '复制'}
          </button>
          <div className="response-body-content">
            {isJson ? highlightJson(formatted) : formatted}
          </div>
        </div>
      )}

      {activeTab === 'headers' && (
        <div className="response-body">
          <div className="headers-list">
            {formatResponseHeaders(response.headers).map((h, i) => (
              <div key={i} className="header-item">
                <span className="header-name">{h.name}</span>
                <span className="header-value">{h.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'test-results' && (
        <div className="response-body">
          {scriptResults?.preRequest && (
            <div className="script-result-section">
              <h4>Pre-request Script</h4>
              {scriptResults.preRequest.success ? (
                <div className="script-success">✓ 执行成功</div>
              ) : (
                <div className="script-error">✗ 执行失败: {scriptResults.preRequest.error}</div>
              )}
            </div>
          )}

          {assertionResults && assertionResults.length > 0 && (
            <div className="script-result-section">
              <h4>
                可视化断言
                <span className="test-count">
                  {assertionResults.filter((a) => a.passed).length}/{assertionResults.length}
                </span>
              </h4>
              <div className="test-list">
                {assertionResults.map((result, i) => (
                  <div key={i} className={`test-item ${result.passed ? 'test-passed' : 'test-failed'}`}>
                    <span className="test-icon">{result.passed ? '✓' : '✗'}</span>
                    <span className="test-name">
                      {getAssertionTypeLabel(result.assertion.type)}
                      {result.assertion.property && `: ${result.assertion.property}`}
                      {' '}{getOperatorLabel(result.assertion.operator)}
                      {' '}{result.assertion.expectedValue ?? ''}
                    </span>
                    {!result.passed && result.error && (
                      <span className="test-error">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {scriptResults?.postRequest && (
            <div className="script-result-section">
              <h4>
                脚本测试
                <span className="test-count">
                  {scriptResults.postRequest.tests.filter((t) => t.passed).length}/{scriptResults.postRequest.tests.length}
                </span>
              </h4>
              {!scriptResults.postRequest.success && (
                <div className="script-error">✗ 执行失败: {scriptResults.postRequest.error}</div>
              )}
              {scriptResults.postRequest.tests.length > 0 ? (
                <div className="test-list">
                  {scriptResults.postRequest.tests.map((test, i) => (
                    <div key={i} className={`test-item ${test.passed ? 'test-passed' : 'test-failed'}`}>
                      <span className="test-icon">{test.passed ? '✓' : '✗'}</span>
                      <span className="test-name">{test.name}</span>
                      {!test.passed && test.error && (
                        <span className="test-error">{test.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-text">没有测试结果</div>
              )}
              {scriptResults.postRequest.variables && Object.keys(scriptResults.postRequest.variables).length > 0 && (
                <div className="variables-changed">
                  <h5>设置的变量:</h5>
                  {Object.entries(scriptResults.postRequest.variables).map(([scope, vars]) => (
                    Object.keys(vars).length > 0 && (
                      <div key={scope}>
                        <strong>{scope}:</strong>
                        {Object.entries(vars).map(([key, value]) => (
                          <div key={key} className="variable-item">
                            {key} = {value}
                          </div>
                        ))}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
          {!scriptResults?.preRequest && !scriptResults?.postRequest && (!assertionResults || assertionResults.length === 0) && (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <div className="empty-state-text">没有测试结果</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
