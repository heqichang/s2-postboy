import { useState } from 'react'
import type { KeyValuePair, RequestBody, AuthConfig, CookieItem, HttpRequest, Assertion, AssertionResult } from '../types'
import KeyValueEditor from './KeyValueEditor'
import BodyEditor from './BodyEditor'
import AuthEditor from './AuthEditor'
import CookieEditor from './CookieEditor'
import RequestPreview from './RequestPreview'
import AssertionEditor from './AssertionEditor'

interface RequestTabsProps {
  queryParams: KeyValuePair[]
  headers: KeyValuePair[]
  bodyConfig: RequestBody
  auth: AuthConfig
  cookies: CookieItem[]
  preRequestScript: string
  postRequestScript: string
  assertions: Assertion[]
  requestPreview: HttpRequest
  assertionResults?: AssertionResult[]
  onQueryParamsChange: (params: KeyValuePair[]) => void
  onHeadersChange: (headers: KeyValuePair[]) => void
  onBodyChange: (bodyConfig: RequestBody) => void
  onAuthChange: (auth: AuthConfig) => void
  onCookiesChange: (cookies: CookieItem[]) => void
  onPreRequestScriptChange: (script: string) => void
  onPostRequestScriptChange: (script: string) => void
  onAssertionsChange: (assertions: Assertion[]) => void
  disabled?: boolean
}

type TabType = 'params' | 'headers' | 'body' | 'auth' | 'cookies' | 'pre-request' | 'tests' | 'preview'

export default function RequestTabs({
  queryParams,
  headers,
  bodyConfig,
  auth,
  cookies,
  preRequestScript,
  postRequestScript,
  assertions,
  requestPreview,
  assertionResults,
  onQueryParamsChange,
  onHeadersChange,
  onBodyChange,
  onAuthChange,
  onCookiesChange,
  onPreRequestScriptChange,
  onPostRequestScriptChange,
  onAssertionsChange,
  disabled,
}: RequestTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('params')
  const [testsSubTab, setTestsSubTab] = useState<'script' | 'assertions'>('assertions')

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
          className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('tests')}
        >
          Tests
          {assertions.length > 0 && (
            <span className="tab-badge">
              {assertions.filter((a) => a.enabled).length}
            </span>
          )}
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
        {activeTab === 'tests' && (
          <div className="tests-tab">
            <div className="tests-sub-tabs">
              <button
                className={`tests-sub-tab ${testsSubTab === 'assertions' ? 'active' : ''}`}
                onClick={() => setTestsSubTab('assertions')}
              >
                可视化断言
              </button>
              <button
                className={`tests-sub-tab ${testsSubTab === 'script' ? 'active' : ''}`}
                onClick={() => setTestsSubTab('script')}
              >
                测试脚本
              </button>
            </div>
            <div className="tests-tab-content">
              {testsSubTab === 'assertions' && (
                <AssertionEditor
                  assertions={assertions}
                  onChange={onAssertionsChange}
                  disabled={disabled}
                  results={assertionResults}
                />
              )}
              {testsSubTab === 'script' && (
                <div className="script-editor">
                  <textarea
                    value={postRequestScript}
                    onChange={(e) => onPostRequestScriptChange(e.target.value)}
                    placeholder="// 测试脚本示例:
// pm.test('Status code is 200', function () {
//   pm.response.to.have.status(200);
// });
//
// pm.test('Response has user id', function () {
//   var jsonData = pm.response.json();
//   pm.expect(jsonData).to.have.property('id');
//   pm.expect(jsonData.id).to.be.a('number');
// });
//
// pm.test('Response time is less than 500ms', function () {
//   pm.expect(pm.response.responseTime).to.be.below(500);
// });"
                    disabled={disabled}
                    className="script-textarea"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'preview' && (
          <RequestPreview request={requestPreview} />
        )}
      </div>
    </div>
  )
}
