import { useState, useEffect, useRef } from 'react'
import * as environmentStore from '../store/environmentStore'

export default function EnvironmentSelector() {
  const [, forceUpdate] = useState({})
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = environmentStore.subscribe(() => forceUpdate({}))
    return unsub
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const environments = environmentStore.getEnvironments()
  const activeEnvId = environmentStore.getActiveEnvironmentId()
  const activeEnv = activeEnvId ? environments.find((e) => e.id === activeEnvId) : null

  const handleSelectEnvironment = (envId: string | null) => {
    environmentStore.setActiveEnvironmentId(envId)
    setShowDropdown(false)
  }

  return (
    <div className="environment-selector" ref={dropdownRef}>
      <button
        className="env-selector-btn"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="env-icon">🌍</span>
        <span className="env-selector-text">
          {activeEnv ? activeEnv.name : 'No Environment'}
        </span>
        <span className="env-selector-arrow">{showDropdown ? '▲' : '▼'}</span>
      </button>
      {showDropdown && (
        <div className="env-dropdown">
          <div
            className={`env-dropdown-item ${!activeEnvId ? 'active' : ''}`}
            onClick={() => handleSelectEnvironment(null)}
          >
            <span className="env-checkbox">
              {!activeEnvId ? '●' : '○'}
            </span>
            <span>No Environment</span>
          </div>
          <div className="env-dropdown-divider" />
          {environments.length === 0 && (
            <div className="env-dropdown-empty">
              暂无环境，请在侧边栏"环境"标签页中创建
            </div>
          )}
          {environments.map((env) => (
            <div
              key={env.id}
              className={`env-dropdown-item ${activeEnvId === env.id ? 'active' : ''}`}
              onClick={() => handleSelectEnvironment(env.id)}
            >
              <span className="env-checkbox">
                {activeEnvId === env.id ? '●' : '○'}
              </span>
              <span>{env.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
