import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  ListChecks,
  Play,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Trash2,
  Upload,
  X
} from "lucide-react"

const STORAGE_KEY = "qa-api-agent-test-runs"

const starter = {
  method: "GET",
  endpoint: "https://restful-booker.herokuapp.com/ping",
  expectedStatus: "201",
  body: "",
  headers: {}
}

function loadRuns() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

function saveRuns(runs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
}

function normaliseRow(row, index) {
  const body = row["Request Body"] ?? row["Request Body (JSON)"] ?? row.Body ?? ""
  const headers = row.Headers ?? ""

  return {
    id: row["Test ID"] || `TC${String(index + 1).padStart(3, "0")}`,
    category: row.Category || "Imported",
    method: String(row.Method || "GET").toUpperCase(),
    endpoint: row.Endpoint || "",
    description: row.Description || "",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body || ""),
    expectedStatus: String(row["Expected Status"] ?? row["Expected status"] ?? "200"),
    expectedResult: row["Expected Result"] || "",
    priority: row.Priority || "P2",
    aiScenario: row["AI Scenario"] || ""
  }
}

function App() {
  const [request, setRequest] = useState(starter)
  const [analysis, setAnalysis] = useState(null)
  const [execution, setExecution] = useState(null)
  const [runs, setRuns] = useState(loadRuns)
  const [suite, setSuite] = useState([])
  const [busy, setBusy] = useState(false)
  const [suiteBusy, setSuiteBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [selectedSuiteId, setSelectedSuiteId] = useState("")
  const [suiteFileName, setSuiteFileName] = useState("")
  const [latestReport, setLatestReport] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyState, setCopyState] = useState("Copy URL")

  const passRate = useMemo(() => {
    if (!runs.length) return "—"

    const passed = runs.filter(run => run.execution?.ok).length
    return `${Math.round((passed / runs.length) * 100)}%`
  }, [runs])

  const latestRisk = analysis ? `${analysis.riskScore}/100` : "—"

  async function analyse(customRequest = request) {
    setBusy(true)
    setMessage("")

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(customRequest)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed")
      }

      setAnalysis(data)

      setMessage(
        data.source === "demo-analysis"
          ? "QA analysis completed using the built-in fallback. Add OPENAI_API_KEY on Vercel for live AI analysis."
          : "AI analysis completed"
      )

      return data
    } catch (error) {
      setMessage(error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function saveReport(runsToSave, suiteName = "QA API Agent") {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        runs: runsToSave,
        suiteName
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Report generation failed")
    }

    setLatestReport(data)
    return data
  }

  async function execute(customRequest = request, options = {}) {
    if (!customRequest.endpoint) {
      throw new Error("Endpoint is required")
    }

    const response = await fetch("/api/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(customRequest)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Execution failed")
    }

    const expected = Number(customRequest.expectedStatus)
    const ok = Number.isFinite(expected) && data.status === expected
    const executionData = {
      ...data,
      ok,
      expectedStatus: expected
    }

    setExecution(executionData)

    if (!options.batch) {
      const run = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        request: customRequest,
        analysis,
        execution: executionData
      }

      const nextRuns = [run, ...runs].slice(0, 100)

      setRuns(nextRuns)
      saveRuns(nextRuns)

      try {
        const report = await saveReport([run], "Single API Execution")

        setMessage(
          `${ok ? "API execution completed" : "API executed but the expected status did not match"} · Report ready`
        )

        if (report?.reportUrl) {
          setShareOpen(true)
        }
      } catch (reportError) {
        setMessage(
          `${ok ? "API execution completed" : "API executed but the expected status did not match"} · Report could not be saved: ${reportError.message}`
        )
      }
    }

    return executionData
  }

  async function runSingle() {
    setBusy(true)
    setMessage("")

    try {
      await execute(request)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function runAll() {
    if (!suite.length) {
      setMessage("Import an Excel test suite first")
      return
    }

    setSuiteBusy(true)
    setMessage(`Running 0/${suite.length} test cases`)

    let workingRuns = [...runs]
    const batchRuns = []
    let passed = 0

    try {
      for (let index = 0; index < suite.length; index += 1) {
        const item = suite[index]

        setSelectedSuiteId(item.id)
        setMessage(`Running ${index + 1}/${suite.length} · ${item.id} · ${item.method}`)

        const req = {
          method: item.method,
          endpoint: item.endpoint,
          expectedStatus: item.expectedStatus,
          body: item.body,
          headers: parseHeaders(item.headers)
        }

        const result = await execute(req, { batch: true })

        if (result.ok) {
          passed += 1
        }

        const run = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          request: req,
          analysis: null,
          execution: result,
          suiteTestId: item.id,
          suiteMeta: item
        }

        batchRuns.push(run)
        workingRuns = [run, ...workingRuns].slice(0, 100)

        setRuns(workingRuns)
        saveRuns(workingRuns)
      }

      try {
        const report = await saveReport(
          batchRuns,
          suiteFileName || "Excel API Test Suite"
        )

        setMessage(`Run All completed · ${passed}/${suite.length} passed · Report ready`)

        if (report?.reportUrl) {
          setShareOpen(true)
        }
      } catch (reportError) {
        setMessage(
          `Run All completed · ${passed}/${suite.length} passed · Report could not be saved: ${reportError.message}`
        )
      }
    } catch (error) {
      setMessage(`Run All stopped · ${error.message}`)
    } finally {
      setSuiteBusy(false)
      setSelectedSuiteId("")
    }
  }

  async function analyseAll() {
    if (!suite.length) {
      setMessage("Import an Excel test suite first")
      return
    }

    setSuiteBusy(true)
    setMessage(`AI analysing 0/${suite.length} scenarios`)

    let count = 0

    try {
      for (let index = 0; index < suite.length; index += 1) {
        const item = suite[index]

        setSelectedSuiteId(item.id)
        setMessage(`AI analysing ${index + 1}/${suite.length} · ${item.id}`)

        const result = await analyse({
          method: item.method,
          endpoint: item.endpoint,
          expectedStatus: item.expectedStatus,
          body: item.body,
          headers: parseHeaders(item.headers)
        })

        if (result) {
          count += 1
        }
      }

      setMessage(`AI analysis completed for ${count}/${suite.length} scenarios`)
    } finally {
      setSuiteBusy(false)
      setSelectedSuiteId("")
    }
  }

  function importExcel(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setMessage("Reading Excel test suite")

    const reader = new FileReader()

    reader.onload = currentEvent => {
      try {
        const workbook = XLSX.read(currentEvent.target.result, {
          type: "array"
        })

        const sheetName =
          workbook.SheetNames.find(name => /api|test|suite/i.test(name)) ||
          workbook.SheetNames[0]

        const sheet = workbook.Sheets[sheetName]

        const rows = XLSX.utils.sheet_to_json(sheet, {
          defval: ""
        })

        const parsed = rows.map(normaliseRow).filter(row => row.endpoint)

        if (!parsed.length) {
          throw new Error("No valid API rows found. Check the Endpoint column")
        }

        setSuite(parsed)
        setSuiteFileName(file.name)

        const first = parsed[0]
        loadSuiteTest(first)

        setMessage(`Imported ${parsed.length} API test cases from ${file.name}`)
      } catch (error) {
        setMessage(`Excel import failed · ${error.message}`)
      }
    }

    reader.readAsArrayBuffer(file)
    event.target.value = ""
  }

  function loadSuiteTest(item) {
    setSelectedSuiteId(item.id)

    setRequest({
      method: item.method,
      endpoint: item.endpoint,
      expectedStatus: item.expectedStatus,
      body: item.body || "",
      headers: parseHeaders(item.headers)
    })

    setAnalysis(null)
    setExecution(null)
  }

  function parseHeaders(value) {
    if (!value) {
      return {}
    }

    if (typeof value === "object") {
      return value
    }

    const result = {}

    String(value)
      .split(/\r?\n|;/)
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        const index = part.indexOf(":")

        if (index > 0) {
          const key = part.slice(0, index).trim()
          const headerValue = part.slice(index + 1).trim()

          result[key] = headerValue
        }
      })

    return result
  }

  function clearHistory() {
    setRuns([])
    saveRuns([])
  }

  function exportRun(run) {
    const blob = new Blob(
      [JSON.stringify(run, null, 2)],
      {
        type: "application/json"
      }
    )

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `qa-api-agent-${run.id}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)
  }

  async function copyReportUrl() {
    if (!latestReport?.reportUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(latestReport.reportUrl)
      setCopyState("Copied")
      window.setTimeout(() => setCopyState("Copy URL"), 1600)
    } catch {
      setCopyState("Copy failed")
    }
  }

  async function downloadReport() {
    if (!latestReport?.downloadUrl) {
      return
    }

    try {
      const response = await fetch(latestReport.downloadUrl)

      if (!response.ok) {
        throw new Error("Unable to download report")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")

      anchor.href = url
      anchor.download = latestReport.fileName || "qa-api-agent-report.html"

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      URL.revokeObjectURL(url)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const update = (field, value) => {
    setRequest(current => ({
      ...current,
      [field]: value
    }))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
              <ShieldCheck size={24} />
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">QA API Agent</h1>
              <p className="text-xs text-slate-400">
                AI assisted API testing for QA engineers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity size={15} />
            {runs.length} saved runs
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-7">
        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Test runs" value={runs.length} icon={<History size={18} />} />
          <Stat label="Pass rate" value={passRate} icon={<CheckCircle2 size={18} />} />
          <Stat label="Latest risk" value={latestRisk} icon={<AlertTriangle size={18} />} />
          <Stat label="AI test ideas" value={analysis?.tests?.length ?? "—"} icon={<Sparkles size={18} />} />
        </section>

        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SectionTitle
              icon={<FileSpreadsheet size={18} />}
              title="Test Suite Runner"
              subtitle="Run one API check or load a complete regression suite from Excel"
            />

            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary cursor-pointer">
                <Upload size={15} />
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={importExcel}
                />
              </label>

              <button
                className="btn-primary"
                onClick={runAll}
                disabled={suiteBusy || !suite.length}
              >
                <PlayCircle size={16} />
                Run All
              </button>

              <button
                className="btn-secondary"
                onClick={analyseAll}
                disabled={suiteBusy || !suite.length}
              >
                <Sparkles size={16} />
                AI Analyse All
              </button>
            </div>
          </div>

          {suite.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks size={16} className="text-cyan-300" />
                  {suite.length} test cases loaded
                  {suiteFileName ? ` · ${suiteFileName}` : ""}
                </div>

                <span className="text-xs text-slate-500">
                  Select a row to load it into the API check
                </span>
              </div>

              <div className="max-h-72 overflow-auto">
                {suite.map(item => (
                  <button
                    key={item.id}
                    onClick={() => loadSuiteTest(item)}
                    className={`grid w-full grid-cols-[70px_80px_1fr_70px_80px] gap-3 border-b border-slate-800/80 px-4 py-3 text-left text-xs hover:bg-slate-900 ${
                      selectedSuiteId === item.id ? "bg-cyan-400/5" : ""
                    }`}
                  >
                    <span className="font-mono text-slate-500">{item.id}</span>
                    <span className="font-semibold text-cyan-300">{item.method}</span>
                    <span className="truncate text-slate-300">{item.endpoint}</span>
                    <span className="text-slate-400">{item.expectedStatus}</span>
                    <span
                      className={
                        selectedSuiteId === item.id
                          ? "text-cyan-300"
                          : "text-slate-500"
                      }
                    >
                      {selectedSuiteId === item.id ? "Loaded" : item.priority}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="panel">
            <SectionTitle
              icon={<TestTube2 size={18} />}
              title="New API check"
              subtitle="Analyse the endpoint, then execute the real request"
            />

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
                <Field label="Method">
                  <select
                    value={request.method}
                    onChange={event => update("method", event.target.value)}
                    className="control"
                  >
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map(method => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Endpoint">
                  <input
                    value={request.endpoint}
                    onChange={event => update("endpoint", event.target.value)}
                    className="control"
                    placeholder="https://api.example.com/users"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Expected status">
                  <input
                    value={request.expectedStatus}
                    onChange={event => update("expectedStatus", event.target.value)}
                    className="control"
                    placeholder="200"
                  />
                </Field>

                <Field label="Request body JSON">
                  <textarea
                    value={request.body}
                    onChange={event => update("body", event.target.value)}
                    className="control min-h-24 font-mono text-xs"
                    placeholder='{"name":"Vishesh"}'
                  />
                </Field>
              </div>

              <Field label="Request headers optional">
                <textarea
                  value={Object.entries(request.headers || {})
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n")}
                  onChange={event =>
                    update("headers", parseHeaders(event.target.value))
                  }
                  className="control min-h-20 font-mono text-xs"
                  placeholder={"Content-Type: application/json\nAuthorization: Bearer <token>"}
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  onClick={() => analyse()}
                  disabled={busy || suiteBusy}
                >
                  <Sparkles size={16} />
                  Analyse with AI
                </button>

                <button
                  className="btn-secondary"
                  onClick={runSingle}
                  disabled={busy || suiteBusy}
                >
                  <Play size={16} />
                  Run API
                </button>

                <button
                  className="btn-ghost"
                  onClick={() => {
                    setRequest(starter)
                    setAnalysis(null)
                    setExecution(null)
                    setSelectedSuiteId("")
                  }}
                >
                  <RefreshCcw size={16} />
                  Reset
                </button>
              </div>

              {message && (
                <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-slate-300">
                  {message}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <SectionTitle
              icon={<Sparkles size={18} />}
              title="AI risk view"
              subtitle="Risk is a recommendation, not an execution result"
            />

            {analysis ? (
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between rounded-xl bg-slate-900 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Release risk
                    </p>
                    <p className="mt-1 text-3xl font-semibold">
                      {analysis.riskScore}
                      <span className="text-base text-slate-500">/100</span>
                    </p>
                  </div>

                  <RiskBadge level={analysis.riskLevel} />
                </div>

                <p className="text-sm leading-6 text-slate-300">
                  {analysis.summary}
                </p>

                <div>
                  <p className="label">Impacted areas</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.impactedAreas?.map(area => (
                      <span key={area} className="tag">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label">Release recommendation</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {analysis.releaseRecommendation}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState text="Run AI analysis to see risk, impacted areas and release guidance" />
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="panel">
            <SectionTitle
              icon={<TestTube2 size={18} />}
              title="Suggested test coverage"
              subtitle="Prioritised scenarios generated from the API context"
            />

            {analysis?.tests?.length ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
                <div className="grid grid-cols-[70px_1fr_100px] gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500">
                  <span>ID</span>
                  <span>Scenario</span>
                  <span>Priority</span>
                </div>

                {analysis.tests.map(test => (
                  <div
                    key={test.id}
                    className="grid grid-cols-[70px_1fr_100px] gap-3 border-b border-slate-800/80 px-4 py-4 last:border-0"
                  >
                    <span className="font-mono text-xs text-slate-500">
                      {test.id}
                    </span>

                    <div>
                      <p className="text-sm text-slate-200">{test.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {test.category} · {test.expected}
                      </p>
                    </div>

                    <Priority value={test.priority} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No test scenarios yet" />
            )}
          </div>

          <div className="panel">
            <SectionTitle
              icon={<AlertTriangle size={18} />}
              title="Test gaps"
              subtitle="Areas worth adding to the regression set"
            />

            {analysis?.gaps?.length ? (
              <ul className="mt-5 space-y-3">
                {analysis.gaps.map(gap => (
                  <li
                    key={gap}
                    className="flex gap-3 rounded-lg border border-amber-400/10 bg-amber-400/5 p-3 text-sm text-slate-300"
                  >
                    <AlertTriangle
                      className="mt-0.5 shrink-0 text-amber-300"
                      size={16}
                    />
                    {gap}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Run an analysis to identify likely coverage gaps" />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SectionTitle
              icon={<Clock3 size={18} />}
              title="Latest execution"
              subtitle="The last real request sent by the QA API Agent"
            />

            {latestReport?.reportUrl && (
              <button
                className="btn-primary"
                onClick={() => setShareOpen(true)}
              >
                <ExternalLink size={16} />
                Share Report
              </button>
            )}
          </div>

          {execution ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 md:grid-cols-5">
                <Metric
                  label="Result"
                  value={execution.ok ? "PASS" : "FAIL"}
                  good={execution.ok}
                />
                <Metric label="Expected" value={execution.expectedStatus || "—"} />
                <Metric
                  label="Actual"
                  value={execution.status || "—"}
                  good={execution.ok}
                />
                <Metric
                  label="Response time"
                  value={`${execution.duration ?? 0} ms`}
                />
                <Metric
                  label="Status text"
                  value={execution.statusText || execution.error || "—"}
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label">Request</p>
                    <p className="mt-1 font-mono text-sm">
                      <span className="font-semibold text-cyan-300">
                        {execution.requestMethod || request.method}
                      </span>{" "}
                      {execution.endpoint || request.endpoint}
                    </p>
                  </div>

                  <span className={execution.ok ? "status-pass" : "status-fail"}>
                    {execution.ok
                      ? "Expected response received"
                      : "Expected response not received"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ResponseBox
                  title="Request body"
                  value={execution.requestBody ?? request.body ?? "No request body"}
                />
                <ResponseBox title="Response body" value={execution.body} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ResponseBox
                  title="Request headers"
                  value={execution.requestHeaders ?? request.headers ?? {}}
                />
                <ResponseBox
                  title="Response headers"
                  value={execution.responseHeaders ?? {}}
                />
              </div>

              {execution.error && (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
                  <strong>Execution error</strong>
                  <span className="ml-2">{execution.error}</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyState text="Run an API check to capture request, response, status and timing here" />
          )}
        </section>

        <section className="panel">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle
              icon={<History size={18} />}
              title="Run history"
              subtitle="Saved locally in this browser for the hackathon demo"
            />

            <button
              className="btn-danger"
              onClick={clearHistory}
              disabled={!runs.length}
            >
              <Trash2 size={15} />
              Clear
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {runs.length ? (
              runs.map(run => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {run.request.method} {run.request.endpoint}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={
                        run.execution?.ok ? "status-pass" : "status-fail"
                      }
                    >
                      {run.execution?.ok ? "PASS" : "FAIL"}
                    </span>

                    <button
                      className="btn-icon"
                      onClick={() => exportRun(run)}
                      title="Download execution JSON"
                    >
                      <Download size={15} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No saved runs yet. Execute an API request to create the first run" />
            )}
          </div>
        </section>
      </main>

      {shareOpen && latestReport?.reportUrl && (
        <ShareReportModal
          report={latestReport}
          copyState={copyState}
          onCopy={copyReportUrl}
          onDownload={downloadReport}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

function ShareReportModal({
  report,
  copyState,
  onCopy,
  onDownload,
  onClose
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Share execution report</p>
            <p className="mt-1 text-sm text-slate-400">
              Share the live report URL or download an HTML copy
            </p>
          </div>

          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="label">Report URL</p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={report.reportUrl}
              className="control min-w-0"
              onFocus={event => event.target.select()}
            />

            <button className="btn-secondary shrink-0" onClick={onCopy}>
              <Copy size={15} />
              {copyState}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            className="btn-ghost"
            onClick={() => window.open(report.reportUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink size={16} />
            Open Report
          </button>

          <button className="btn-primary" onClick={onDownload}>
            <Download size={16} />
            Download Report
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="panel flex items-center justify-between">
      <div>
        <p className="label">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </div>

      <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
        {icon}
      </div>
    </div>
  )
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-cyan-300">{icon}</div>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function RiskBadge({ level }) {
  return (
    <span className={`risk-${String(level).toLowerCase()}`}>
      {level}
    </span>
  )
}

function Priority({ value }) {
  return (
    <span className={`priority-${String(value).toLowerCase()}`}>
      {value}
    </span>
  )
}

function Metric({ label, value, good }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="label">{label}</p>
      <p
        className={`mt-2 text-lg font-semibold ${
          good === true
            ? "text-emerald-300"
            : good === false
              ? "text-rose-300"
              : "text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function ResponseBox({ title, value }) {
  let display = value

  if (value === undefined || value === null || value === "") {
    display = "—"
  } else if (typeof value !== "string") {
    display = JSON.stringify(value, null, 2)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="label">{title}</p>
      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-300">
        {display}
      </pre>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}

export default App
