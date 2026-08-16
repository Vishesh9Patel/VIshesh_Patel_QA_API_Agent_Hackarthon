const fallbackAnalysis = (input) => {
  const method = String(input.method || "GET").toUpperCase()
  const endpoint = input.endpoint || "/"
  const body = input.body || ""

  const tests = [
    {
      id: "TC-001",
      title: `Happy path - ${method} ${endpoint}`,
      category: "Functional",
      priority: "P1",
      expected: "The endpoint returns the documented success response."
    },
    {
      id: "TC-002",
      title: "Invalid or missing required data",
      category: "Negative",
      priority: "P1",
      expected: "The API rejects invalid input with a meaningful 4xx response."
    },
    {
      id: "TC-003",
      title: "Boundary value validation",
      category: "Boundary",
      priority: "P2",
      expected: "Minimum, maximum and empty values are handled consistently."
    },
    {
      id: "TC-004",
      title: "Unauthorised request",
      category: "Security",
      priority: "P1",
      expected: "Protected resources reject requests without valid credentials."
    }
  ]

  const risk = method === "DELETE" ? 78 : method === "POST" || method === "PUT" ? 68 : 46

  return {
    source: "demo-analysis",
    riskScore: risk,
    riskLevel: risk >= 75 ? "HIGH" : risk >= 55 ? "MEDIUM" : "LOW",
    summary: `The ${method} endpoint should be covered with functional, negative and boundary scenarios before release.`,
    impactedAreas: ["API validation", "Authentication", "Error handling"],
    tests,
    gaps: [
      "Contract/schema mismatch",
      "Authentication failure",
      "Boundary payloads",
      "Unexpected response body"
    ],
    releaseRecommendation: risk >= 75 ? "Run targeted regression before release." : "Proceed after the recommended API checks pass."
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" })
  }

  const input = req.body || {}
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

  if (!apiKey) {
    return res.status(200).json(fallbackAnalysis(input))
  }

  const prompt = `You are a senior QA automation engineer.
Analyse the API details below and return ONLY valid JSON.

API method: ${input.method}
Endpoint: ${input.endpoint}
Request body: ${input.body || "none"}
Expected status: ${input.expectedStatus || "not supplied"}

JSON shape:
{
  "riskScore": number,
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": string,
  "impactedAreas": string[],
  "tests": [
    {
      "id": string,
      "title": string,
      "category": "Functional|Negative|Boundary|Security|Performance",
      "priority": "P0|P1|P2|P3",
      "expected": string
    }
  ],
  "gaps": string[],
  "releaseRecommendation": string
}

Create 8-12 useful tests. Do not invent an actual execution result.`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You produce precise QA analysis as valid JSON." },
          { role: "user", content: prompt }
        ]
      })
    })

    if (!response.ok) {
      return res.status(502).json({ error: "AI provider request failed." })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return res.status(502).json({ error: "AI provider returned no analysis." })
    }

    return res.status(200).json(JSON.parse(content))
  } catch (error) {
    return res.status(500).json({ error: "Unable to analyse the API request." })
  }
}
