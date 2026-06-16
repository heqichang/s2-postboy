import type { KeyValuePair } from '../types'
import { createEmptyPair } from '../utils'

interface KeyValueEditorProps {
  items: KeyValuePair[]
  onChange: (items: KeyValuePair[]) => void
  disabled?: boolean
}

export default function KeyValueEditor({ items, onChange, disabled }: KeyValueEditorProps) {
  const handleAdd = () => {
    onChange([...items, createEmptyPair()])
  }

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const handleChange = (id: string, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  return (
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
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => handleChange(item.id, 'enabled', e.target.checked)}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="kv-input"
                  placeholder="Key"
                  value={item.key}
                  onChange={(e) => handleChange(item.id, 'key', e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="kv-input"
                  placeholder="Value"
                  value={item.value}
                  onChange={(e) => handleChange(item.id, 'value', e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                <button
                  className="delete-row-btn"
                  onClick={() => handleDelete(item.id)}
                  disabled={disabled}
                  title="删除"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#666' }}>
                暂无数据，点击下方按钮添加
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button className="add-row-btn" onClick={handleAdd} disabled={disabled}>
        + 添加一行
      </button>
    </div>
  )
}
