import { useState, useRef } from 'react'
import type { CollectionRunResult, RunConfig } from '../types'
import { runCollection, exportReport, downloadFile, parseCsv, parseJsonData } from '../testRunner'
import * as collectionStore from '../store/collectionStore'
import * as environmentStore from '../store/environmentStore'
import { getStatusClass } from '../utils'

interface TestRunnerProps {
  onClose: () => void
  collectionId: string
  folderId?: string | null
}

export default function TestRunner({ onClose, collectionId, folderId }: TestRunnerProps) {
  const [config, setConfig] = useState<RunConfig>({
    collectionId,
    folderId: folderId || null,
    environmentId: environmentStore.getActiveEnvironmentId(),
    iterations: 1,
    delay: 0,
    stopOnError: false,
    dataFile: null,
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CollectionRunResult | null>(null)
  const [progress, setProgress] = useState({ currentIndex: 0, totalRequests: 0, currentRequest: '', iteration: 0, totalIterations: 0 })
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set())
  const stopRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const collection = collectionStore.getCollections().find((c) => c.id === collectionId)
  const environments = environmentStore.getEnvironments()

  const handleStart = async () => {
    setRunning(true)
    stopRef.current = false
    setResult(null)

    try {
      const runResult = await runCollection(
        config,
        (p) => setProgress(p),
        () => stopRef.current
      )
      setResult(runResult)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const handleStop = () => {
    stopRef.current = true
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const fileName = file.name
      const ext = file.name.split('.').pop()?.toLowerCase()

      let data: Record<string, string>[] = []
      let type: 'csv' | 'json' = 'csv'

      if (ext === 'csv') {
        type = 'csv'
        data = parseCsv(content)
      } else if (ext === 'json') {
        type = 'json'
        data = parseJsonData(content)
      } else {
        alert('只支持 CSV 和 JSON 文件')
        return
      }

      if (data.length === 0) {
        alert('数据文件为空或格式不正确')
        return
      }

      setConfig({ ...config, dataFile: { type, data, fileName } })
    }
    reader.readAsText(file)
  }

  const handleClearDataFile = () => {
    setConfig({ ...config, dataFile: null })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const toggleRequest = (id: string) => {
    setExpandedRequests((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExport = (format: 'html' | 'json') => {
    if (!result) return
    const content = exportReport(result, format)
    const filename = `test-report-${Date.now()}.${format}`
    const mimeType = format === 'html' ? 'text/html' : 'application/json'
    downloadFile(content, filename, mimeType)
  }

  const passedCount = result?.passedRequests ?? 0
  const passRate = result?.totalRequests ? ((passedCount / result.totalRequests) * 100).toFixed(1) : '0'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal test-runner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>测试运行器 - {collection?.name}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!result && (
            <div className="runner-config">
              <div className="config-section">
                <h4>运行配置</h4>

                <div className="form-group">
                  <label>环境</label>
                  <select
                    value={config.environmentId || ''}
                    onChange={(e) => setConfig({ ...config, environmentId: e.target.value || null })}
                    className="form-select"
                  >
                    <option value="">无环境</option>
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>迭代次数</label>
                  <input
                    type="number"
                    min="1"
                    value={config.iterations}
                    onChange={(e) => setConfig({ ...config, iterations: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>请求延迟 (毫秒)</label>
                  <input
                    type="number"
                    min="0"
                    value={config.delay}
                    onChange={(e) => setConfig({ ...config, delay: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.stopOnError}
                      onChange={(e) => setConfig({ ...config, stopOnError: e.target.checked })}
                    />
                    出错时停止
                  </label>
                </div>
              </div>

              <div className="config-section">
                <h4>数据文件</h4>
                <p className="form-hint">使用 CSV 或 JSON 文件进行数据驱动测试</p>

                {config.dataFile ? (
                  <div className="data-file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{config.dataFile.fileName}</span>
                    <span className="file-rows">{config.dataFile.data.length} 行数据</span>
                    <button className="link-btn" onClick={handleClearDataFile}>移除</button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileUpload}
                      className="form-input"
                      style={{ display: 'none' }}
                    />
                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                      选择数据文件
                    </button>
                  </>
                )}
              </div>

              {running && (
                <div className="runner-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress.totalRequests > 0 ? (progress.currentIndex / progress.totalRequests) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="progress-info">
                    <span>第 {progress.iteration}/{progress.totalIterations} 轮</span>
                    <span>{progress.currentIndex}/{progress.totalRequests} 个请求</span>
                  </div>
                  {progress.currentRequest && (
                    <div className="progress-current">
                      正在运行: {progress.currentRequest}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="runner-results">
              <div className="results-summary">
                <div className="summary-item">
                  <span className="summary-label">总请求</span>
                  <span className="summary-value">{result.totalRequests}</span>
                </div>
                <div className="summary-item passed">
                  <span className="summary-label">通过</span>
                  <span className="summary-value">{result.passedRequests}</span>
                </div>
                <div className="summary-item failed">
                  <span className="summary-label">失败</span>
                  <span className="summary-value">{result.failedRequests}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">通过率</span>
                  <span className="summary-value">{passRate}%</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">平均响应时间</span>
                  <span className="summary-value">{result.averageResponseTime.toFixed(0)}ms</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">脚本测试</span>
                  <span className="summary-value">{result.passedTests}/{result.totalTests}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">断言</span>
                  <span className="summary-value">{result.passedAssertions}/{result.totalAssertions}</span>
                </div>
              </div>

              <div className="results-export">
                <button className="btn btn-secondary" onClick={() => handleExport('html')}>
                  导出 HTML
                </button>
                <button className="btn btn-secondary" onClick={() => handleExport('json')}>
                  导出 JSON
                </button>
              </div>

              <div className="results-list">
                <h4>详细结果</h4>
                {result.results.map((item, index) => {
                  const isExpanded = expandedRequests.has(`${item.requestId}-${index}`)
                  return (
                    <div
                      key={`${item.requestId}-${index}`}
                      className={`result-item ${item.allPassed ? 'passed' : 'failed'}`}
                    >
                      <div className="result-item-header" onClick={() => toggleRequest(`${item.requestId}-${index}`)}>
                        <span className="result-expand">{isExpanded ? '▼' : '▶'}</span>
                        <span className="result-index">#{index + 1}</span>
                        <span className="result-name">{item.requestName}</span>
                        <span className="result-method">{item.request.method}</span>
                        {item.response && (
                          <span className={`result-status ${getStatusClass(item.response.statusCode)}`}>
                            {item.response.statusCode}
                          </span>
                        )}
                        {item.response && (
                          <span className="result-time">{item.response.time}ms</span>
                        )}
                        <span className={`result-badge ${item.allPassed ? 'badge-passed' : 'badge-failed'}`}>
                          {item.allPassed ? '通过' : '失败'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="result-item-detail">
                          {item.error && (
                            <div className="result-error">
                              <strong>错误:</strong> {item.error}
                            </div>
                          )}

                          {item.dataRow && (
                            <div className="result-data-row">
                              <strong>数据行:</strong>
                              <pre>{JSON.stringify(item.dataRow, null, 2)}</pre>
                            </div>
                          )}

                          {item.testResults.length > 0 && (
                            <div className="result-tests">
                              <h5>脚本测试 ({item.testResults.filter((t) => t.passed).length}/{item.testResults.length})</h5>
                              {item.testResults.map((test, i) => (
                                <div key={i} className={`test-item ${test.passed ? 'test-passed' : 'test-failed'}`}>
                                  <span className="test-icon">{test.passed ? '✓' : '✗'}</span>
                                  <span className="test-name">{test.name}</span>
                                  {!test.passed && test.error && (
                                    <span className="test-error">{test.error}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {item.assertionResults.length > 0 && (
                            <div className="result-assertions">
                              <h5>可视化断言 ({item.assertionResults.filter((a) => a.passed).length}/{item.assertionResults.length})</h5>
                              {item.assertionResults.map((assertion, i) => (
                                <div key={i} className={`test-item ${assertion.passed ? 'test-passed' : 'test-failed'}`}>
                                  <span className="test-icon">{assertion.passed ? '✓' : '✗'}</span>
                                  <span className="test-name">
                                    {assertion.assertion.type}
                                    {assertion.assertion.property && `: ${assertion.assertion.property}`}
                                    {' '}{assertion.assertion.operator}
                                    {' '}{assertion.assertion.expectedValue}
                                  </span>
                                  {!assertion.passed && assertion.error && (
                                    <span className="test-error">{assertion.error}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={running}>
                取消
              </button>
              {running ? (
                <button className="btn btn-secondary" onClick={handleStop}>
                  停止
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleStart}>
                  开始运行
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setResult(null)}>
                重新运行
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                关闭
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
