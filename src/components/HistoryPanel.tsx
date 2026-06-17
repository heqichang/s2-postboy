import { useState, useEffect } from 'react'
import type { HistoryItem, HttpRequest } from '../types'
import * as historyStore from '../store/historyStore'
import { getStatusClass } from '../utils'
import { useModal } from './ModalContext'

interface HistoryPanelProps {
  onSelectRequest: (request: HttpRequest) => void
  showSearch?: boolean
}

export default function HistoryPanel({ onSelectRequest, showSearch = true }: HistoryPanelProps) {
  const { showConfirm } = useModal()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')

  useEffect(() => {
    const updateHistory = () => {
      if (searchKeyword.trim()) {
        setHistory(historyStore.searchHistory(searchKeyword.trim()))
      } else {
        setHistory(historyStore.getHistory())
      }
    }
    updateHistory()
    return historyStore.subscribe(updateHistory)
  }, [searchKeyword])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value)
  }

  const handleResend = (item: HistoryItem) => {
    const request = historyStore.resendRequest(item)
    onSelectRequest(request)
  }

  const handleDelete = (id: string) => {
    historyStore.deleteHistoryItem(id)
  }

  const handleClearAll = () => {
    showConfirm({
      title: '清空历史记录',
      message: '确定要清空所有历史记录吗？',
      confirmText: '清空',
      cancelText: '取消',
      onConfirm: () => {
        historyStore.clearHistory()
      },
    })
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const filteredHistory = searchKeyword.trim()
    ? historyStore.searchHistory(searchKeyword.trim())
    : history

  return (
    <div className="history-panel">
      <div className="history-header">
        <span className="history-title">历史记录</span>
        <div className="history-actions">
          {history.length > 0 && (
            <button className="tree-btn" onClick={handleClearAll} title="清空历史">
              🗑️
            </button>
          )}
        </div>
      </div>
      {showSearch && (
        <div className="history-search">
          <input
            type="text"
            className="kv-input"
            placeholder="搜索历史..."
            value={searchKeyword}
            onChange={handleSearch}
          />
        </div>
      )}
      <div className="history-list">
        {filteredHistory.length === 0 ? (
          <div className="history-empty">
            <p>暂无历史记录</p>
            <p className="history-hint">发送请求后将自动保存到这里</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              className="history-item"
              onClick={() => handleResend(item)}
            >
              <div className="history-item-main">
                <span className={`history-method history-method-${item.request.method.toLowerCase()}`}>
                  {item.request.method}
                </span>
                <span className="history-url" title={item.request.url}>
                  {item.request.url}
                </span>
              </div>
              <div className="history-item-meta">
                <span className={`status-value ${getStatusClass(item.statusCode || 0)}`}>
                  {item.statusCode || 'ERROR'}
                </span>
                <span className="history-time">
                  {formatTimestamp(item.timestamp)}
                </span>
                <button
                  className="history-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(item.id)
                  }}
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
