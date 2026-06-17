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
  preRequestScript: string
  postRequestScript: string
  requestPreview: HttpRequest
  onQueryParamsChange: (params: KeyValuePair[]) => void
  onHeadersChange: (headers: KeyValuePair[]) => void
  onBodyChange: (bodyConfig: RequestBody) => void
  onAuthChange: (auth: AuthConfig) => void
  onCookiesChange: (cookies: CookieItem[]) => void
  onPreRequestScriptChange: (script: string) => void
  onPostRequestScriptChange: (script: string) => void
  disabled?: boolean
}

type TabType = 'params' | 'headers' | 'body' | 'auth' | 'cookies' | 'pre-request' | 'post-request' | 'preview'

export default function RequestTabs({
  queryParams,
  headers,
  bodyConfig,
  auth,
  cookies,
  preRequestScript,
  postRequestScript,
  requestPreview,
  onQueryParamsChange,
  onHeadersChange,
  onBodyChange,
  onAuthChange,
  onCookiesChange,
  onPreRequestScriptChange,
  onPostRequestScriptChange,
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
          className={`tab ${activeTab === 'pre-request' ? 'active' : ''}`}
          onClick={() => setActiveTab('pre-request')}
        >
          Pre-request
        </button>
        <button
          className={`tab ${activeTab === 'post-request' ? 'active' : ''}`}
          onClick={() => setActiveTab('post-request')}
        >
          Tests
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
        {activeTab === 'pre-request' && (
          <div className="script-editor">
            <textarea
              value={preRequestScript}
              onChange={(e) => onPreRequestScriptChange(e.target.value)}
              placeholder="// 预请求脚本示例:
// pm.environment.set('timestamp', new Date().toISOString());
// pm.variables.set('randomId', Math.random().toString(36).substring(7));"
              disabled={disabled}
              className="script-textarea"
            />
          </div>
        )}
        {activeTab === 'post-request' && (
          <div className="script-editor">
            <textarea
              value={postRequestScript}
              onChange={(e) => onPostRequestScriptChange(e.target.value)}
              placeholder="// 后置脚本示例:
// var jsonData = pm.response.json();
// pm.environment.set('userId', jsonData.id);
// pm.test('Status code is 200', function() {
//   pm.expect(pm.response.status).to.equal(200);
// });"
              disabled={disabled}
              className="script-textarea"
            />
          </div>
        )}
        {activeTab === 'preview' && (
          <RequestPreview request={requestPreview} />
        )}
      </div>
    </div>
  )
}
