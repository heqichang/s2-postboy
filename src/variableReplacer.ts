import type { VariableStore, Variable, VariableScope } from './types'
import * as environmentStore from './store/environmentStore'
import * as collectionStore from './store/collectionStore'

const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g

export interface ReplaceResult {
  value: string
  missingVariables: string[]
}

export function variablesToRecord(variables: Variable[]): Record<string, string> {
  const result: Record<string, string> = {}
  variables.forEach((v) => {
    if (v.enabled && v.key.trim()) {
      result[v.key] = v.value
    }
  })
  return result
}

export function buildVariableStore(
  collectionId?: string | null,
  dataVariables?: Record<string, string>,
  localVariables?: Record<string, string>
): VariableStore {
  const globalVars = variablesToRecord(environmentStore.getGlobalVariables())

  const activeEnv = environmentStore.getActiveEnvironment()
  const envVars = activeEnv ? variablesToRecord(activeEnv.variables) : {}

  let collectionVars: Record<string, string> = {}
  if (collectionId) {
    const collections = collectionStore.getCollections()
    const collection = collections.find((c) => c.id === collectionId)
    if (collection && collection.variables) {
      collectionVars = variablesToRecord(collection.variables)
    }
  }

  return {
    global: globalVars,
    environment: envVars,
    collection: collectionVars,
    data: dataVariables || {},
    local: localVariables || {},
  }
}

export function getVariableValue(
  store: VariableStore,
  key: string
): { value: string | undefined; scope: VariableScope | null } {
  const scopeOrder: VariableScope[] = ['local', 'data', 'collection', 'environment', 'global']

  for (const scope of scopeOrder) {
    if (store[scope][key] !== undefined) {
      return { value: store[scope][key], scope }
    }
  }

  return { value: undefined, scope: null }
}

export function replaceVariables(
  template: string,
  store: VariableStore
): ReplaceResult {
  const missingVariables: string[] = []

  const value = template.replace(VARIABLE_PATTERN, (match, varName) => {
    const trimmedName = varName.trim()
    const { value } = getVariableValue(store, trimmedName)

    if (value === undefined) {
      missingVariables.push(trimmedName)
      return match
    }

    return value
  })

  return { value, missingVariables }
}

export function replaceVariablesInObject<T>(
  obj: T,
  store: VariableStore
): { result: T; missingVariables: string[] } {
  const allMissing: string[] = []

  function replacer(value: unknown): unknown {
    if (typeof value === 'string') {
      const { value: replaced, missingVariables } = replaceVariables(value, store)
      allMissing.push(...missingVariables)
      return replaced
    }
    if (Array.isArray(value)) {
      return value.map(replacer)
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const k in value as Record<string, unknown>) {
        result[k] = replacer((value as Record<string, unknown>)[k])
      }
      return result
    }
    return value
  }

  const result = replacer(obj) as T
  const uniqueMissing = [...new Set(allMissing)]

  return { result, missingVariables: uniqueMissing }
}

export function buildVariableStoreFromScopes(
  scopes: Partial<VariableStore>
): VariableStore {
  return {
    global: scopes.global || {},
    environment: scopes.environment || {},
    collection: scopes.collection || {},
    data: scopes.data || {},
    local: scopes.local || {},
  }
}

export function mergeVariableStores(
  base: VariableStore,
  overrides: Partial<VariableStore>
): VariableStore {
  return {
    global: { ...base.global, ...(overrides.global || {}) },
    environment: { ...base.environment, ...(overrides.environment || {}) },
    collection: { ...base.collection, ...(overrides.collection || {}) },
    data: { ...base.data, ...(overrides.data || {}) },
    local: { ...base.local, ...(overrides.local || {}) },
  }
}

export function getAllResolvedVariables(
  store: VariableStore
): Record<string, string> {
  return {
    ...store.global,
    ...store.environment,
    ...store.collection,
    ...store.data,
    ...store.local,
  }
}

export function extractVariableNames(template: string): string[] {
  const matches = template.match(VARIABLE_PATTERN)
  if (!matches) return []

  const names = matches.map((match) => {
    const name = match.slice(2, -2).trim()
    return name
  })

  return [...new Set(names)]
}

export function hasVariables(template: string): boolean {
  return VARIABLE_PATTERN.test(template)
}
