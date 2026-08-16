import fs from "node:fs/promises"
import path from "node:path"
import { put, head } from "@vercel/blob"

const isVercel = Boolean(process.env.VERCEL)
const hasBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function pretty(value) {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "string") return safe(value)
  return safe(JSON.stringify(value, null, 2))
}

function createReportId() {
  const now = new Date()
  const pad = (value, size = 2) => String(value).padStart(size, "0")
  return `RUN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`
}

function buildReportHtml({ runs, suiteName }) {
  const total = runs.length
  const passed = runs.filter(item => item.execution?.ok).length
  const failed = total - passed
  const average = total
    ? Math.round(runs.reduce((sum, item) => sum + Number(item.execution?.duration || 0), 0) / total)
    : 0

  const rows = runs.map((item, index) => {
    const request = item.request || {}
    const execution = item.execution || {}
    const analysis = item.analysis || {}

    return `
      <tr>
        <td>${safe(item.suiteTestId || `RUN-${String(index + 1).padStart(3, "0")}`)}</td>
        <td><strong>${safe(request.method || execution.requestMethod || "GET")}</strong></td>
        <td class="endpoint">${safe(request.endpoint || execution.endpoint || "")}</td>
        <td>${safe(request.expectedStatus || execution.expectedStatus || "—")}</td>
        <td>${safe(execution.status || "—")}</td>
        <td>${safe(execution.duration ?? 0)} ms</td>
        <td><span class="${execution.ok ? "pass" : "fail"}">${execution.ok ? "PASS" : "FAIL"}</span></td>
        <td>${safe(analysis.riskLevel || "—")}</td>
      </tr>
    `
  }).join("")

  const details = runs.map((item, index) => {
    const request = item.request || {}
    const execution = item.execution || {}
    const analysis = item.analysis || null

    return `
      <section class="case">
        <h3>${safe(item.suiteTestId || `Execution ${index + 1}`)} · ${safe(request.method || execution.requestMethod || "GET")} ${safe(request.endpoint || execution.endpoint || "")}</h3>
        <div class="grid">
          <div><strong>Expected status</strong><p>${safe(request.expectedStatus || execution.expectedStatus || "—")}</p></div>
          <div><strong>Actual status</strong><p>${safe(execution.status || "—")}</p></div>
          <div><strong>Status text</strong><p>${safe(execution.statusText || execution.error || "—")}</p></div>
          <div><strong>Response time</strong><p>${safe(execution.duration ?? 0)} ms</p></div>
        </div>

        <div class="two">
          <div><strong>Request headers</strong><pre>${pretty(execution.requestHeaders || request.headers || {})}</pre></div>
          <div><strong>Response headers</strong><pre>${pretty(execution.responseHeaders || {})}</pre></div>
        </div>

        <div class="two">
          <div><strong>Request body</strong><pre>${pretty(execution.requestBody ?? request.body ?? "")}</pre></div>
          <div><strong>Response body</strong><pre>${pretty(execution.body)}</pre></div>
        </div>

        ${execution.error ? `<div class="error"><strong>Execution error</strong><br>${safe(execution.error)}</div>` : ""}
        ${analysis ? `
          <div class="ai">
            <strong>AI risk</strong> ${safe(analysis.riskLevel || "—")} ${safe(analysis.riskScore ?? "")}/100
            <br><strong>Summary</strong> ${safe(analysis.summary || "—")}
            <br><strong>Recommendation</strong> ${safe(analysis.releaseRecommendation || "—")}
          </div>
        ` : ""}
      </section>
    `
  }).join("")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA API Agent · Execution Report</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e5e7eb;background:#020617}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(135deg,#020617,#0f172a);line-height:1.55}
main{max-width:1440px;margin:0 auto;padding:40px 24px}
.header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:1px solid #1e293b;padding-bottom:24px}
.brand{display:flex;gap:14px;align-items:center}
.logo{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#083344;color:#67e8f9;font-weight:800}
h1{font-size:24px;margin:0}
h2{font-size:17px;margin:0 0 16px}
h3{font-size:15px;margin:0 0 18px}
.muted{color:#94a3b8;font-size:13px}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin:24px 0}
.card,.panel{background:rgba(15,23,42,.92);border:1px solid #1e293b;border-radius:16px;padding:18px}
.value{font-size:28px;font-weight:750;margin-top:5px}
.pass{color:#34d399;font-weight:750}
.fail{color:#fb7185;font-weight:750}
.panel{margin-top:18px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
table{width:100%;border-collapse:collapse}
th,td{padding:12px;border-bottom:1px solid #1e293b;text-align:left;font-size:13px;vertical-align:top}
th{color:#94a3b8;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
.endpoint{max-width:500px;word-break:break-all}
.case{border-top:1px solid #1e293b;padding-top:24px;margin-top:24px}
pre{background:#020617;border:1px solid #172033;border-radius:10px;padding:13px;overflow:auto;max-height:300px;white-space:pre-wrap;word-break:break-word;color:#cbd5e1;font-size:12px}
.error{margin-top:12px;background:rgba(127,29,29,.25);border:1px solid rgba(251,113,133,.25);padding:14px;border-radius:10px;color:#fecdd3}
.ai{margin-top:12px;background:rgba(8,47,73,.35);border:1px solid rgba(34,211,238,.2);padding:14px;border-radius:10px;color:#bae6fd}
@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){main{padding:24px 14px}.header{flex-direction:column}.cards,.grid,.two{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
  <header class="header">
    <div class="brand">
      <div class="logo">QA</div>
      <div>
        <h1>QA API Agent</h1>
        <p class="muted">${safe(suiteName)} · Professional API execution report</p>
      </div>
    </div>
    <div class="muted">Generated ${safe(new Date().toLocaleString())}</div>
  </header>

  <section class="cards">
    <div class="card"><div class="muted">Total tests</div><div class="value">${total}</div></div>
    <div class="card"><div class="muted">Passed</div><div class="value pass">${passed}</div></div>
    <div class="card"><div class="muted">Failed</div><div class="value fail">${failed}</div></div>
    <div class="card"><div class="muted">Pass rate</div><div class="value">${total ? Math.round(passed / total * 100) : 0}%</div></div>
    <div class="card"><div class="muted">Avg response</div><div class="value">${average} ms</div></div>
  </section>

  <section class="panel">
    <h2>Execution summary</h2>
    <div style="overflow:auto">
      <table>
        <thead>
          <tr><th>Test ID</th><th>Method</th><th>Endpoint</th><th>Expected</th><th>Actual</th><th>Time</th><th>Result</th><th>AI risk</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <h2>Request and response details</h2>
    ${details}
  </section>
</main>
</body>
</html>`
}

function getReportUrl(req, reportId) {
  const protocol = req.headers["x-forwarded-proto"] || "http"
  const host = req.headers.host || "localhost:5173"
  return `${protocol}://${host}/api/report?id=${encodeURIComponent(reportId)}`
}

async function saveReport(reportId, html) {
  if (hasBlobStorage) {
    const blob = await put(`qa-api-agent/reports/${reportId}.html`, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false
    })

    return blob.url
  }

  if (isVercel) {
    throw new Error("Report storage is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.")
  }

  const folder = path.join(process.cwd(), "reports")
  await fs.mkdir(folder, { recursive: true })
  await fs.writeFile(path.join(folder, `${reportId}.html`), html, "utf8")
  return null
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const reportId = String(req.query?.id || "").trim()

    if (!reportId) {
      return res.status(400).send("Report ID is required")
    }

    if (hasBlobStorage) {
      try {
        const blob = await head(`qa-api-agent/reports/${reportId}.html`)
        return res.redirect(307, blob.url)
      } catch {
        return res.status(404).send("Report not found")
      }
    }

    if (isVercel) {
      return res.status(503).send("Report storage is not configured")
    }

    try {
      const html = await fs.readFile(path.join(process.cwd(), "reports", `${reportId}.html`), "utf8")
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      return res.status(200).send(html)
    } catch {
      return res.status(404).send("Report not found")
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "GET or POST only" })
  }

  const payload = req.body || {}
  const runs = Array.isArray(payload.runs) ? payload.runs : []

  if (!runs.length) {
    return res.status(400).json({ error: "At least one execution is required" })
  }

  try {
    const reportId = String(payload.reportId || createReportId()).replace(/[^a-zA-Z0-9_-]/g, "")
    const suiteName = payload.suiteName || "QA API Agent"
    const html = buildReportHtml({ runs, suiteName })
    const blobUrl = await saveReport(reportId, html)
    const reportUrl = blobUrl || getReportUrl(req, reportId)

    return res.status(200).json({
      ok: true,
      reportId,
      reportUrl,
      downloadUrl: reportUrl,
      fileName: `qa-api-agent-${reportId}.html`
    })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to create report"
    })
  }
}
