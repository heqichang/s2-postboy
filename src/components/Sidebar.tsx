import { useState } from 'react'
import CollectionTree from './CollectionTree'
import HistoryPanel from './HistoryPanel'
import EnvironmentManager from './EnvironmentManager'
import MockPanel from './MockPanel'
import type { SavedRequest, HttpRequest } from '../types'

interface SidebarProps {
  onSelectRequest: (request: HttpRequest) => void
  onShowSaveDialog: () => void
  onShowImportDialog: () => void
  onRunCollection?: (collectionId: string, folderId?: string | null) => void
}

type SidebarTab = 'collections' | 'environments' | 'mock' | 'history'

export default function Sidebar({
  onSelectRequest,
  onShowSaveDialog,
  onShowImportDialog,
  onRunCollection,
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
          className={`sidebar-tab ${activeTab === 'environments' ? 'active' : ''}`}
          onClick={() => setActiveTab('environments')}
        >
          🌍 环境
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'mock' ? 'active' : ''}`}
          onClick={() => setActiveTab('mock')}
        >
          🎭 Mock
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
            onRunCollection={onRunCollection}
          />
        )}
        {activeTab === 'environments' && (
          <EnvironmentManager />
        )}
        {activeTab === 'mock' && (
          <MockPanel />
        )}
        {activeTab === 'history' && (
          <HistoryPanel onSelectRequest={onSelectRequest} />
        )}
      </div>
    </div>
  )
}
