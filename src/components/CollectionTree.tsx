import { useState, useEffect } from 'react'
import type { TreeNode, TreeNodeType, SavedRequest } from '../types'
import * as collectionStore from '../store/collectionStore'
import { useModal } from './ModalContext'
import { exportCollection, downloadFile } from '../utils/importExport'

interface CollectionTreeProps {
  onSelectRequest: (request: SavedRequest) => void
  onShowSaveDialog: () => void
  onShowImportDialog: () => void
}

interface TreeNodeComponentProps {
  node: TreeNode
  level: number
  onSelectRequest: (request: SavedRequest) => void
  expandedNodes: Set<string>
  toggleExpand: (id: string) => void
  editingId: string | null
  editingType: TreeNodeType | null
  editingName: string
  setEditingName: (name: string) => void
  startEditing: (id: string, type: TreeNodeType, name: string) => void
  saveEdit: () => void
  cancelEdit: () => void
  showContextMenu: (e: React.MouseEvent, node: TreeNode) => void
}

function TreeNodeComponent({
  node,
  level,
  onSelectRequest,
  expandedNodes,
  toggleExpand,
  editingId,
  editingType,
  editingName,
  setEditingName,
  startEditing,
  saveEdit,
  cancelEdit,
  showContextMenu,
}: TreeNodeComponentProps) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)
  const isEditing = editingId === node.id

  const getIcon = (type: TreeNodeType) => {
    switch (type) {
      case 'collection':
        return '📁'
      case 'folder':
        return '📂'
      case 'request':
        return '📄'
    }
  }

  const handleClick = () => {
    if (node.type === 'request' && node.data) {
      onSelectRequest(node.data as SavedRequest)
    } else if (hasChildren) {
      toggleExpand(node.id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type !== 'request') return
    startEditing(node.id, node.type, node.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  return (
    <div>
      <div
        className={`tree-node tree-node-${node.type}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => showContextMenu(e, node)}
      >
        {hasChildren ? (
          <span className="tree-expand-icon" onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className="tree-expand-icon-placeholder" />
        )}
        <span className="tree-icon">{getIcon(node.type)}</span>
        {isEditing ? (
          <input
            className="tree-input"
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tree-name">{node.name}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onSelectRequest={onSelectRequest}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              editingId={editingId}
              editingType={editingType}
              editingName={editingName}
              setEditingName={setEditingName}
              startEditing={startEditing}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              showContextMenu={showContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CollectionTree({
  onSelectRequest,
  onShowSaveDialog,
  onShowImportDialog,
}: CollectionTreeProps) {
  const { showAlert, showConfirm, showPrompt } = useModal()
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingType, setEditingType] = useState<TreeNodeType | null>(null)
  const [editingName, setEditingName] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    node: TreeNode
  } | null>(null)

  useEffect(() => {
    const updateTree = () => {
      setTreeNodes(collectionStore.getTreeNodes())
    }
    updateTree()
    return collectionStore.subscribe(updateTree)
  }, [])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const startEditing = (id: string, type: TreeNodeType, name: string) => {
    setEditingId(id)
    setEditingType(type)
    setEditingName(name)
    setContextMenu(null)
  }

  const saveEdit = () => {
    if (!editingId || !editingType || !editingName.trim()) {
      cancelEdit()
      return
    }

    const location = collectionStore.findRequestLocation(editingId)

    if (editingType === 'collection') {
      collectionStore.renameCollection(editingId, editingName.trim())
    } else if (editingType === 'folder' && location) {
      collectionStore.renameFolder(location.collectionId, editingId, editingName.trim())
    } else if (editingType === 'request' && location) {
      collectionStore.updateRequest(location.collectionId, editingId, { name: editingName.trim() })
    }

    cancelEdit()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingType(null)
    setEditingName('')
  }

  const showContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const handleCreateCollection = () => {
    showPrompt({
      title: '新建集合',
      message: '输入集合名称:',
      defaultValue: '新建集合',
      onConfirm: (name) => {
        if (name.trim()) {
          const collection = collectionStore.createCollection(name.trim())
          setExpandedNodes((prev) => new Set([...prev, collection.id]))
        }
      },
    })
    setContextMenu(null)
  }

  const handleCreateFolder = () => {
    if (!contextMenu) return
    const node = contextMenu.node

    let collectionId: string
    let parentFolderId: string | null = null

    if (node.type === 'collection') {
      collectionId = node.id
    } else if (node.type === 'folder') {
      const location = collectionStore.findRequestLocation(node.id)
      if (!location) return
      collectionId = location.collectionId
      parentFolderId = node.id
    } else {
      return
    }

    showPrompt({
      title: '新建文件夹',
      message: '输入文件夹名称:',
      defaultValue: '新建文件夹',
      onConfirm: (name) => {
        if (name.trim()) {
          const folder = collectionStore.createFolder(collectionId, parentFolderId, name.trim())
          if (folder) {
            setExpandedNodes((prev) => new Set([...prev, node.id, folder.id]))
          }
        }
      },
    })
    setContextMenu(null)
  }

  const handleDelete = () => {
    if (!contextMenu) return
    const node = contextMenu.node

    showConfirm({
      title: '确认删除',
      message: `确定要删除 "${node.name}" 吗？`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: () => {
        const location = collectionStore.findRequestLocation(node.id)

        if (node.type === 'collection') {
          collectionStore.deleteCollection(node.id)
        } else if (node.type === 'folder' && location) {
          collectionStore.deleteFolder(location.collectionId, node.id)
        } else if (node.type === 'request' && location) {
          collectionStore.deleteRequest(location.collectionId, location.folderId, node.id)
        }
      },
    })
    setContextMenu(null)
  }

  const handleExport = () => {
    if (!contextMenu) return
    const node = contextMenu.node

    if (node.type !== 'collection') {
      setContextMenu(null)
      return
    }

    showPrompt({
      title: '导出集合',
      message: '输入导出格式 (postman/json):',
      defaultValue: 'json',
      placeholder: 'postman 或 json',
      onConfirm: (format) => {
        const fmt = format.toLowerCase().trim() as 'postman' | 'json'
        if (fmt === 'postman' || fmt === 'json') {
          const collection = collectionStore.exportCollection(node.id)
          if (collection) {
            const content = exportCollection(collection, fmt)
            const ext = fmt === 'postman' ? 'postman_collection.json' : 'json'
            downloadFile(content, `${node.name}.${ext}`)
          }
        }
      },
    })
    setContextMenu(null)
  }

  const handleCopyRequest = () => {
    if (!contextMenu || contextMenu.node.type !== 'request') return
    const request = contextMenu.node.data as SavedRequest
    const location = collectionStore.findRequestLocation(request.id)
    if (!location) return

    const collections = collectionStore.getCollections()
    if (collections.length === 0) {
      showAlert({ message: '请先创建集合' })
      setContextMenu(null)
      return
    }

    showPrompt({
      title: '复制请求',
      message: '输入目标集合ID:',
      defaultValue: collections[0].id,
      placeholder: '集合ID',
      onConfirm: (targetCollectionId) => {
        if (targetCollectionId.trim()) {
          collectionStore.copyRequest(
            location.collectionId,
            request.id,
            targetCollectionId.trim(),
            null
          )
        }
      },
    })
    setContextMenu(null)
  }

  return (
    <div className="collection-tree">
      <div className="tree-header">
        <span className="tree-title">集合</span>
        <div className="tree-actions">
          <button className="tree-btn" onClick={handleCreateCollection} title="新建集合">
            ➕
          </button>
          <button className="tree-btn" onClick={onShowImportDialog} title="导入">
            📥
          </button>
          <button className="tree-btn" onClick={onShowSaveDialog} title="保存当前请求">
            💾
          </button>
        </div>
      </div>
      <div className="tree-content">
        {treeNodes.length === 0 ? (
          <div className="tree-empty">
            <p>暂无集合</p>
            <button className="tree-btn-primary" onClick={handleCreateCollection}>
              创建集合
            </button>
          </div>
        ) : (
          treeNodes.map((node) => (
            <TreeNodeComponent
              key={node.id}
              node={node}
              level={0}
              onSelectRequest={onSelectRequest}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              editingId={editingId}
              editingType={editingType}
              editingName={editingName}
              setEditingName={setEditingName}
              startEditing={startEditing}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              showContextMenu={showContextMenu}
            />
          ))
        )}
      </div>
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === 'collection' && (
            <>
              <div className="context-menu-item" onClick={handleCreateFolder}>
                📂 新建文件夹
              </div>
              <div className="context-menu-item" onClick={handleCreateCollection}>
                📁 新建集合
              </div>
              <div className="context-menu-item" onClick={() => startEditing(contextMenu.node.id, contextMenu.node.type, contextMenu.node.name)}>
                ✏️ 重命名
              </div>
              <div className="context-menu-item" onClick={handleExport}>
                📤 导出
              </div>
              <div className="context-menu-item context-menu-danger" onClick={handleDelete}>
                🗑️ 删除
              </div>
            </>
          )}
          {contextMenu.node.type === 'folder' && (
            <>
              <div className="context-menu-item" onClick={handleCreateFolder}>
                📂 新建子文件夹
              </div>
              <div className="context-menu-item" onClick={() => startEditing(contextMenu.node.id, contextMenu.node.type, contextMenu.node.name)}>
                ✏️ 重命名
              </div>
              <div className="context-menu-item context-menu-danger" onClick={handleDelete}>
                🗑️ 删除
              </div>
            </>
          )}
          {contextMenu.node.type === 'request' && (
            <>
              <div className="context-menu-item" onClick={() => startEditing(contextMenu.node.id, contextMenu.node.type, contextMenu.node.name)}>
                ✏️ 重命名
              </div>
              <div className="context-menu-item" onClick={handleCopyRequest}>
                📋 复制
              </div>
              <div className="context-menu-item context-menu-danger" onClick={handleDelete}>
                🗑️ 删除
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
