import { useState, useEffect } from 'react'
import type { MockRule, MockResponse, MockMatchCondition, HttpMethod, KeyValuePair } from '../types'
import { createDefaultResponse, createEmptyMatchCondition, updateRule } from '../store/mockStore'
import KeyValueEditor from './KeyValueEditor'
import { useModal } from './ModalContext'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const BODY_TYPES: MockResponse['bodyType'][] = ['json', 'text', 'xml', 'html', 'binary']
const MATCH_TYPES: { value: MockMatchCondition['type']; label: string }[] = [
  { value: 'pathParam', label: '路径参数' },
  { value: 'query', label: 'Query 参数' },
  { value: 'header', label: 'Header' },
  { value: 'body', label: 'Body 字段' },
]
const MATCH_OPERATORS: { value: MockMatchCondition['operator']; label: string }[] = [
  { value: 'equal', label: '等于' },
  { value: 'contains', label: '包含' },
  { value: 'regex', label: '正则' },
  { value: 'exists', label: '存在' },
]

interface MockRuleEditorProps {
  rule: MockRule
  onClose: () => void
  onSaved?: () => void
}

export default function MockRuleEditor({ rule, onClose, onSaved }: MockRuleEditorProps) {
  const { showAlert } = useModal()
  const [localRule, setLocalRule] = useState<MockRule>(rule)
  const [activeResponseId, setActiveResponseId] = useState<string>(
    rule.responses[0]?.id || ''
  )

  useEffect(() => {
    setLocalRule(rule)
    setActiveResponseId(rule.responses[0]?.id || '')
  }, [rule])

  const activeResponse = localRule.responses.find((r) => r.id === activeResponseId)

  const handleSave = () => {
    if (!localRule.name.trim()) {
      showAlert({ message: '请输入规则名称' })
      return
    }
    if (!localRule.path.trim()) {
      showAlert({ message: '请输入请求路径' })
      return
    }
    updateRule(localRule.id, localRule)
    showAlert({ message: '保存成功' })
    onSaved?.()
    onClose()
  }

  const updateRuleField = <K extends keyof MockRule>(field: K, value: MockRule[K]) => {
    setLocalRule((prev) => ({ ...prev, [field]: value }))
  }

  const addResponse = () => {
    const newResponse: MockResponse = {
      ...createDefaultResponse(),
      name: `响应 ${localRule.responses.length + 1}`,
      isDefault: localRule.responses.length === 0,
    }
    setLocalRule((prev) => ({
      ...prev,
      responses: [...prev.responses, newResponse],
    }))
    setActiveResponseId(newResponse.id)
  }

  const updateResponse = (responseId: string, updates: Partial<MockResponse>) => {
    setLocalRule((prev) => ({
      ...prev,
      responses: prev.responses.map((r) =>
        r.id === responseId ? { ...r, ...updates } : r
      ),
    }))
  }

  const deleteResponse = (responseId: string) => {
    if (localRule.responses.length <= 1) {
      showAlert({ message: '至少需要保留一个响应' })
      return
    }
    const deletedIsDefault = localRule.responses.find((r) => r.id === responseId)?.isDefault
    const newResponses = localRule.responses.filter((r) => r.id !== responseId)
    if (deletedIsDefault && newResponses.length > 0) {
      newResponses[0].isDefault = true
    }
    setLocalRule((prev) => ({ ...prev, responses: newResponses }))
    if (activeResponseId === responseId) {
      setActiveResponseId(newResponses[0]?.id || '')
    }
  }

  const setDefaultResponse = (responseId: string) => {
    setLocalRule((prev) => ({
      ...prev,
      responses: prev.responses.map((r) => ({
        ...r,
        isDefault: r.id === responseId,
      })),
    }))
  }

  const updateResponseHeaders = (responseId: string, headers: KeyValuePair[]) => {
    updateResponse(responseId, { headers })
  }

  const addMatchCondition = (responseId: string) => {
    const response = localRule.responses.find((r) => r.id === responseId)
    if (!response) return
    updateResponse(responseId, {
      matchConditions: [...response.matchConditions, createEmptyMatchCondition()],
    })
  }

  const updateMatchCondition = (
    responseId: string,
    conditionId: string,
    updates: Partial<MockMatchCondition>
  ) => {
    const response = localRule.responses.find((r) => r.id === responseId)
    if (!response) return
    updateResponse(responseId, {
      matchConditions: response.matchConditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c
      ),
    })
  }

  const deleteMatchCondition = (responseId: string, conditionId: string) => {
    const response = localRule.responses.find((r) => r.id === responseId)
    if (!response) return
    updateResponse(responseId, {
      matchConditions: response.matchConditions.filter((c) => c.id !== conditionId),
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal mock-rule-editor-modal">
        <div className="modal-header">
          <h2>编辑 Mock 规则</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <h3 className="section-title">基本信息</h3>
            <div className="form-row">
              <label className="form-label">规则名称</label>
              <input
                type="text"
                className="form-input"
                value={localRule.name}
                onChange={(e) => updateRuleField('name', e.target.value)}
                placeholder="输入规则名称"
              />
            </div>
            <div className="form-row">
              <label className="form-label">描述</label>
              <input
                type="text"
                className="form-input"
                value={localRule.description}
                onChange={(e) => updateRuleField('description', e.target.value)}
                placeholder="规则描述（可选）"
              />
            </div>
            <div className="form-row form-row-inline">
              <div className="form-item">
                <label className="form-label">启用</label>
                <input
                  type="checkbox"
                  checked={localRule.enabled}
                  onChange={(e) => updateRuleField('enabled', e.target.checked)}
                />
              </div>
              <div className="form-item">
                <label className="form-label">优先级</label>
                <input
                  type="number"
                  className="form-input form-input-sm"
                  value={localRule.priority}
                  onChange={(e) => updateRuleField('priority', Number(e.target.value))}
                  title="数值越大优先级越高"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">请求匹配</h3>
            <div className="form-row form-row-inline">
              <div className="form-item">
                <label className="form-label">方法</label>
                <select
                  className="form-select"
                  value={localRule.method}
                  onChange={(e) => updateRuleField('method', e.target.value as HttpMethod)}
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-item form-item-flex">
                <label className="form-label">路径</label>
                <input
                  type="text"
                  className="form-input"
                  value={localRule.path}
                  onChange={(e) => updateRuleField('path', e.target.value)}
                  placeholder="/api/users/:id"
                />
              </div>
            </div>
            <div className="form-hint">
              支持路径参数：<code>/api/users/:id</code>，支持精确匹配和通配
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3 className="section-title">响应配置</h3>
              <button className="btn btn-small btn-primary" onClick={addResponse}>
                + 添加响应
              </button>
            </div>
            <div className="response-tabs">
              {localRule.responses.map((resp) => (
                <div
                  key={resp.id}
                  className={`response-tab ${activeResponseId === resp.id ? 'active' : ''} ${resp.isDefault ? 'default' : ''}`}
                  onClick={() => setActiveResponseId(resp.id)}
                >
                  <span className="response-tab-name">{resp.name}</span>
                  <span className="response-tab-status">
                    {resp.statusCode}
                  </span>
                  {resp.isDefault && <span className="response-tab-badge">默认</span>}
                </div>
              ))}
            </div>

            {activeResponse && (
              <div className="response-config">
                <div className="form-row form-row-inline">
                  <div className="form-item form-item-flex">
                    <label className="form-label">响应名称</label>
                    <input
                      type="text"
                      className="form-input"
                      value={activeResponse.name}
                      onChange={(e) => updateResponse(activeResponse.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="form-item">
                    <label className="form-label">状态码</label>
                    <input
                      type="number"
                      className="form-input form-input-sm"
                      value={activeResponse.statusCode}
                      onChange={(e) => updateResponse(activeResponse.id, { statusCode: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-item">
                    <label className="form-label">延迟(ms)</label>
                    <input
                      type="number"
                      className="form-input form-input-sm"
                      value={activeResponse.delay}
                      onChange={(e) => updateResponse(activeResponse.id, { delay: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                  <div className="form-item">
                    <label className="form-label">设为默认</label>
                    <input
                      type="checkbox"
                      checked={activeResponse.isDefault}
                      onChange={(e) => e.target.checked && setDefaultResponse(activeResponse.id)}
                    />
                  </div>
                  <div className="form-item">
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => deleteResponse(activeResponse.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label">Body 类型</label>
                  <select
                    className="form-select"
                    value={activeResponse.bodyType}
                    onChange={(e) => updateResponse(activeResponse.id, { bodyType: e.target.value as MockResponse['bodyType'] })}
                  >
                    {BODY_TYPES.map((t) => (
                      <option key={t} value={t}>{t.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label">响应 Body</label>
                  <textarea
                    className="form-textarea"
                    value={activeResponse.body}
                    onChange={(e) => updateResponse(activeResponse.id, { body: e.target.value })}
                    rows={8}
                    placeholder={
                      activeResponse.bodyType === 'json'
                        ? `支持模板语法，例如：
{
  "id": "{{$randomUUID}}",
  "name": "{{$randomFullName}}",
  "email": "{{$randomEmail}}",
  "userId": "{{request.pathParams.id}}"
}`
                        : '响应内容'
                    }
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">响应 Headers</label>
                  <KeyValueEditor
                    items={activeResponse.headers}
                    onChange={(headers) => updateResponseHeaders(activeResponse.id, headers)}
                  />
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h4 className="subsection-title">匹配条件（满足所有条件时返回此响应）</h4>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => addMatchCondition(activeResponse.id)}
                    >
                      + 添加条件
                    </button>
                  </div>
                  {activeResponse.matchConditions.length === 0 ? (
                    <div className="empty-hint">未设置条件，将作为默认响应返回</div>
                  ) : (
                    <div className="match-conditions">
                      {activeResponse.matchConditions.map((cond) => (
                        <div key={cond.id} className="match-condition-row">
                          <input
                            type="checkbox"
                            checked={cond.enabled}
                            onChange={(e) => updateMatchCondition(activeResponse.id, cond.id, { enabled: e.target.checked })}
                          />
                          <select
                            className="form-select form-select-sm"
                            value={cond.type}
                            onChange={(e) => updateMatchCondition(activeResponse.id, cond.id, { type: e.target.value as MockMatchCondition['type'] })}
                          >
                            {MATCH_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="字段名"
                            value={cond.key || ''}
                            onChange={(e) => updateMatchCondition(activeResponse.id, cond.id, { key: e.target.value })}
                          />
                          <select
                            className="form-select form-select-sm"
                            value={cond.operator}
                            onChange={(e) => updateMatchCondition(activeResponse.id, cond.id, { operator: e.target.value as MockMatchCondition['operator'] })}
                          >
                            {MATCH_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="期望值"
                            value={cond.value || ''}
                            onChange={(e) => updateMatchCondition(activeResponse.id, cond.id, { value: e.target.value })}
                          />
                          <button
                            className="btn-icon"
                            onClick={() => deleteMatchCondition(activeResponse.id, cond.id)}
                            title="删除条件"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}
