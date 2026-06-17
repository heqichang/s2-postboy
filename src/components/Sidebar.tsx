import { useState } from 'react'
import CollectionTree from './CollectionTree'
import HistoryPanel from './HistoryPanel'
import type { SavedRequest, HttpRequest } from '../types'

interface SidebarProps {
  onSelectRequest: (request: HttpRequest) => void
  onShowSaveDialog: () => void
  onShowImportDialog: () => void
}

type SidebarTab = 'collections' | 'history'

export default function Sidebar({
  onSelectRequest,
  onShowSaveDialog,
  onShowImportDialog,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('collections')

  const handleSelectSavedRequest = (request: SavedRequest) => {
    onSelectRequest(request)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          📁 集合
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          🕐 历史
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === 'collections' && (
          <CollectionTree
            onSelectRequest={handleSelectSavedRequest}
            onShowSaveDialog={onShowSaveDialog}
            onShowImportDialog={onShowImportDialog}
          />
        )}
        {activeTab === 'history' && (
          <HistoryPanel onSelectRequest={onSelectRequest} />
        )}
      </div>
    </div>
  )
}
