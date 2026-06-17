import type {
  ScriptContext,
  ScriptResult,
  VariableStore,
  TestResult,
  HttpRequest,
  HttpResponse,
} from './types'
import { buildVariableStore, mergeVariableStores } from './variableReplacer'

interface AssertionError extends Error {
  actual?: unknown
  expected?: unknown
}

function createAssertionError(message: string, actual?: unknown, expected?: unknown): AssertionError {
  const error = new Error(message) as AssertionError
  error.actual = actual
  error.expected = expected
  return error
}

function createExpect(value: unknown): ReturnType<ScriptContext['expect']> {
  const chain: ReturnType<ScriptContext['expect']> = {
    to: {
      equal: (expected: unknown) => {
        if (value !== expected) {
          throw createAssertionError(`expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`, value, expected)
        }
      },
      eql: (expected: unknown) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw createAssertionError(`expected ${JSON.stringify(value)} to deeply equal ${JSON.stringify(expected)}`, value, expected)
        }
      },
      be: {
        above: (n: number) => {
          if (typeof value !== 'number' || value <= n) {
            throw createAssertionError(`expected ${value} to be above ${n}`, value, n)
          }
        },
        below: (n: number) => {
          if (typeof value !== 'number' || value >= n) {
            throw createAssertionError(`expected ${value} to be below ${n}`, value, n)
          }
        },
        ok: () => {
          if (!value) {
            throw createAssertionError(`expected ${JSON.stringify(value)} to be truthy`, value, true)
          }
        },
        true: () => {
          if (value !== true) {
            throw createAssertionError(`expected ${JSON.stringify(value)} to be true`, value, true)
          }
        },
        false: () => {
          if (value !== false) {
            throw createAssertionError(`expected ${JSON.stringify(value)} to be false`, value, false)
          }
        },
      },
      include: (expected: unknown) => {
        if (typeof value === 'string') {
          if (!value.includes(String(expected))) {
            throw createAssertionError(`expected "${value}" to include "${expected}"`, value, expected)
          }
        } else if (Array.isArray(value)) {
          if (!value.includes(expected)) {
            throw createAssertionError(`expected array to include ${JSON.stringify(expected)}`, value, expected)
          }
        } else if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, unknown>
          if (typeof expected === 'string' && !(expected in obj)) {
            throw createAssertionError(`expected object to have property "${expected}"`, value, expected)
          }
        }
      },
      have: {
        property: (key: string) => {
          if (typeof value !== 'object' || value === null || !(key in (value as Record<string, unknown>))) {
            throw createAssertionError(`expected object to have property "${key}"`, value, key)
          }
        },
        status: (code: number) => {
          if (value !== code) {
            throw createAssertionError(`expected status code ${value} to equal ${code}`, value, code)
          }
        },
      },
    },
  }
  return chain
}

function createVariableAccessor(
  store: VariableStore,
  scope: keyof VariableStore,
  changes: Record<string, string>
): ScriptContext['environment'] {
  return {
    get: (key: string): string | undefined => {
      return changes[key] !== undefined ? changes[key] : store[scope][key]
    },
    set: (key: string, value: string): void => {
      changes[key] = String(value)
    },
    unset: (key: string): void => {
      changes[key] = ''
      delete store[scope][key]
    },
    clear: (): void => {
      Object.keys(store[scope]).forEach((key) => {
        delete store[scope][key]
      })
      Object.keys(changes).forEach((key) => {
        changes[key] = ''
      })
    },
  }
}

export function createScriptContext(
  initialStore: VariableStore,
  request?: HttpRequest,
  response?: HttpResponse,
  eventName: 'prerequest' | 'test' = 'prerequest'
): { context: ScriptContext; getChanges: () => Partial<VariableStore> } {
  const store: VariableStore = JSON.parse(JSON.stringify(initialStore))
  const envChanges: Record<string, string> = {}
  const globalChanges: Record<string, string> = {}
  const collectionChanges: Record<string, string> = {}
  const localChanges: Record<string, string> = {}
  const tests: TestResult[] = []

  const context: ScriptContext = {
    environment: createVariableAccessor(store, 'environment', envChanges),
    global: createVariableAccessor(store, 'global', globalChanges),
    collectionVariables: createVariableAccessor(store, 'collection', collectionChanges),
    variables: createVariableAccessor(store, 'local', localChanges),
    info: {
      eventName,
    },
    test: (name: string, fn: () => void): void => {
      try {
        fn()
        tests.push({ name, passed: true })
      } catch (e) {
        tests.push({ name, passed: false, error: (e as Error).message })
      }
    },
    expect: createExpect,
    console,
  }

  if (request) {
    context.request = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.filter((h) => h.enabled).map((h) => [h.key, h.value])),
    }
  }

  if (response) {
    context.response = {
      json: (): unknown => {
        try {
          return JSON.parse(response.body)
        } catch {
          return {}
        }
      },
      text: (): string => response.body,
      status: response.statusCode,
      headers: response.headers,
    }
  }

  const getChanges = (): Partial<VariableStore> => {
    return {
      environment: envChanges,
      global: globalChanges,
      collection: collectionChanges,
      local: localChanges,
    }
  }

  return { context, getChanges }
}

export function runScript(
  script: string,
  initialStore: VariableStore,
  request?: HttpRequest,
  response?: HttpResponse,
  eventName: 'prerequest' | 'test' = 'prerequest'
): ScriptResult {
  const tests: TestResult[] = []

  if (!script.trim()) {
    return {
      success: true,
      tests,
      variables: {},
    }
  }

  const { context, getChanges } = createScriptContext(initialStore, request, response, eventName)

  try {
    const wrappedScript = `
      "use strict";
      return (function(pm) {
        ${script}
      })(pm);
    `

    const scriptFn = new Function(wrappedScript)
    scriptFn.call(context, context)

    return {
      success: true,
      tests,
      variables: getChanges(),
    }
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      tests,
      variables: getChanges(),
    }
  }
}

export function runPreRequestScript(
  script: string,
  collectionId?: string | null
): { result: ScriptResult; finalStore: VariableStore } {
  const initialStore = buildVariableStore(collectionId)
  const result = runScript(script, initialStore, undefined, undefined, 'prerequest')

  const finalStore = mergeVariableStores(initialStore, result.variables)

  return { result, finalStore }
}

export function runPostRequestScript(
  script: string,
  request: HttpRequest,
  response: HttpResponse,
  collectionId?: string | null
): { result: ScriptResult; finalStore: VariableStore } {
  const initialStore = buildVariableStore(collectionId)
  const result = runScript(script, initialStore, request, response, 'test')

  const finalStore = mergeVariableStores(initialStore, result.variables)

  return { result, finalStore }
}
