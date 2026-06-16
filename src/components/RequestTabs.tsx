import { useState } from 'react'
import type { KeyValuePair } from '../types'
import KeyValueEditor from './KeyValueEditor'

interface RequestTabsProps {
  queryParams: KeyValuePair[]
  headers: KeyValuePair[]
  body: string
  onQueryParamsChange: (params: KeyValuePair[]) => void
  onHeadersChange: (headers: KeyValuePair[]) => void
  onBodyChange: (body: string) => void
  disabled?: boolean
}

type TabType = 'params' | 'headers' | 'body'

export default function RequestTabs({
  queryParams,
  headers,
  body,
  onQueryParamsChange,
  onHeadersChange,
  onBodyChange,
  disabled,
}: RequestTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('params')

  return (
    <div className="request-section">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          Query Params
        </button>
        <button
          className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers
        </button>
        <button
          className={`tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'params' && (
          <KeyValueEditor items={queryParams} onChange={onQueryParamsChange} disabled={disabled} />
        )}
        {activeTab === 'headers' && (
          <KeyValueEditor items={headers} onChange={onHeadersChange} disabled={disabled} />
        )}
        {activeTab === 'body' && (
          <textarea
            className="body-input"
            placeholder="输入请求体（例如 JSON 数据）..."
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}
