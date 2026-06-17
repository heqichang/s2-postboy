import type { AuthConfig, AuthType, ApiKeyIn } from '../types'

interface AuthEditorProps {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
  disabled?: boolean
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'no-auth', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
]

export default function AuthEditor({ auth, onChange, disabled }: AuthEditorProps) {
  const handleTypeChange = (type: AuthType) => {
    const newAuth: AuthConfig = { type }
    switch (type) {
      case 'basic':
        newAuth.basic = auth.basic || { username: '', password: '' }
        break
      case 'bearer':
        newAuth.bearer = auth.bearer || { token: '' }
        break
      case 'api-key':
        newAuth.apiKey = auth.apiKey || { key: '', value: '', in: 'header' }
        break
      case 'oauth2':
        newAuth.oauth2 = auth.oauth2 || { token: '' }
        break
    }
    onChange(newAuth)
  }

  return (
    <div className="auth-editor">
      <div className="auth-type-selector">
        <select
          className="auth-type-select"
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value as AuthType)}
          disabled={disabled}
        >
          {AUTH_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="auth-editor-content">
        {auth.type === 'no-auth' && (
          <div className="empty-state">
            <div className="empty-state-text">此请求不使用认证</div>
          </div>
        )}

        {auth.type === 'basic' && auth.basic && (
          <div className="auth-fields">
            <div className="auth-field">
              <label className="auth-label">用户名</label>
              <input
                type="text"
                className="auth-input"
                placeholder="输入用户名"
                value={auth.basic.username}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    basic: { ...auth.basic!, username: e.target.value },
                  })
                }
                disabled={disabled}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">密码</label>
              <input
                type="password"
                className="auth-input"
                placeholder="输入密码"
                value={auth.basic.password}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    basic: { ...auth.basic!, password: e.target.value },
                  })
                }
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {auth.type === 'bearer' && auth.bearer && (
          <div className="auth-fields">
            <div className="auth-field">
              <label className="auth-label">Token</label>
              <input
                type="text"
                className="auth-input"
                placeholder="输入 Bearer Token"
                value={auth.bearer.token}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    bearer: { ...auth.bearer!, token: e.target.value },
                  })
                }
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {auth.type === 'api-key' && auth.apiKey && (
          <div className="auth-fields">
            <div className="auth-field">
              <label className="auth-label">添加位置</label>
              <select
                className="auth-input"
                value={auth.apiKey.in}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    apiKey: { ...auth.apiKey!, in: e.target.value as ApiKeyIn },
                  })
                }
                disabled={disabled}
              >
                <option value="header">Header</option>
                <option value="query">Query Params</option>
              </select>
            </div>
            <div className="auth-field">
              <label className="auth-label">Key</label>
              <input
                type="text"
                className="auth-input"
                placeholder="输入参数名"
                value={auth.apiKey.key}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    apiKey: { ...auth.apiKey!, key: e.target.value },
                  })
                }
                disabled={disabled}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Value</label>
              <input
                type="text"
                className="auth-input"
                placeholder="输入参数值"
                value={auth.apiKey.value}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    apiKey: { ...auth.apiKey!, value: e.target.value },
                  })
                }
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && auth.oauth2 && (
          <div className="auth-fields">
            <div className="auth-field">
              <label className="auth-label">Access Token</label>
              <input
                type="text"
                className="auth-input"
                placeholder="输入 OAuth 2.0 Access Token"
                value={auth.oauth2.token}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    oauth2: { ...auth.oauth2!, token: e.target.value },
                  })
                }
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
