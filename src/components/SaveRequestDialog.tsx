import { useState, useEffect } from 'react'
import type { HttpRequest, Collection, Folder } from '../types'
import * as collectionStore from '../store/collectionStore'
import { useModal } from './ModalContext'

interface SaveRequestDialogProps {
  request: HttpRequest
  onClose: () => void
  onSaved: () => void
}

export default function SaveRequestDialog({
  request,
  onClose,
  onSaved,
}: SaveRequestDialogProps) {
  const { showAlert, showPrompt } = useModal()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])

  useEffect(() => {
    setCollections(collectionStore.getCollections())
    if (collections.length > 0 && !collectionId) {
      setCollectionId(collections[0].id)
    }
    setName(request.url || '未命名请求')
  }, [])

  const getFoldersForCollection = (collId: string | null): Folder[] => {
    if (!collId) return []
    const collection = collections.find((c) => c.id === collId)
    if (!collection) return []

    const folders: Folder[] = []
    const addFolder = (folder: Folder, prefix: string = '') => {
      folders.push({ ...folder, name: prefix + folder.name })
      folder.folders.forEach((f) => addFolder(f, prefix + '  '))
    }
    collection.folders.forEach((f) => addFolder(f))
    return folders
  }

  const handleSave = () => {
    if (!name.trim()) {
      showAlert({ message: '请输入请求名称' })
      return
    }
    if (!collectionId) {
      showAlert({ message: '请选择集合' })
      return
    }

    const result = collectionStore.saveRequest(
      request,
      name.trim(),
      description.trim(),
      collectionId,
      folderId
    )

    if (result) {
      onSaved()
      onClose()
    } else {
      showAlert({ message: '保存失败' })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>保存请求</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>请求名称 *</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入请求名称"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>描述</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入请求描述（可选）"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>保存到集合 *</label>
            <select
              className="form-select"
              value={collectionId || ''}
              onChange={(e) => {
                setCollectionId(e.target.value || null)
                setFolderId(null)
              }}
            >
              <option value="">-- 请选择集合 --</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {collectionId && (
            <div className="form-group">
              <label>保存到文件夹（可选）</label>
              <select
                className="form-select"
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
              >
                <option value="">-- 根目录 --</option>
                {getFoldersForCollection(collectionId).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {collections.length === 0 && (
            <div className="form-hint">
              还没有集合，
              <button
                className="link-btn"
                onClick={() => {
                  showPrompt({
                    title: '新建集合',
                    message: '输入集合名称:',
                    defaultValue: '新建集合',
                    onConfirm: (name) => {
                      if (name.trim()) {
                        const collection = collectionStore.createCollection(name.trim())
                        setCollections(collectionStore.getCollections())
                        setCollectionId(collection.id)
                      }
                    },
                  })
                }}
              >
                创建一个集合
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
