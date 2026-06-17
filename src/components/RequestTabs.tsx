import { useState } from 'react'
import type { KeyValuePair, RequestBody, AuthConfig, CookieItem, HttpRequest } from '../types'
import KeyValueEditor from './KeyValueEditor'
import BodyEditor from './BodyEditor'
import AuthEditor from './AuthEditor'
import CookieEditor from './CookieEditor'
import RequestPreview from './RequestPreview'

interface RequestTabsProps {
  queryParams: KeyValuePair[]
  headers: KeyValuePair[]
  bodyConfig: RequestBody
  auth: AuthConfig
  cookies: CookieItem[]
  requestPreview: HttpRequest
  onQueryParamsChange: (params: KeyValuePair[]) => void
  onHeadersChange: (headers: KeyValuePair[]) => void
  onBodyChange: (bodyConfig: RequestBody) => void
  onAuthChange: (auth: AuthConfig) => void
  onCookiesChange: (cookies: CookieItem[]) => void
  disabled?: boolean
}

type TabType = 'params' | 'headers' | 'body' | 'auth' | 'cookies' | 'preview'

export default function RequestTabs({
  queryParams,
  headers,
  bodyConfig,
  auth,
  cookies,
  requestPreview,
  onQueryParamsChange,
  onHeadersChange,
  onBodyChange,
  onAuthChange,
  onCookiesChange,
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
        <button
          className={`tab ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => setActiveTab('auth')}
        >
          Authorization
        </button>
        <button
          className={`tab ${activeTab === 'cookies' ? 'active' : ''}`}
          onClick={() => setActiveTab('cookies')}
        >
          Cookies
        </button>
        <button
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
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
          <BodyEditor bodyConfig={bodyConfig} onChange={onBodyChange} disabled={disabled} />
        )}
        {activeTab === 'auth' && (
          <AuthEditor auth={auth} onChange={onAuthChange} disabled={disabled} />
        )}
        {activeTab === 'cookies' && (
          <CookieEditor cookies={cookies} onChange={onCookiesChange} disabled={disabled} />
        )}
        {activeTab === 'preview' && (
          <RequestPreview request={requestPreview} />
        )}
      </div>
    </div>
  )
}
