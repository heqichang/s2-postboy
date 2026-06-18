import type { Assertion, AssertionResult, HttpResponse, AssertionType, AssertionOperator } from './types'
import { generateId } from './utils'

function getValueByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined

  const keys = path.split('.').filter((k) => k.length > 0)
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return current
}

function compareValues(actual: unknown, expected: unknown, operator: AssertionOperator): { passed: boolean; actualValue: unknown } {
  const actualValue = actual

  switch (operator) {
    case 'equal':
      return { passed: actual === expected, actualValue }
    case 'notEqual':
      return { passed: actual !== expected, actualValue }
    case 'contains': {
      if (typeof actual === 'string' && typeof expected === 'string') {
        return { passed: actual.toLowerCase().includes(expected.toLowerCase()), actualValue }
      }
      if (Array.isArray(actual)) {
        return { passed: actual.includes(expected), actualValue }
      }
      return { passed: false, actualValue }
    }
    case 'notContains': {
      if (typeof actual === 'string' && typeof expected === 'string') {
        return { passed: !actual.toLowerCase().includes(expected.toLowerCase()), actualValue }
      }
      if (Array.isArray(actual)) {
        return { passed: !actual.includes(expected), actualValue }
      }
      return { passed: true, actualValue }
    }
    case 'lessThan': {
      const numActual = Number(actual)
      const numExpected = Number(expected)
      return { passed: numActual < numExpected, actualValue: numActual }
    }
    case 'greaterThan': {
      const numActual = Number(actual)
      const numExpected = Number(expected)
      return { passed: numActual > numExpected, actualValue: numActual }
    }
    case 'exists':
      return { passed: actual !== undefined && actual !== null, actualValue }
    case 'notExists':
      return { passed: actual === undefined || actual === null, actualValue }
    default:
      return { passed: false, actualValue }
  }
}

function getHeaderValue(headers: Record<string, string | string[]>, headerName: string): string | string[] | undefined {
  const lowerName = headerName.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value
    }
  }
  return undefined
}

function getContentType(headers: Record<string, string | string[]>): string | undefined {
  const ct = getHeaderValue(headers, 'Content-Type')
  if (Array.isArray(ct)) {
    return ct[0]
  }
  return ct
}

export function runAssertion(assertion: Assertion, response: HttpResponse): AssertionResult {
  if (!assertion.enabled) {
    return {
      assertion,
      passed: true,
      error: '断言已禁用',
    }
  }

  try {
    let actual: unknown
    let expected: unknown = assertion.expectedValue

    switch (assertion.type) {
      case 'statusCode': {
        actual = response.statusCode
        expected = Number(expected)
        break
      }
      case 'responseTime': {
        actual = response.time
        expected = Number(expected)
        break
      }
      case 'responseBody': {
        actual = response.body
        break
      }
      case 'jsonValue': {
        let jsonData: unknown
        try {
          jsonData = JSON.parse(response.body)
        } catch {
          return {
            assertion,
            passed: false,
            actualValue: undefined,
            error: '响应不是有效的 JSON',
          }
        }
        actual = getValueByPath(jsonData, assertion.property || '')
        break
      }
      case 'header': {
        actual = getHeaderValue(response.headers, assertion.property || '')
        break
      }
      case 'contentType': {
        actual = getContentType(response.headers) || ''
        break
      }
      case 'jsonSchema': {
        let jsonData: unknown
        let schema: unknown
        try {
          jsonData = JSON.parse(response.body)
        } catch {
          return {
            assertion,
            passed: false,
            actualValue: undefined,
            error: '响应不是有效的 JSON',
          }
        }
        try {
          schema = typeof expected === 'string' ? JSON.parse(expected) : expected
        } catch {
          return {
            assertion,
            passed: false,
            actualValue: undefined,
            error: 'JSON Schema 无效',
          }
        }
        const result = validateJsonSchema(jsonData, schema)
        return {
          assertion,
          passed: result.valid,
          actualValue: jsonData,
          error: result.error,
        }
      }
      default:
        return {
          assertion,
          passed: false,
          error: `未知的断言类型: ${assertion.type}`,
        }
    }

    const result = compareValues(actual, expected, assertion.operator)
    return {
      assertion,
      passed: result.passed,
      actualValue: result.actualValue,
      error: result.passed ? undefined : `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(result.actualValue)}`,
    }
  } catch (e) {
    return {
      assertion,
      passed: false,
      error: (e as Error).message,
    }
  }
}

export function runAssertions(assertions: Assertion[], response: HttpResponse): AssertionResult[] {
  return assertions.map((assertion) => runAssertion(assertion, response))
}

export function createAssertion(type: AssertionType): Assertion {
  let operator: AssertionOperator = 'equal'
  let expectedValue: string | number = ''
  let property = ''

  switch (type) {
    case 'statusCode':
      operator = 'equal'
      expectedValue = 200
      break
    case 'responseTime':
      operator = 'lessThan'
      expectedValue = 500
      break
    case 'responseBody':
      operator = 'contains'
      expectedValue = ''
      break
    case 'jsonValue':
      operator = 'exists'
      property = 'id'
      expectedValue = ''
      break
    case 'header':
      operator = 'exists'
      property = 'Content-Type'
      expectedValue = ''
      break
    case 'contentType':
      operator = 'contains'
      expectedValue = 'application/json'
      break
    case 'jsonSchema':
      operator = 'equal'
      expectedValue = '{}'
      break
  }

  return {
    id: generateId(),
    type,
    operator,
    expectedValue,
    property,
    enabled: true,
  }
}

export function getAssertionTypeLabel(type: AssertionType): string {
  const labels: Record<AssertionType, string> = {
    statusCode: '状态码',
    responseTime: '响应时间',
    responseBody: '响应体',
    jsonValue: 'JSON 值',
    header: '响应头',
    contentType: 'Content-Type',
    jsonSchema: 'JSON Schema',
  }
  return labels[type] || type
}

export function getOperatorLabel(operator: AssertionOperator): string {
  const labels: Record<AssertionOperator, string> = {
    equal: '等于',
    notEqual: '不等于',
    contains: '包含',
    notContains: '不包含',
    lessThan: '小于',
    greaterThan: '大于',
    exists: '存在',
    notExists: '不存在',
  }
  return labels[operator] || operator
}

export function getAvailableOperators(type: AssertionType): AssertionOperator[] {
  switch (type) {
    case 'statusCode':
      return ['equal', 'notEqual', 'contains']
    case 'responseTime':
      return ['lessThan', 'greaterThan', 'equal']
    case 'responseBody':
      return ['contains', 'notContains', 'equal', 'notEqual']
    case 'jsonValue':
      return ['equal', 'notEqual', 'contains', 'notContains', 'exists', 'notExists', 'lessThan', 'greaterThan']
    case 'header':
      return ['exists', 'notExists', 'equal', 'notEqual', 'contains', 'notContains']
    case 'contentType':
      return ['contains', 'notContains', 'equal', 'notEqual']
    case 'jsonSchema':
      return ['equal']
    default:
      return ['equal']
  }
}

export function needsProperty(type: AssertionType): boolean {
  return type === 'jsonValue' || type === 'header'
}

export function needsExpectedValue(_type: AssertionType, operator: AssertionOperator): boolean {
  if (operator === 'exists' || operator === 'notExists') {
    return false
  }
  return true
}

function validateJsonSchema(data: unknown, schema: unknown): { valid: boolean; error?: string } {
  if (!schema || typeof schema !== 'object') {
    return { valid: true }
  }

  const s = schema as Record<string, unknown>

  if (s.type) {
    const type = s.type as string
    const actualType = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data
    if (type !== actualType) {
      return { valid: false, error: `类型不匹配：期望 ${type}，实际 ${actualType}` }
    }
  }

  if (s.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const props = s.properties as Record<string, unknown>
    const obj = data as Record<string, unknown>
    if (s.required) {
      const required = s.required as string[]
      for (const prop of required) {
        if (!(prop in obj)) {
          return { valid: false, error: `缺少必填属性: ${prop}` }
        }
      }
    }
    for (const [key, propSchema] of Object.entries(props)) {
      if (key in obj) {
        const result = validateJsonSchema(obj[key], propSchema)
        if (!result.valid) {
          return { valid: false, error: `${key}: ${result.error}` }
        }
      }
    }
  }

  if (s.items && Array.isArray(data)) {
    for (const item of data) {
      const result = validateJsonSchema(item, s.items)
      if (!result.valid) {
        return { valid: false, error: `数组项: ${result.error}` }
      }
    }
  }

  return { valid: true }
}

export function assertionsToTestScript(assertions: Assertion[]): string {
  const lines: string[] = []

  assertions.forEach((assertion, index) => {
    if (!assertion.enabled) return

    lines.push(`// 断言 ${index + 1}: ${getAssertionTypeLabel(assertion.type)} - ${getOperatorLabel(assertion.operator)}`)
    lines.push(`pm.test("${getAssertionTypeLabel(assertion.type)} ${getOperatorLabel(assertion.operator)} ${assertion.expectedValue || ''}", function () {`)

    switch (assertion.type) {
      case 'statusCode':
        lines.push(`    pm.response.to.have.status(${assertion.expectedValue});`)
        break
      case 'responseTime':
        if (assertion.operator === 'lessThan') {
          lines.push(`    pm.expect(pm.response.responseTime).to.be.below(${assertion.expectedValue});`)
        } else if (assertion.operator === 'greaterThan') {
          lines.push(`    pm.expect(pm.response.responseTime).to.be.above(${assertion.expectedValue});`)
        } else {
          lines.push(`    pm.expect(pm.response.responseTime).to.equal(${assertion.expectedValue});`)
        }
        break
      case 'responseBody':
        if (assertion.operator === 'contains') {
          lines.push(`    pm.expect(pm.response.text()).to.include("${assertion.expectedValue}");`)
        } else if (assertion.operator === 'notContains') {
          lines.push(`    pm.expect(pm.response.text()).to.not.include("${assertion.expectedValue}");`)
        } else if (assertion.operator === 'equal') {
          lines.push(`    pm.expect(pm.response.text()).to.equal("${assertion.expectedValue}");`)
        }
        break
      case 'jsonValue': {
        const path = assertion.property || ''
        const pathParts = path.split('.')
        lines.push(`    var jsonData = pm.response.json();`)
        lines.push(`    var value = jsonData${pathParts.map((p) => `["${p}"]`).join('')};`)
        if (assertion.operator === 'exists') {
          lines.push(`    pm.expect(value).to.exist;`)
        } else if (assertion.operator === 'notExists') {
          lines.push(`    pm.expect(value).to.not.exist;`)
        } else if (assertion.operator === 'equal') {
          lines.push(`    pm.expect(value).to.equal(${JSON.stringify(assertion.expectedValue)});`)
        } else if (assertion.operator === 'contains') {
          lines.push(`    pm.expect(value).to.include("${assertion.expectedValue}");`)
        }
        break
      }
      case 'header': {
        const headerName = assertion.property || ''
        if (assertion.operator === 'exists') {
          lines.push(`    pm.expect(pm.response.headers).to.have.property("${headerName}");`)
        } else if (assertion.operator === 'equal') {
          lines.push(`    pm.expect(pm.response.headers["${headerName}"]).to.equal("${assertion.expectedValue}");`)
        } else if (assertion.operator === 'contains') {
          lines.push(`    pm.expect(pm.response.headers["${headerName}"]).to.include("${assertion.expectedValue}");`)
        }
        break
      }
      case 'contentType':
        if (assertion.operator === 'contains') {
          lines.push(`    pm.expect(pm.response.headers["Content-Type"]).to.include("${assertion.expectedValue}");`)
        } else {
          lines.push(`    pm.expect(pm.response.headers["Content-Type"]).to.equal("${assertion.expectedValue}");`)
        }
        break
    }

    lines.push(`});`)
    lines.push('')
  })

  return lines.join('\n')
}
