import { useRef } from 'react'
import type { RequestBody, BodyType, RawSubType, FormDataField, KeyValuePair } from '../types'
import { createEmptyPair, createEmptyFormDataField } from '../utils'

interface BodyEditorProps {
  bodyConfig: RequestBody
  onChange: (bodyConfig: RequestBody) => void
  disabled?: boolean
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' },
  { value: 'binary', label: 'binary' },
  { value: 'graphql', label: 'GraphQL' },
]

const RAW_SUBTYPES: RawSubType[] = ['Text', 'JSON', 'XML', 'HTML', 'JavaScript']

export default function BodyEditor({ bodyConfig, onChange, disabled }: BodyEditorProps) {
  const binaryFileRef = useRef<HTMLInputElement>(null)

  const handleTypeChange = (type: BodyType) => {
    const newConfig: RequestBody = { type }
    switch (type) {
      case 'form-data':
        newConfig.formData = bodyConfig.formData || [createEmptyFormDataField()]
        break
      case 'x-www-form-urlencoded':
        newConfig.urlEncoded = bodyConfig.urlEncoded || [createEmptyPair()]
        break
      case 'raw':
        newConfig.raw = bodyConfig.raw || { content: '', subType: 'JSON' }
        break
      case 'binary':
        newConfig.binary = bodyConfig.binary || { fileName: '', fileData: '' }
        break
      case 'graphql':
        newConfig.graphql = bodyConfig.graphql || { query: '', variables: '' }
        break
    }
    onChange(newConfig)
  }

  const updateFormDataField = (id: string, field: Partial<FormDataField>) => {
    if (!bodyConfig.formData) return
    onChange({
      ...bodyConfig,
      formData: bodyConfig.formData.map((f) => (f.id === id ? { ...f, ...field } : f)),
    })
  }

  const addFormDataField = () => {
    onChange({
      ...bodyConfig,
      formData: [...(bodyConfig.formData || []), createEmptyFormDataField()],
    })
  }

  const removeFormDataField = (id: string) => {
    if (!bodyConfig.formData) return
    onChange({
      ...bodyConfig,
      formData: bodyConfig.formData.filter((f) => f.id !== id),
    })
  }

  const handleFormDataFile = async (id: string, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      updateFormDataField(id, {
        fileName: file.name,
        fileData: reader.result as string,
        value: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  const updateUrlEncodedField = (id: string, field: Partial<KeyValuePair>) => {
    if (!bodyConfig.urlEncoded) return
    onChange({
      ...bodyConfig,
      urlEncoded: bodyConfig.urlEncoded.map((p) => (p.id === id ? { ...p, ...field } : p)),
    })
  }

  const addUrlEncodedField = () => {
    onChange({
      ...bodyConfig,
      urlEncoded: [...(bodyConfig.urlEncoded || []), createEmptyPair()],
    })
  }

  const removeUrlEncodedField = (id: string) => {
    if (!bodyConfig.urlEncoded) return
    onChange({
      ...bodyConfig,
      urlEncoded: bodyConfig.urlEncoded.filter((p) => p.id !== id),
    })
  }

  const handleBinaryFile = async (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      onChange({
        ...bodyConfig,
        binary: {
          fileName: file.name,
          fileData: reader.result as string,
        },
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="body-editor">
      <div className="body-type-selector">
        <select
          className="body-type-select"
          value={bodyConfig.type}
          onChange={(e) => handleTypeChange(e.target.value as BodyType)}
          disabled={disabled}
        >
          {BODY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="body-editor-content">
        {bodyConfig.type === 'none' && (
          <div className="empty-state">
            <div className="empty-state-text">此请求不包含 Body</div>
          </div>
        )}

        {bodyConfig.type === 'form-data' && (
          <div>
            <table className="kv-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ width: 80 }}>类型</th>
                  <th>Key</th>
                  <th>Value</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {bodyConfig.formData?.map((field) => (
                  <tr key={field.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={field.enabled}
                        onChange={(e) => updateFormDataField(field.id, { enabled: e.target.checked })}
                        disabled={disabled}
                      />
                    </td>
                    <td>
                      <select
                        className="kv-input"
                        value={field.type}
                        onChange={(e) => updateFormDataField(field.id, { type: e.target.value as 'text' | 'file' })}
                        disabled={disabled}
                      >
                        <option value="text">Text</option>
                        <option value="file">File</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="kv-input"
                        placeholder="Key"
                        value={field.key}
                        onChange={(e) => updateFormDataField(field.id, { key: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                    <td>
                      {field.type === 'text' ? (
                        <input
                          type="text"
                          className="kv-input"
                          placeholder="Value"
                          value={field.value}
                          onChange={(e) => updateFormDataField(field.id, { value: e.target.value })}
                          disabled={disabled}
                        />
                      ) : (
                        <div className="file-input-wrapper">
                          <span className="file-name">{field.fileName || '未选择文件'}</span>
                          <input
                            type="file"
                            style={{ display: 'none' }}
                            id={`form-file-${field.id}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFormDataFile(field.id, file)
                            }}
                            disabled={disabled}
                          />
                          <button
                            className="browse-btn"
                            onClick={() => document.getElementById(`form-file-${field.id}`)?.click()}
                            disabled={disabled}
                          >
                            选择文件
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="delete-row-btn"
                        onClick={() => removeFormDataField(field.id)}
                        disabled={disabled}
                        title="删除"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-row-btn" onClick={addFormDataField} disabled={disabled}>
              + 添加一行
            </button>
          </div>
        )}

        {bodyConfig.type === 'x-www-form-urlencoded' && (
          <div>
            <table className="kv-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Key</th>
                  <th>Value</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {bodyConfig.urlEncoded?.map((param) => (
                  <tr key={param.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={param.enabled}
                        onChange={(e) => updateUrlEncodedField(param.id, { enabled: e.target.checked })}
                        disabled={disabled}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="kv-input"
                        placeholder="Key"
                        value={param.key}
                        onChange={(e) => updateUrlEncodedField(param.id, { key: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="kv-input"
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) => updateUrlEncodedField(param.id, { value: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                    <td>
                      <button
                        className="delete-row-btn"
                        onClick={() => removeUrlEncodedField(param.id)}
                        disabled={disabled}
                        title="删除"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-row-btn" onClick={addUrlEncodedField} disabled={disabled}>
              + 添加一行
            </button>
          </div>
        )}

        {bodyConfig.type === 'raw' && bodyConfig.raw && (
          <div>
            <select
              className="raw-subtype-select"
              value={bodyConfig.raw.subType}
              onChange={(e) =>
                onChange({
                  ...bodyConfig,
                  raw: { ...bodyConfig.raw!, subType: e.target.value as RawSubType },
                })
              }
              disabled={disabled}
            >
              {RAW_SUBTYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <textarea
              className="body-input body-raw-input"
              placeholder={`输入${bodyConfig.raw.subType}内容...`}
              value={bodyConfig.raw.content}
              onChange={(e) =>
                onChange({
                  ...bodyConfig,
                  raw: { ...bodyConfig.raw!, content: e.target.value },
                })
              }
              disabled={disabled}
            />
          </div>
        )}

        {bodyConfig.type === 'binary' && (
          <div className="binary-body-wrapper">
            <input
              type="file"
              ref={binaryFileRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleBinaryFile(file)
              }}
              disabled={disabled}
            />
            <div className="file-info">
              <span className="file-label">已选择文件：</span>
              <span className="file-name">{bodyConfig.binary?.fileName || '未选择文件'}</span>
            </div>
            <button
              className="browse-btn"
              onClick={() => binaryFileRef.current?.click()}
              disabled={disabled}
            >
              选择文件
            </button>
          </div>
        )}

        {bodyConfig.type === 'graphql' && bodyConfig.graphql && (
          <div className="graphql-body-wrapper">
            <div className="graphql-label">Query</div>
            <textarea
              className="body-input graphql-input"
              placeholder="输入 GraphQL Query..."
              value={bodyConfig.graphql.query}
              onChange={(e) =>
                onChange({
                  ...bodyConfig,
                  graphql: { ...bodyConfig.graphql!, query: e.target.value },
                })
              }
              disabled={disabled}
            />
            <div className="graphql-label">Variables (JSON)</div>
            <textarea
              className="body-input graphql-input"
              placeholder='输入 GraphQL Variables，例如 {"id": 1}'
              value={bodyConfig.graphql.variables}
              onChange={(e) =>
                onChange({
                  ...bodyConfig,
                  graphql: { ...bodyConfig.graphql!, variables: e.target.value },
                })
              }
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  )
}
