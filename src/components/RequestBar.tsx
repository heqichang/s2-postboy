import type { HttpMethod } from '../types'

interface RequestBarProps {
  method: HttpMethod
  url: string
  timeout: number
  loading: boolean
  onMethodChange: (method: HttpMethod) => void
  onUrlChange: (url: string) => void
  onTimeoutChange: (timeout: number) => void
  onSend: () => void
  onCancel: () => void
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

export default function RequestBar({
  method,
  url,
  timeout,
  loading,
  onMethodChange,
  onUrlChange,
  onTimeoutChange,
  onSend,
  onCancel,
}: RequestBarProps) {
  return (
    <div className="request-panel">
      <div className="url-bar">
        <select
          className="method-select"
          value={method}
          onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
          disabled={loading}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          className="url-input"
          placeholder="输入请求 URL，例如 https://api.example.com"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={loading}
        />
        <input
          type="number"
          className="timeout-input"
          placeholder="超时(秒)"
          value={timeout}
          onChange={(e) => onTimeoutChange(Number(e.target.value))}
          disabled={loading}
          min={1}
          max={300}
        />
        {!loading ? (
          <button className="send-btn" onClick={onSend} disabled={!url.trim()}>
            发送
          </button>
        ) : (
          <button className="cancel-btn" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </div>
  )
}
