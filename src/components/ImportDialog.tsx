import { useState, useRef } from 'react'
import type { ImportFormat } from '../types'
import * as importExport from '../utils/importExport'
import * as collectionStore from '../store/collectionStore'

interface ImportDialogProps {
  onClose: () => void
  onImported: () => void
}

export default function ImportDialog({ onClose, onImported }: ImportDialogProps) {
  const [format, setFormat] = useState<ImportFormat>('json')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formats: { value: ImportFormat; label: string; description: string }[] = [
    { value: 'postman', label: 'Postman Collection v2.1', description: 'Postman 集合 JSON 文件' },
    { value: 'openapi', label: 'OpenAPI 3.0 / Swagger', description: 'OpenAPI 规范 JSON 文件' },
    { value: 'curl', label: 'cURL', description: 'cURL 命令文本，支持批量' },
    { value: 'har', label: 'HAR', description: 'HTTP Archive 归档文件' },
    { value: 'json', label: 'JSON', description: 'PostBoy 自定义 JSON 格式' },
  ]

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      setError(null)
      const text = await file.text()
      setContent(text)
      const detectedFormat = importExport.detectFormat(text, file.name)
      setFormat(detectedFormat)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!content.trim()) {
      setError('请选择文件或粘贴内容')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const collections = importExport.importFromString(content, format)
      collectionStore.importCollections(collections)
      onImported()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>导入集合</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>选择文件</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.har,.curl,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div className="file-input-wrapper">
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                选择文件
              </button>
              <span className="file-name">
                {content ? '已加载内容' : '点击选择文件或在下方粘贴内容'}
              </span>
            </div>
          </div>
          <div className="form-group">
            <label>导入格式</label>
            <div className="format-options">
              {formats.map((f) => (
                <label
                  key={f.value}
                  className={`format-option ${format === f.value ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f.value}
                    checked={format === f.value}
                    onChange={(e) => setFormat(e.target.value as ImportFormat)}
                  />
                  <div>
                    <div className="format-label">{f.label}</div>
                    <div className="format-desc">{f.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>内容</label>
            <textarea
              className="form-textarea form-textarea-large"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`粘贴 ${formats.find((f) => f.value === format)?.label} 内容...`}
              rows={12}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
            {loading ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
