import type {
  RunConfig,
  RequestRunResult,
  CollectionRunResult,
  SavedRequest,
  HttpRequest,
  HttpResponse,
  Folder,
  Collection,
  AssertionResult,
} from './types'
import { sendRequest } from './requestService'
import { runPostRequestScript, runPreRequestScript } from './scriptRunner'
import { runAssertions } from './assertionEngine'
import { buildVariableStore, replaceVariablesInObject } from './variableReplacer'
import * as collectionStore from './store/collectionStore'
import * as environmentStore from './store/environmentStore'
import { generateId } from './utils'

function getAllRequestsInCollection(collection: Collection, folderId?: string | null): SavedRequest[] {
  const requests: SavedRequest[] = []

  function collectFromFolder(folder: Folder): void {
    requests.push(...folder.requests)
    folder.folders.forEach(collectFromFolder)
  }

  if (folderId) {
    const folder = collectionStore.findFolder(collection.id, folderId)
    if (folder) {
      collectFromFolder(folder)
    }
  } else {
    requests.push(...collection.requests)
    collection.folders.forEach(collectFromFolder)
  }

  return requests
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseCsv(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^['"]|['"]$/g, ''))
  const data: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return data
}

export function parseJsonData(jsonContent: string): Record<string, string>[] {
  try {
    const data = JSON.parse(jsonContent)
    if (Array.isArray(data)) {
      return data.map((item) => {
        const result: Record<string, string> = {}
        for (const [key, value] of Object.entries(item)) {
          result[key] = String(value)
        }
        return result
      })
    }
    return []
  } catch {
    return []
  }
}

export async function runSingleRequest(
  request: HttpRequest,
  collectionId?: string | null,
  dataVariables?: Record<string, string>
): Promise<{ response?: HttpResponse; error?: string; testResults: { name: string; passed: boolean; error?: string }[]; assertionResults: AssertionResult[]; allPassed: boolean }> {
  const testResults: { name: string; passed: boolean; error?: string }[] = []
  const assertionResults: AssertionResult[] = []

  try {
    let variableStore = buildVariableStore(collectionId, dataVariables)

    if (request.preRequestScript) {
      const { result: preResult, finalStore } = runPreRequestScript(request.preRequestScript, collectionId)
      variableStore = finalStore

      if (!preResult.success) {
        return {
          error: `预请求脚本执行失败: ${preResult.error}`,
          testResults: preResult.tests,
          assertionResults,
          allPassed: false,
        }
      }
    }

    const { result: processedRequest } = replaceVariablesInObject(request, variableStore)

    const response = await sendRequest(processedRequest)

    if (request.postRequestScript) {
      const { result: postResult } = runPostRequestScript(
        request.postRequestScript,
        processedRequest,
        response,
        collectionId
      )
      testResults.push(...postResult.tests)
    }

    if (request.assertions && request.assertions.length > 0) {
      const results = runAssertions(request.assertions, response)
      assertionResults.push(...results)
    }

    const allTestsPassed = testResults.every((t) => t.passed)
    const allAssertionsPassed = assertionResults.every((a) => a.passed)

    return {
      response,
      testResults,
      assertionResults,
      allPassed: allTestsPassed && allAssertionsPassed,
    }
  } catch (e) {
    return {
      error: (e as Error).message,
      testResults,
      assertionResults,
      allPassed: false,
    }
  }
}

export interface RunProgress {
  currentIndex: number
  totalRequests: number
  currentRequest: string
  iteration: number
  totalIterations: number
}

export type ProgressCallback = (progress: RunProgress) => void

export async function runCollection(
  config: RunConfig,
  onProgress?: ProgressCallback,
  shouldStop?: () => boolean
): Promise<CollectionRunResult> {
  const collection = collectionStore.getCollections().find((c) => c.id === config.collectionId)
  if (!collection) {
    throw new Error('集合不存在')
  }

  if (config.environmentId) {
    environmentStore.setActiveEnvironmentId(config.environmentId)
  }

  const requests = getAllRequestsInCollection(collection, config.folderId)
  const totalRequests = requests.length * config.iterations

  const results: RequestRunResult[] = []
  const startTime = Date.now()

  let passedRequests = 0
  let failedRequests = 0
  let totalTests = 0
  let passedTests = 0
  let failedTests = 0
  let totalAssertions = 0
  let passedAssertions = 0
  let failedAssertions = 0
  let totalResponseTime = 0

  for (let iteration = 0; iteration < config.iterations; iteration++) {
    const dataRow = config.dataFile?.data[iteration % config.dataFile.data.length]

    for (let i = 0; i < requests.length; i++) {
      if (shouldStop?.()) {
        break
      }

      const request = requests[i]
      const requestIndex = iteration * requests.length + i

      if (onProgress) {
        onProgress({
          currentIndex: requestIndex,
          totalRequests,
          currentRequest: request.name,
          iteration: iteration + 1,
          totalIterations: config.iterations,
        })
      }

      const result = await runSingleRequest(request, config.collectionId, dataRow)

      const requestResult: RequestRunResult = {
        requestId: request.id,
        requestName: request.name,
        request,
        response: result.response,
        error: result.error,
        testResults: result.testResults,
        assertionResults: result.assertionResults,
        allPassed: result.allPassed,
        iteration: iteration + 1,
        dataRow,
      }

      results.push(requestResult)

      if (result.allPassed) {
        passedRequests++
      } else {
        failedRequests++
      }

      totalTests += result.testResults.length
      passedTests += result.testResults.filter((t) => t.passed).length
      failedTests += result.testResults.filter((t) => !t.passed).length

      totalAssertions += result.assertionResults.length
      passedAssertions += result.assertionResults.filter((a) => a.passed).length
      failedAssertions += result.assertionResults.filter((a) => !a.passed).length

      if (result.response) {
        totalResponseTime += result.response.time
      }

      if (config.stopOnError && !result.allPassed) {
        break
      }

      if (config.delay > 0 && i < requests.length - 1) {
        await sleep(config.delay)
      }
    }

    if (shouldStop?.()) {
      break
    }
  }

  const endTime = Date.now()
  const averageResponseTime = results.filter((r) => r.response).length > 0
    ? totalResponseTime / results.filter((r) => r.response).length
    : 0

  return {
    id: generateId(),
    name: collection.name,
    startTime,
    endTime,
    totalRequests: results.length,
    passedRequests,
    failedRequests,
    totalTests,
    passedTests,
    failedTests,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    averageResponseTime,
    results,
    config,
  }
}

export function generateHtmlReport(runResult: CollectionRunResult): string {
  const { summary } = buildReportSummary(runResult)

  const resultsHtml = runResult.results
    .map(
      (result, index) => `
    <div class="request-result ${result.allPassed ? 'passed' : 'failed'}">
      <div class="request-header">
        <span class="request-number">#${index + 1}</span>
        <span class="request-name">${result.requestName}</span>
        <span class="request-method">${result.request.method}</span>
        <span class="request-status ${result.response ? (result.response.statusCode >= 200 && result.response.statusCode < 300 ? 'success' : 'error') : 'error'}">
          ${result.response ? result.response.statusCode : 'Error'}
        </span>
        <span class="request-time">${result.response ? result.response.time + 'ms' : '-'}</span>
        <span class="request-result-badge ${result.allPassed ? 'badge-passed' : 'badge-failed'}">
          ${result.allPassed ? '通过' : '失败'}
        </span>
      </div>
      ${result.error ? `<div class="request-error">${result.error}</div>` : ''}
      ${result.testResults.length > 0 ? `
        <div class="test-results">
          <h4>脚本测试 (${result.testResults.filter((t) => t.passed).length}/${result.testResults.length})</h4>
          ${result.testResults
            .map(
              (test) => `
            <div class="test-item ${test.passed ? 'test-passed' : 'test-failed'}">
              <span class="test-icon">${test.passed ? '✓' : '✗'}</span>
              <span class="test-name">${test.name}</span>
              ${!test.passed && test.error ? `<span class="test-error">${test.error}</span>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      ` : ''}
      ${result.assertionResults.length > 0 ? `
        <div class="assertion-results">
          <h4>可视化断言 (${result.assertionResults.filter((a) => a.passed).length}/${result.assertionResults.length})</h4>
          ${result.assertionResults
            .map(
              (assertion) => `
            <div class="test-item ${assertion.passed ? 'test-passed' : 'test-failed'}">
              <span class="test-icon">${assertion.passed ? '✓' : '✗'}</span>
              <span class="test-name">${assertion.assertion.type}: ${assertion.assertion.property || ''} ${assertion.assertion.operator} ${assertion.assertion.expectedValue || ''}</span>
              ${!assertion.passed && assertion.error ? `<span class="test-error">${assertion.error}</span>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      ` : ''}
    </div>
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>测试报告 - ${runResult.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #0e639c 0%, #1177bb 100%); color: white; padding: 30px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .subtitle { opacity: 0.9; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px; background: #fafafa; }
    .summary-item { background: white; padding: 16px; border-radius: 6px; border: 1px solid #e0e0e0; }
    .summary-item .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .summary-item .value { font-size: 24px; font-weight: 600; }
    .summary-item.passed .value { color: #4caf50; }
    .summary-item.failed .value { color: #f44336; }
    .results { padding: 24px; }
    .results h2 { font-size: 18px; margin-bottom: 16px; color: #333; }
    .request-result { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
    .request-result.passed { border-left: 4px solid #4caf50; }
    .request-result.failed { border-left: 4px solid #f44336; }
    .request-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fafafa; cursor: pointer; }
    .request-number { font-weight: 600; color: #888; }
    .request-name { flex: 1; font-weight: 500; }
    .request-method { padding: 2px 8px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .request-status { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .request-status.success { background: #e8f5e9; color: #2e7d32; }
    .request-status.error { background: #ffebee; color: #c62828; }
    .request-time { color: #666; font-size: 13px; font-family: monospace; }
    .request-result-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-passed { background: #e8f5e9; color: #2e7d32; }
    .badge-failed { background: #ffebee; color: #c62828; }
    .request-error { padding: 12px 16px; background: #ffebee; color: #c62828; font-size: 13px; }
    .test-results, .assertion-results { padding: 12px 16px; border-top: 1px solid #e0e0e0; }
    .test-results h4, .assertion-results h4 { font-size: 13px; color: #666; margin-bottom: 8px; }
    .test-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 4px; font-size: 13px; margin-bottom: 4px; }
    .test-passed { background: #e8f5e9; }
    .test-failed { background: #ffebee; }
    .test-icon { font-weight: 600; }
    .test-passed .test-icon { color: #2e7d32; }
    .test-failed .test-icon { color: #c62828; }
    .test-name { flex: 1; }
    .test-error { color: #c62828; font-size: 12px; }
    .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>测试报告 - ${runResult.name}</h1>
      <div class="subtitle">生成时间: ${new Date(runResult.startTime).toLocaleString()}</div>
    </div>
    <div class="summary">
      <div class="summary-item">
        <div class="label">总请求数</div>
        <div class="value">${summary.totalRequests}</div>
      </div>
      <div class="summary-item passed">
        <div class="label">通过</div>
        <div class="value">${summary.passedRequests}</div>
      </div>
      <div class="summary-item failed">
        <div class="label">失败</div>
        <div class="value">${summary.failedRequests}</div>
      </div>
      <div class="summary-item">
        <div class="label">平均响应时间</div>
        <div class="value">${summary.averageResponseTime.toFixed(0)}ms</div>
      </div>
      <div class="summary-item">
        <div class="label">脚本测试总数</div>
        <div class="value">${summary.totalTests}</div>
      </div>
      <div class="summary-item passed">
        <div class="label">脚本测试通过</div>
        <div class="value">${summary.passedTests}</div>
      </div>
      <div class="summary-item">
        <div class="label">断言总数</div>
        <div class="value">${summary.totalAssertions}</div>
      </div>
      <div class="summary-item">
        <div class="label">总耗时</div>
        <div class="value">${(summary.totalTime / 1000).toFixed(2)}s</div>
      </div>
    </div>
    <div class="results">
      <h2>详细结果</h2>
      ${resultsHtml}
    </div>
    <div class="footer">
      PostBoy 自动化测试报告 | 生成于 ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `
}

export function buildReportSummary(runResult: CollectionRunResult): { summary: { totalRequests: number; passedRequests: number; failedRequests: number; totalTests: number; passedTests: number; failedTests: number; totalAssertions: number; passedAssertions: number; failedAssertions: number; averageResponseTime: number; totalTime: number } } {
  const totalTime = (runResult.endTime || Date.now()) - runResult.startTime

  return {
    summary: {
      totalRequests: runResult.totalRequests,
      passedRequests: runResult.passedRequests,
      failedRequests: runResult.failedRequests,
      totalTests: runResult.totalTests,
      passedTests: runResult.passedTests,
      failedTests: runResult.failedTests,
      totalAssertions: runResult.totalAssertions,
      passedAssertions: runResult.passedAssertions,
      failedAssertions: runResult.failedAssertions,
      averageResponseTime: runResult.averageResponseTime,
      totalTime,
    },
  }
}

export function exportReport(runResult: CollectionRunResult, format: 'json' | 'html'): string {
  if (format === 'html') {
    return generateHtmlReport(runResult)
  }

  const { summary } = buildReportSummary(runResult)
  return JSON.stringify(
    {
      summary,
      results: runResult.results,
      config: runResult.config,
      exportedAt: Date.now(),
    },
    null,
    2
  )
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
