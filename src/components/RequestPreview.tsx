import { useState } from 'react'
import type { HttpRequest } from '../types'
import { generateCurlCommand, generateHttpRequestPreview } from '../utils'

interface RequestPreviewProps {
  request: HttpRequest
}

type PreviewTab = 'http' | 'curl'

export default function RequestPreview({ request }: RequestPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('http')
  const [copied, setCopied] = useState(false)

  const httpPreview = request.url ? generateHttpRequestPreview(request) : '请输入 URL 以预览请求'
  const curlCommand = request.url ? generateCurlCommand(request) : '请输入 URL 以生成 curl 命令'

  const handleCopy = async () => {
    const text = activeTab === 'http' ? httpPreview : curlCommand
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="request-preview">
      <div className="preview-tabs">
        <button
          className={`preview-tab ${activeTab === 'http' ? 'active' : ''}`}
          onClick={() => setActiveTab('http')}
        >
          HTTP 请求
        </button>
        <button
          className={`preview-tab ${activeTab === 'curl' ? 'active' : ''}`}
          onClick={() => setActiveTab('curl')}
        >
          cURL
        </button>
        <button
          className={`copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="preview-content">
        <pre className="preview-code">
          {activeTab === 'http' ? httpPreview : curlCommand}
        </pre>
      </div>
    </div>
  )
}
