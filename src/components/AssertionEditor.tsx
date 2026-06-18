import { useState } from 'react'
import type { Assertion, AssertionType, AssertionOperator, AssertionResult } from '../types'
import {
  createAssertion,
  getAssertionTypeLabel,
  getOperatorLabel,
  getAvailableOperators,
  needsProperty,
  needsExpectedValue,
} from '../assertionEngine'

interface AssertionEditorProps {
  assertions: Assertion[]
  onChange: (assertions: Assertion[]) => void
  disabled?: boolean
  results?: AssertionResult[]
}

const assertionTypes: AssertionType[] = [
  'statusCode',
  'responseTime',
  'responseBody',
  'jsonValue',
  'header',
  'contentType',
  'jsonSchema',
]

export default function AssertionEditor({ assertions, onChange, disabled, results }: AssertionEditorProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)

  const handleAddAssertion = (type: AssertionType) => {
    const newAssertion = createAssertion(type)
    onChange([...assertions, newAssertion])
    setShowAddMenu(false)
  }

  const handleUpdateAssertion = (id: string, updates: Partial<Assertion>) => {
    onChange(
      assertions.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      )
    )
  }

  const handleDeleteAssertion = (id: string) => {
    onChange(assertions.filter((a) => a.id !== id))
  }

  const handleToggleEnabled = (id: string) => {
    onChange(
      assertions.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      )
    )
  }

  const getResultById = (id: string): AssertionResult | undefined => {
    return results?.find((r) => r.assertion.id === id)
  }

  return (
    <div className="assertion-editor">
      <div className="assertion-header">
        <span className="assertion-title">可视化断言</span>
        <span className="assertion-count">{assertions.filter((a) => a.enabled).length} 个断言</span>
      </div>

      {assertions.length === 0 && (
        <div className="assertion-empty">
          <div className="empty-icon">📋</div>
          <p>还没有添加断言</p>
          <p className="hint">点击下方按钮添加断言</p>
        </div>
      )}

      <div className="assertion-list">
        {assertions.map((assertion, index) => {
          const result = getResultById(assertion.id)
          return (
            <div
              key={assertion.id}
              className={`assertion-item ${!assertion.enabled ? 'disabled' : ''} ${result ? (result.passed ? 'result-passed' : 'result-failed') : ''}`}
            >
              <div className="assertion-item-header">
                <input
                  type="checkbox"
                  checked={assertion.enabled}
                  onChange={() => handleToggleEnabled(assertion.id)}
                  disabled={disabled}
                  className="assertion-checkbox"
                />
                <span className="assertion-index">#{index + 1}</span>
                <span className="assertion-type-badge">{getAssertionTypeLabel(assertion.type)}</span>
                {result && (
                  <span className={`assertion-result-badge ${result.passed ? 'passed' : 'failed'}`}>
                    {result.passed ? '✓ 通过' : '✗ 失败'}
                  </span>
                )}
                <button
                  className="assertion-delete-btn"
                  onClick={() => handleDeleteAssertion(assertion.id)}
                  disabled={disabled}
                  title="删除断言"
                >
                  ×
                </button>
              </div>

              <div className="assertion-item-content">
                <div className="assertion-row">
                  <label className="assertion-label">断言类型</label>
                  <select
                    value={assertion.type}
                    onChange={(e) => {
                      const newType = e.target.value as AssertionType
                      const newAssertion = createAssertion(newType)
                      handleUpdateAssertion(assertion.id, {
                        type: newType,
                        operator: newAssertion.operator,
                        expectedValue: newAssertion.expectedValue,
                        property: newAssertion.property,
                      })
                    }}
                    disabled={disabled}
                    className="assertion-select"
                  >
                    {assertionTypes.map((type) => (
                      <option key={type} value={type}>
                        {getAssertionTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>

                {needsProperty(assertion.type) && (
                  <div className="assertion-row">
                    <label className="assertion-label">
                      {assertion.type === 'header' ? 'Header 名称' : 'JSON 路径'}
                    </label>
                    <input
                      type="text"
                      value={assertion.property || ''}
                      onChange={(e) => handleUpdateAssertion(assertion.id, { property: e.target.value })}
                      disabled={disabled}
                      className="assertion-input"
                      placeholder={assertion.type === 'header' ? 'Content-Type' : 'data.id'}
                    />
                  </div>
                )}

                <div className="assertion-row">
                  <label className="assertion-label">操作符</label>
                  <select
                    value={assertion.operator}
                    onChange={(e) => handleUpdateAssertion(assertion.id, { operator: e.target.value as AssertionOperator })}
                    disabled={disabled}
                    className="assertion-select"
                  >
                    {getAvailableOperators(assertion.type).map((op) => (
                      <option key={op} value={op}>
                        {getOperatorLabel(op)}
                      </option>
                    ))}
                  </select>
                </div>

                {needsExpectedValue(assertion.type, assertion.operator) && (
                  <div className="assertion-row">
                    <label className="assertion-label">期望值</label>
                    {assertion.type === 'jsonSchema' ? (
                      <textarea
                        value={String(assertion.expectedValue || '')}
                        onChange={(e) => handleUpdateAssertion(assertion.id, { expectedValue: e.target.value })}
                        disabled={disabled}
                        className="assertion-textarea"
                        placeholder='{"type": "object", "properties": {...}}'
                      />
                    ) : (
                      <input
                        type={assertion.type === 'statusCode' || assertion.type === 'responseTime' ? 'number' : 'text'}
                        value={assertion.expectedValue ?? ''}
                        onChange={(e) => {
                          const val = assertion.type === 'statusCode' || assertion.type === 'responseTime'
                            ? Number(e.target.value)
                            : e.target.value
                          handleUpdateAssertion(assertion.id, { expectedValue: val })
                        }}
                        disabled={disabled}
                        className="assertion-input"
                        placeholder={assertion.type === 'statusCode' ? '200' : assertion.type === 'responseTime' ? '500' : '期望的值'}
                      />
                    )}
                  </div>
                )}

                {result && !result.passed && result.error && (
                  <div className="assertion-error">
                    <span className="error-icon">⚠</span>
                    <span>{result.error}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="assertion-add-section">
        {showAddMenu ? (
          <div className="assertion-add-menu">
            <div className="add-menu-title">选择断言类型</div>
            <div className="add-menu-grid">
              {assertionTypes.map((type) => (
                <button
                  key={type}
                  className="add-menu-item"
                  onClick={() => handleAddAssertion(type)}
                  disabled={disabled}
                >
                  <div className="add-menu-icon">
                    {type === 'statusCode' && '📊'}
                    {type === 'responseTime' && '⏱️'}
                    {type === 'responseBody' && '📝'}
                    {type === 'jsonValue' && '🔍'}
                    {type === 'header' && '📋'}
                    {type === 'contentType' && '📄'}
                    {type === 'jsonSchema' && '🏗️'}
                  </div>
                  <div className="add-menu-label">{getAssertionTypeLabel(type)}</div>
                </button>
              ))}
            </div>
            <button
              className="add-menu-cancel"
              onClick={() => setShowAddMenu(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            className="add-assertion-btn"
            onClick={() => setShowAddMenu(true)}
            disabled={disabled}
          >
            + 添加断言
          </button>
        )}
      </div>
    </div>
  )
}
