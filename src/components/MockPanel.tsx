import { useState, useEffect, useRef } from 'react'
import type { MockRule, MockServerStatus, MockServerConfig, MockLogEntry } from '../types'
import * as mockStore from '../store/mockStore'
import { isElectron } from '../requestService'
import MockRuleEditor from './MockRuleEditor'
import { useModal } from './ModalContext'

type MockPanelTab = 'server' | 'rules' | 'logs' | 'help'

const TEMPLATE_VARS = [
  { syntax: '{{$randomUUID}}', desc: '生成随机 UUID' },
  { syntax: '{{$randomFullName}}', desc: '生成随机中文姓名' },
  { syntax: '{{$randomFirstName}}', desc: '生成随机姓' },
  { syntax: '{{$randomLastName}}', desc: '生成随机名' },
  { syntax: '{{$randomEmail}}', desc: '生成随机邮箱' },
  { syntax: '{{$randomPhone}}', desc: '生成随机手机号' },
  { syntax: '{{$randomCity}}', desc: '生成随机城市' },
  { syntax: '{{$randomCompany}}', desc: '生成随机公司名' },
  { syntax: '{{$randomBoolean}}', desc: '生成随机布尔值' },
  { syntax: '{{$randomNumber(min, max)}}', desc: '生成随机整数' },
  { syntax: '{{$randomFloat(min, max, decimals)}}', desc: '生成随机浮点数' },
  { syntax: '{{$randomImage(width, height)}}', desc: '生成随机图片 URL' },
  { syntax: '{{$randomDate(start, end)}}', desc: '生成随机日期 (YYYY-MM-DD)' },
  { syntax: '{{$randomDateTime}}', desc: '生成随机日期时间' },
  { syntax: '{{$timestamp}}', desc: '当前时间戳 (ms)' },
  { syntax: '{{$timestampISO}}', desc: '当前 ISO 时间字符串' },
  { syntax: '{{$now}}', desc: '当前 ISO 时间字符串' },
  { syntax: '{{$today}}', desc: '今天的日期' },
  { syntax: '{{$randomWord}}', desc: '生成随机单词' },
  { syntax: '{{$randomWords(count)}}', desc: '生成随机多个单词' },
  { syntax: '{{$randomUrl}}', desc: '生成随机 URL' },
  { syntax: '{{$randomIp}}', desc: '生成随机 IP 地址' },
  { syntax: '{{$randomColor}}', desc: '生成随机十六进制颜色' },
  { syntax: '{{request.pathParams.xxx}}', desc: '获取路径参数值' },
  { syntax: '{{request.queryParams.xxx}}', desc: '获取 Query 参数值' },
  { syntax: '{{request.headers.xxx}}', desc: '获取请求 Header 值' },
  { syntax: '{{request.body.xxx}}', desc: '获取请求 Body 字段值' },
]

export default function MockPanel() {
  const { showAlert, showConfirm } = useModal()
  const [activeTab, setActiveTab] = useState<MockPanelTab>('rules')
  const [, forceUpdate] = useState({})
  const [editingRule, setEditingRule] = useState<MockRule | null>(null)
  const [serverStatus, setServerStatus] = useState<MockServerStatus>({
    running: false,
    port: 3001,
    host: '127.0.0.1',
    url: '',
    requestCount: 0,
  })
  const [localPort, setLocalPort] = useState(3001)
  const [localHost, setLocalHost] = useState('127.0.0.1')
  const [localGlobalDelay, setLocalGlobalDelay] = useState(0)
  const [localCorsEnabled, setLocalCorsEnabled] = useState(true)
  const [selectedLog, setSelectedLog] = useState<MockLogEntry | null>(null)
  const [starting, setStarting] = useState(false)

  const statusRef = useRef(serverStatus)
  statusRef.current = serverStatus

  useEffect(() => {
    const unsubscribe = mockStore.subscribe(() => {
      forceUpdate({})
    })
    const config = mockStore.getConfig()
    setLocalPort(config.port)
    setLocalHost(config.host)
    setLocalGlobalDelay(config.globalDelay)
    setLocalCorsEnabled(config.corsEnabled)
    refreshStatus()
    refreshLogs()
    const interval = setInterval(() => {
      refreshStatus()
      refreshLogs()
    }, 2000)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const refreshStatus = async () => {
    if (!isElectron()) return
    try {
      const status = await window.electronAPI.mockStatus()
      setServerStatus(status)
    } catch {}
  }

  const refreshLogs = async () => {
    if (!isElectron()) return
    try {
      const serverLogs = await window.electronAPI.mockLogs()
      const localLogs = mockStore.getLogs()
      if (serverLogs.length !== localLogs.length || serverLogs[0]?.id !== localLogs[0]?.id) {
        mockStore.replaceLogs(serverLogs)
      }
    } catch {}
  }

  const rules = mockStore.getRules()
  const logs = mockStore.getLogs()

  const handleStartServer = async () => {
    if (!isElectron()) {
      showAlert({ message: 'Mock Server 仅在 Electron 桌面端可用' })
      return
    }
    setStarting(true)
    try {
      const serverConfig: MockServerConfig = {
        enabled: true,
        port: localPort,
        host: localHost,
        globalDelay: localGlobalDelay,
        corsEnabled: localCorsEnabled,
      }
      mockStore.updateConfig(serverConfig)
      const result = await window.electronAPI.mockStart(
        localPort,
        localHost,
        mockStore.getEnabledRules(),
        serverConfig
      )
      if (result.success) {
        showAlert({ message: `Mock Server 已启动: ${result.url}` })
        await refreshStatus()
      } else {
        showAlert({ message: `启动失败: ${result.error}` })
      }
    } finally {
      setStarting(false)
    }
  }

  const handleStopServer = async () => {
    if (!isElectron()) return
    const result = await window.electronAPI.mockStop()
    if (result.success) {
      showAlert({ message: 'Mock Server 已停止' })
      await refreshStatus()
    } else {
      showAlert({ message: `停止失败: ${result.error}` })
    }
  }

  const handleRestartServer = async () => {
    if (!isElectron()) return
    setStarting(true)
    try {
      const serverConfig: MockServerConfig = {
        enabled: true,
        port: localPort,
        host: localHost,
        globalDelay: localGlobalDelay,
        corsEnabled: localCorsEnabled,
      }
      mockStore.updateConfig(serverConfig)
      const result = await window.electronAPI.mockRestart(
        localPort,
        localHost,
        mockStore.getEnabledRules(),
        serverConfig
      )
      if (result.success) {
        showAlert({ message: `Mock Server 已重启: ${result.url}` })
        await refreshStatus()
      } else {
        showAlert({ message: `重启失败: ${result.error}` })
      }
    } finally {
      setStarting(false)
    }
  }

  const syncRulesToServer = async () => {
    if (!isElectron() || !serverStatus.running) return
    await window.electronAPI.mockUpdateRules(mockStore.getEnabledRules())
    const serverConfig: MockServerConfig = {
      enabled: serverStatus.running,
      port: localPort,
      host: localHost,
      globalDelay: localGlobalDelay,
      corsEnabled: localCorsEnabled,
    }
    await window.electronAPI.mockUpdateConfig(serverConfig)
    showAlert({ message: '规则已同步到服务器' })
  }

  const handleAddRule = () => {
    const rule = mockStore.createEmptyRule()
    const added = mockStore.addRule({
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      method: rule.method,
      path: rule.path,
      priority: rule.priority,
      responses: rule.responses,
    })
    setEditingRule(added)
  }

  const handleEditRule = (rule: MockRule) => {
    setEditingRule({ ...rule })
  }

  const handleDeleteRule = async (ruleId: string) => {
    const confirmed = await showConfirm({ message: '确定要删除这条 Mock 规则吗？' })
    if (confirmed) {
      mockStore.deleteRule(ruleId)
    }
  }

  const handleToggleRule = (rule: MockRule) => {
    mockStore.updateRule(rule.id, { enabled: !rule.enabled })
  }

  const handleDuplicateRule = (rule: MockRule) => {
    mockStore.duplicateRule(rule.id)
  }

  const handleClearLogs = async () => {
    mockStore.clearLogs()
    setSelectedLog(null)
    if (isElectron()) {
      try {
        await window.electronAPI.mockClearLogs()
      } catch {}
    }
  }

  const handleSaved = async () => {
    if (serverStatus.running) {
      await syncRulesToServer()
    }
  }

  const formatDateTime = (ts: number) => {
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="mock-panel">
      <div className="mock-tabs">
        <button
          className={`mock-tab ${activeTab === 'server' ? 'active' : ''}`}
          onClick={() => setActiveTab('server')}
        >
          🚀 服务
        </button>
        <button
          className={`mock-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          📋 规则
        </button>
        <button
          className={`mock-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📜 日志
        </button>
        <button
          className={`mock-tab ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => setActiveTab('help')}
        >
          ❓ 帮助
        </button>
      </div>

      <div className="mock-tab-content">
        {activeTab === 'server' && (
          <div className="mock-server-section">
            <div className={`server-status-card ${serverStatus.running ? 'running' : 'stopped'}`}>
              <div className="server-status-indicator">
                <span className={`status-dot ${serverStatus.running ? 'online' : 'offline'}`}></span>
                <span className="status-text">
                  {serverStatus.running ? '运行中' : '已停止'}
                </span>
              </div>
              {serverStatus.running && serverStatus.url && (
                <div className="server-url">
                  <span>服务地址:</span>
                  <code>{serverStatus.url}</code>
                </div>
              )}
              <div className="server-stats">
                <div className="stat-item">
                  <span className="stat-label">处理请求</span>
                  <span className="stat-value">{serverStatus.requestCount}</span>
                </div>
                {serverStatus.startTime && (
                  <div className="stat-item">
                    <span className="stat-label">运行时间</span>
                    <span className="stat-value">
                      {Math.floor((Date.now() - serverStatus.startTime) / 1000)}s
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">服务配置</h3>
              <div className="form-row form-row-inline">
                <div className="form-item form-item-flex">
                  <label className="form-label">Host</label>
                  <input
                    type="text"
                    className="form-input"
                    value={localHost}
                    onChange={(e) => setLocalHost(e.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">端口</label>
                  <input
                    type="number"
                    className="form-input form-input-sm"
                    value={localPort}
                    onChange={(e) => setLocalPort(Number(e.target.value))}
                    min={1}
                    max={65535}
                  />
                </div>
              </div>
              <div className="form-row form-row-inline">
                <div className="form-item">
                  <label className="form-label">全局延迟(ms)</label>
                  <input
                    type="number"
                    className="form-input form-input-sm"
                    value={localGlobalDelay}
                    onChange={(e) => setLocalGlobalDelay(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">启用 CORS</label>
                  <input
                    type="checkbox"
                    checked={localCorsEnabled}
                    onChange={(e) => setLocalCorsEnabled(e.target.checked)}
                  />
                </div>
              </div>
            </div>

            <div className="server-actions">
              {!serverStatus.running ? (
                <button
                  className="btn btn-primary"
                  onClick={handleStartServer}
                  disabled={starting || !isElectron()}
                >
                  {starting ? '启动中...' : '启动服务'}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={handleStopServer}
                  >
                    停止服务
                  </button>
                  <button
                    className="btn"
                    onClick={handleRestartServer}
                    disabled={starting}
                  >
                    {starting ? '重启中...' : '重启服务'}
                  </button>
                  <button
                    className="btn"
                    onClick={syncRulesToServer}
                  >
                    同步规则
                  </button>
                </>
              )}
              {!isElectron() && (
                <div className="hint-text">
                  ⚠️ Mock Server 功能仅在 Electron 桌面端可用。当前为浏览器环境。
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="mock-rules-section">
            <div className="section-actions">
              <button className="btn btn-primary btn-small" onClick={handleAddRule}>
                + 新建规则
              </button>
              {serverStatus.running && (
                <button className="btn btn-small" onClick={syncRulesToServer}>
                  同步到服务
                </button>
              )}
            </div>
            <div className="mock-rules-list">
              {rules.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-text">暂无 Mock 规则，点击上方按钮创建</div>
                </div>
              )}
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`mock-rule-item ${!rule.enabled ? 'disabled' : ''}`}
                >
                  <div className="mock-rule-header">
                    <div className="mock-rule-toggle" onClick={() => handleToggleRule(rule)}>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        readOnly
                      />
                    </div>
                    <div className="mock-rule-info">
                      <div className="mock-rule-name">{rule.name}</div>
                      <div className="mock-rule-meta">
                        <span className={`method-badge method-${rule.method.toLowerCase()}`}>
                          {rule.method}
                        </span>
                        <span className="mock-rule-path">{rule.path}</span>
                      </div>
                      {rule.description && (
                        <div className="mock-rule-desc">{rule.description}</div>
                      )}
                    </div>
                    <div className="mock-rule-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleEditRule(rule)}
                        title="编辑"
                      >
                        ✎
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDuplicateRule(rule)}
                        title="复制"
                      >
                        ⎘
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDeleteRule(rule.id)}
                        title="删除"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="mock-rule-summary">
                    {rule.responses.length} 个响应 · 优先级 {rule.priority}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="mock-logs-section">
            <div className="section-actions">
              <span className="logs-count">{logs.length} 条日志</span>
              <button className="btn btn-small" onClick={handleClearLogs}>
                清空日志
              </button>
            </div>
            <div className="mock-logs-container">
              <div className="mock-logs-list">
                {logs.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">📜</div>
                    <div className="empty-state-text">暂无请求日志</div>
                  </div>
                )}
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`mock-log-item ${selectedLog?.id === log.id ? 'selected' : ''} ${log.statusCode >= 400 ? 'error' : ''}`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="log-status">
                      <span className={`status-badge ${log.statusCode >= 400 ? 'error' : 'success'}`}>
                        {log.statusCode}
                      </span>
                    </div>
                    <div className="log-info">
                      <div className="log-method-url">
                        <span className={`method-badge method-${log.method.toLowerCase()}`}>
                          {log.method}
                        </span>
                        <span className="log-url">{log.url}</span>
                      </div>
                      <div className="log-meta">
                        <span>{formatDateTime(log.timestamp)}</span>
                        <span>·</span>
                        <span>{log.responseTime}ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {selectedLog && (
                <div className="mock-log-detail">
                  <div className="log-detail-header">
                    <h4>请求详情</h4>
                    <button className="btn-icon" onClick={() => setSelectedLog(null)}>×</button>
                  </div>
                  <div className="log-detail-section">
                    <div className="log-detail-label">状态码</div>
                    <div className="log-detail-value">{selectedLog.statusCode}</div>
                  </div>
                  <div className="log-detail-section">
                    <div className="log-detail-label">响应时间</div>
                    <div className="log-detail-value">{selectedLog.responseTime} ms</div>
                  </div>
                  <div className="log-detail-section">
                    <div className="log-detail-label">请求 Headers</div>
                    <pre className="log-detail-pre">
                      {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                    </pre>
                  </div>
                  {selectedLog.requestBody && (
                    <div className="log-detail-section">
                      <div className="log-detail-label">请求 Body</div>
                      <pre className="log-detail-pre">{selectedLog.requestBody}</pre>
                    </div>
                  )}
                  <div className="log-detail-section">
                    <div className="log-detail-label">响应 Headers</div>
                    <pre className="log-detail-pre">
                      {JSON.stringify(selectedLog.responseHeaders, null, 2)}
                    </pre>
                  </div>
                  {selectedLog.responseBody && (
                    <div className="log-detail-section">
                      <div className="log-detail-label">响应 Body</div>
                      <pre className="log-detail-pre">{selectedLog.responseBody}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="mock-help-section">
            <h3 className="section-title">模板语法参考</h3>
            <p className="help-text">
              在响应 Body 和 Header Value 中可以使用 <code>{'{{变量}}'}</code> 语法插入动态数据。
            </p>
            <table className="help-table">
              <thead>
                <tr>
                  <th>语法</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_VARS.map((item) => (
                  <tr key={item.syntax}>
                    <td><code>{item.syntax}</code></td>
                    <td>{item.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="section-title" style={{ marginTop: 24 }}>路径参数匹配</h3>
            <p className="help-text">
              路径中使用 <code>:参数名</code> 定义路径参数，例如：
            </p>
            <pre className="help-pre">
              规则路径: /api/users/:id{'\n'}
              请求路径: /api/users/123{'\n'}
              在响应中可使用: {`{{request.pathParams.id}}`} =&gt; "123"
            </pre>

            <h3 className="section-title" style={{ marginTop: 24 }}>响应条件匹配</h3>
            <p className="help-text">
              每个响应可以配置多个匹配条件，支持以下类型：
            </p>
            <ul className="help-list">
              <li><strong>路径参数</strong>: 匹配 URL 中的路径参数</li>
              <li><strong>Query 参数</strong>: 匹配 URL 查询字符串中的参数</li>
              <li><strong>Header</strong>: 匹配请求头中的字段</li>
              <li><strong>Body 字段</strong>: 匹配请求 Body (JSON) 中的字段</li>
            </ul>
            <p className="help-text">
              操作符支持：等于、包含、正则匹配、存在判断
            </p>
          </div>
        )}
      </div>

      {editingRule && (
        <MockRuleEditor
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
