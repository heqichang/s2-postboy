import type { CookieItem } from '../types'
import { createEmptyCookie } from '../utils'

interface CookieEditorProps {
  cookies: CookieItem[]
  onChange: (cookies: CookieItem[]) => void
  disabled?: boolean
}

export default function CookieEditor({ cookies, onChange, disabled }: CookieEditorProps) {
  const handleAdd = () => {
    onChange([...cookies, createEmptyCookie()])
  }

  const handleDelete = (id: string) => {
    onChange(cookies.filter((c) => c.id !== id))
  }

  const handleChange = (id: string, field: Partial<CookieItem>) => {
    onChange(
      cookies.map((c) => (c.id === id ? { ...c, ...field } : c))
    )
  }

  return (
    <div className="cookie-editor">
      <table className="kv-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Name</th>
            <th>Value</th>
            <th>Domain</th>
            <th>Path</th>
            <th style={{ width: 80 }}>HttpOnly</th>
            <th style={{ width: 80 }}>Secure</th>
            <th style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((cookie) => (
            <tr key={cookie.id}>
              <td>
                <input
                  type="checkbox"
                  checked={cookie.enabled}
                  onChange={(e) => handleChange(cookie.id, { enabled: e.target.checked })}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="kv-input"
                  placeholder="Name"
                  value={cookie.name}
                  onChange={(e) => handleChange(cookie.id, { name: e.target.value })}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="kv-input"
                  placeholder="Value"
                  value={cookie.value}
                  onChange={(e) => handleChange(cookie.id, { value: e.target.value })}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="kv-input"
                  placeholder="Domain (e.g. example.com)"
                  value={cookie.domain}
                  onChange={(e) => handleChange(cookie.id, { domain: e.target.value })}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="kv-input"
                  placeholder="Path"
                  value={cookie.path}
                  onChange={(e) => handleChange(cookie.id, { path: e.target.value })}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={cookie.httpOnly}
                  onChange={(e) => handleChange(cookie.id, { httpOnly: e.target.checked })}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={cookie.secure}
                  onChange={(e) => handleChange(cookie.id, { secure: e.target.checked })}
                  disabled={disabled}
                />
              </td>
              <td>
                <button
                  className="delete-row-btn"
                  onClick={() => handleDelete(cookie.id)}
                  disabled={disabled}
                  title="删除"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
          {cookies.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#666' }}>
                暂无 Cookie，点击下方按钮添加
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button className="add-row-btn" onClick={handleAdd} disabled={disabled}>
        + 添加 Cookie
      </button>
    </div>
  )
}
