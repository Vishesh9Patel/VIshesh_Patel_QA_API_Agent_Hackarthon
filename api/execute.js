export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" })
  }

  const { method = "GET", endpoint, body, headers = {} } = req.body || {}

  if (!endpoint) {
    return res.status(400).json({ error: "Endpoint is required." })
  }

  const started = Date.now()

  try {
    const requestOptions = {
      method: String(method).toUpperCase(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers
      }
    }

    if (!["GET", "HEAD"].includes(requestOptions.method) && body) {
      requestOptions.body = typeof body === "string" ? body : JSON.stringify(body)
    }

    const response = await fetch(endpoint, requestOptions)
    const responseText = await response.text()

    let responseBody = responseText
    try {
      responseBody = responseText ? JSON.parse(responseText) : null
    } catch {
      // Keep plain-text response.
    }

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      duration: Date.now() - started,
      body: responseBody,
      endpoint,
      requestMethod: requestOptions.method,
      requestHeaders: requestOptions.headers,
      requestBody: requestOptions.body || "",
      responseHeaders: Object.fromEntries(response.headers.entries())
    })
  } catch (error) {
    return res.status(200).json({
      ok: false,
      status: 0,
      statusText: "Request failed",
      duration: Date.now() - started,
      body: null,
      endpoint,
      requestMethod: String(method).toUpperCase(),
      requestHeaders: headers,
      requestBody: body || "",
      responseHeaders: {},
      error: error instanceof Error ? error.message : "Unknown request error"
    })
  }
}
