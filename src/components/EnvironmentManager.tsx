import { useState, useEffect } from 'react'
import type { Environment, Variable } from '../types'
import * as environmentStore from '../store/environmentStore'
import * as collectionStore from '../store/collectionStore'
import { createEmptyVariable } from '../store/environmentStore'
import KeyValueEditor from './KeyValueEditor'
import { useModal } from './ModalContext'

type TabType = 'environments' | 'globals' | 'collection-variables'

export default function EnvironmentManager() {
  const { showAlert, showConfirm } = useModal()
  const [activeTab, setActiveTab] = useState<TabType>('environments')
  const [, forceUpdate] = useState({})
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null)
  const [editingName, setEditingName] = useState('')
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    collectionStore.getActiveCollectionId()
  )

  useEffect(() => {
    const unsubEnv = environmentStore.subscribe(() => forceUpdate({}))
    const unsubCol = collectionStore.subscribe(() => {
      setActiveCollectionId(collectionStore.getActiveCollectionId())
      forceUpdate({})
    })
    return () => {
      unsubEnv()
      unsubCol()
    }
  }, [])

  const environments = environmentStore.getEnvironments()
  const globalVariables = environmentStore.getGlobalVariables()
  const activeEnvId = environmentStore.getActiveEnvironmentId()
  const collectionVariables = activeCollectionId
    ? collectionStore.getCollectionVariables(activeCollectionId)
    : []

  const handleCreateEnvironment = () => {
    const env = environmentStore.createEnvironment('New Environment', [createEmptyVariable()])
    setEditingEnvironment(env)
    setEditingName(env.name)
  }

  const handleEditEnvironment = (env: Environment) => {
    setEditingEnvironment(env)
    setEditingName(env.name)
  }

  const handleSaveEnvironment = () => {
    if (!editingEnvironment) return
    if (!editingName.trim()) {
      showAlert({ message: '环境名称不能为空' })
      return
    }
    environmentStore.updateEnvironment(editingEnvironment.id, { name: editingName.trim() })
    setEditingEnvironment(null)
    setEditingName('')
  }

  const handleDeleteEnvironment = async (envId: string) => {
    const confirmed = await showConfirm({
      message: '确定要删除这个环境吗？',
    })
    if (confirmed) {
      environmentStore.deleteEnvironment(envId)
      if (editingEnvironment?.id === envId) {
        setEditingEnvironment(null)
        setEditingName('')
      }
    }
  }

  const handleSetActiveEnvironment = (envId: string | null) => {
    environmentStore.setActiveEnvironmentId(envId)
  }

  const handleAddVariable = () => {
    if (!editingEnvironment) return
    const newVar = createEmptyVariable()
    environmentStore.addEnvironmentVariable(editingEnvironment.id, newVar)
    setEditingEnvironment({
      ...editingEnvironment,
      variables: [...editingEnvironment.variables, newVar],
    })
  }

  const handleUpdateVariable = (variables: Variable[]) => {
    if (!editingEnvironment) return
    environmentStore.updateEnvironment(editingEnvironment.id, { variables })
    setEditingEnvironment({ ...editingEnvironment, variables })
  }

  const handleUpdateGlobalVariables = (variables: Variable[]) => {
    environmentStore.updateGlobalVariables(variables)
  }

  const handleUpdateCollectionVariables = (variables: Variable[]) => {
    if (!activeCollectionId) return
    collectionStore.updateCollectionVariables(activeCollectionId, variables)
  }

  const handleAddGlobalVariable = () => {
    const newVar = createEmptyVariable()
    environmentStore.updateGlobalVariables([...globalVariables, newVar])
  }

  const handleAddCollectionVariable = () => {
    if (!activeCollectionId) return
    const newVar = createEmptyVariable()
    collectionStore.updateCollectionVariables(activeCollectionId, [
      ...collectionVariables,
      newVar,
    ])
  }

  const handleExportEnvironment = (env: Environment) => {
    const exportData = JSON.stringify(env, null, 2)
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${env.name}.postboy_environment.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportEnvironment = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text) as Environment
        if (data.name && Array.isArray(data.variables)) {
          environmentStore.createEnvironment(data.name, data.variables)
          showAlert({ message: '环境导入成功' })
        } else {
          showAlert({ message: '无效的环境文件格式' })
        }
      } catch {
        showAlert({ message: '导入失败，请检查文件格式' })
      }
    }
    input.click()
  }

  const handleExportAll = () => {
    const allData = {
      environments,
      globalVariables,
    }
    const exportData = JSON.stringify(allData, null, 2)
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'postboy_environments.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="environment-manager">
      <div className="env-tabs">
        <button
          className={`env-tab ${activeTab === 'environments' ? 'active' : ''}`}
          onClick={() => setActiveTab('environments')}
        >
          Environments
        </button>
        <button
          className={`env-tab ${activeTab === 'globals' ? 'active' : ''}`}
          onClick={() => setActiveTab('globals')}
        >
          Globals
        </button>
        <button
          className={`env-tab ${activeTab === 'collection-variables' ? 'active' : ''}`}
          onClick={() => setActiveTab('collection-variables')}
        >
          Collection
        </button>
      </div>

      {activeTab === 'environments' && (
        <div className="env-content">
          <div className="env-actions">
            <button className="btn btn-primary" onClick={handleCreateEnvironment}>
              + Add
            </button>
            <button className="btn" onClick={handleImportEnvironment}>
              Import
            </button>
            <button className="btn" onClick={handleExportAll}>
              Export All
            </button>
          </div>

          <div className="env-list">
            {environments.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🌍</div>
                <div className="empty-state-text">暂无环境，点击上方按钮创建</div>
              </div>
            )}
            {environments.map((env) => (
              <div
                key={env.id}
                className={`env-item ${activeEnvId === env.id ? 'active' : ''} ${
                  editingEnvironment?.id === env.id ? 'editing' : ''
                }`}
              >
                <div className="env-item-header">
                  <div
                    className="env-name"
                    onClick={() => handleSetActiveEnvironment(activeEnvId === env.id ? null : env.id)}
                  >
                    <span className="env-checkbox">
                      {activeEnvId === env.id ? '●' : '○'}
                    </span>
                    {editingEnvironment?.id === env.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span>{env.name}</span>
                    )}
                  </div>
                  <div className="env-item-actions">
                    {editingEnvironment?.id === env.id ? (
                      <>
                        <button
                          className="btn-icon"
                          onClick={handleSaveEnvironment}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => setEditingEnvironment(null)}
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-icon"
                          onClick={() => handleEditEnvironment(env)}
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleExportEnvironment(env)}
                          title="Export"
                        >
                          ↓
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteEnvironment(env.id)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingEnvironment?.id === env.id && (
                  <div className="env-variables">
                    <KeyValueEditor
                      items={editingEnvironment.variables}
                      onChange={handleUpdateVariable}
                    />
                    <button className="btn btn-small" onClick={handleAddVariable}>
                      + Add Variable
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'globals' && (
        <div className="env-content">
          <div className="env-description">
            全局变量在所有环境中共享
          </div>
          <KeyValueEditor
            items={globalVariables}
            onChange={handleUpdateGlobalVariables}
          />
          <button className="btn btn-small" onClick={handleAddGlobalVariable}>
            + Add Variable
          </button>
        </div>
      )}

      {activeTab === 'collection-variables' && (
        <div className="env-content">
          {!activeCollectionId ? (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <div className="empty-state-text">请先选择一个集合</div>
            </div>
          ) : (
            <>
              <div className="env-description">
                集合变量仅在当前集合中生效
              </div>
              <KeyValueEditor
                items={collectionVariables}
                onChange={handleUpdateCollectionVariables}
              />
              <button className="btn btn-small" onClick={handleAddCollectionVariable}>
                + Add Variable
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
