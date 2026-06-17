import { generateId } from '../utils'
import type { Environment, Variable } from '../types'

const ENVIRONMENTS_STORAGE_KEY = 'postboy_environments'
const GLOBAL_VARIABLES_STORAGE_KEY = 'postboy_global_variables'
const ACTIVE_ENV_STORAGE_KEY = 'postboy_active_environment'

let environments: Environment[] = []
let activeEnvironmentId: string | null = null
let globalVariables: Variable[] = []
const listeners = new Set<() => void>()

function loadEnvironments(): void {
  try {
    const storedEnvs = localStorage.getItem(ENVIRONMENTS_STORAGE_KEY)
    if (storedEnvs) {
      environments = JSON.parse(storedEnvs)
    }

    const storedActive = localStorage.getItem(ACTIVE_ENV_STORAGE_KEY)
    if (storedActive) {
      activeEnvironmentId = JSON.parse(storedActive)
    }

    const storedGlobal = localStorage.getItem(GLOBAL_VARIABLES_STORAGE_KEY)
    if (storedGlobal) {
      globalVariables = JSON.parse(storedGlobal)
    }
  } catch {
    environments = []
    activeEnvironmentId = null
    globalVariables = []
  }
}

function saveEnvironments(): void {
  try {
    localStorage.setItem(ENVIRONMENTS_STORAGE_KEY, JSON.stringify(environments))
    localStorage.setItem(ACTIVE_ENV_STORAGE_KEY, JSON.stringify(activeEnvironmentId))
    localStorage.setItem(GLOBAL_VARIABLES_STORAGE_KEY, JSON.stringify(globalVariables))
  } catch {}
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getEnvironments(): Environment[] {
  return environments
}

export function getActiveEnvironmentId(): string | null {
  return activeEnvironmentId
}

export function getActiveEnvironment(): Environment | null {
  if (!activeEnvironmentId) return null
  return environments.find((e) => e.id === activeEnvironmentId) || null
}

export function setActiveEnvironmentId(id: string | null): void {
  activeEnvironmentId = id
  saveEnvironments()
  notifyListeners()
}

export function getGlobalVariables(): Variable[] {
  return globalVariables
}

export function createEnvironment(name: string, variables: Variable[] = []): Environment {
  const now = Date.now()
  const environment: Environment = {
    id: generateId(),
    name,
    variables,
    createdAt: now,
    updatedAt: now,
  }
  environments.push(environment)
  saveEnvironments()
  notifyListeners()
  return environment
}

export function updateEnvironment(id: string, updates: Partial<Environment>): void {
  const environment = environments.find((e) => e.id === id)
  if (environment) {
    Object.assign(environment, updates, { updatedAt: Date.now() })
    saveEnvironments()
    notifyListeners()
  }
}

export function deleteEnvironment(id: string): void {
  const index = environments.findIndex((e) => e.id === id)
  if (index >= 0) {
    environments.splice(index, 1)
    if (activeEnvironmentId === id) {
      activeEnvironmentId = null
    }
    saveEnvironments()
    notifyListeners()
  }
}

export function addEnvironmentVariable(environmentId: string, variable: Variable): void {
  const environment = environments.find((e) => e.id === environmentId)
  if (environment) {
    environment.variables.push(variable)
    environment.updatedAt = Date.now()
    saveEnvironments()
    notifyListeners()
  }
}

export function updateEnvironmentVariable(
  environmentId: string,
  variableId: string,
  updates: Partial<Variable>
): void {
  const environment = environments.find((e) => e.id === environmentId)
  if (environment) {
    const variable = environment.variables.find((v) => v.id === variableId)
    if (variable) {
      Object.assign(variable, updates)
      environment.updatedAt = Date.now()
      saveEnvironments()
      notifyListeners()
    }
  }
}

export function deleteEnvironmentVariable(environmentId: string, variableId: string): void {
  const environment = environments.find((e) => e.id === environmentId)
  if (environment) {
    const index = environment.variables.findIndex((v) => v.id === variableId)
    if (index >= 0) {
      environment.variables.splice(index, 1)
      environment.updatedAt = Date.now()
      saveEnvironments()
      notifyListeners()
    }
  }
}

export function updateGlobalVariables(variables: Variable[]): void {
  globalVariables = variables
  saveEnvironments()
  notifyListeners()
}

export function exportEnvironment(id: string): Environment | null {
  const environment = environments.find((e) => e.id === id)
  return environment ? JSON.parse(JSON.stringify(environment)) : null
}

export function exportAllEnvironments(): Environment[] {
  return JSON.parse(JSON.stringify(environments))
}

export function importEnvironments(newEnvironments: Environment[]): void {
  environments = [...environments, ...newEnvironments]
  saveEnvironments()
  notifyListeners()
}

export function createEmptyVariable(): Variable {
  return {
    id: generateId(),
    key: '',
    value: '',
    enabled: true,
  }
}

loadEnvironments()
