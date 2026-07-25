/**
 * Z.AI (GLM) — OpenAI-compatible Chat Completions API.
 * Base: https://api.z.ai/api/paas/v4
 */

function getBaseUrl() {
  return (
    process.env.ZAI_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.z.ai/api/paas/v4"
  )
}

function getApiKey() {
  const key = process.env.ZAI_API_KEY?.trim()
  if (!key) {
    throw new Error("ZAI_API_KEY is not set")
  }
  return key
}

export type ZaiStreamOptions = {
  model: string
  system: string
  user: string
}

/**
 * Stream text deltas from Z.AI chat completions (SSE).
 */
export async function* streamZaiChat(
  options: ZaiStreamOptions
): AsyncGenerator<string, void, unknown> {
  const url = `${getBaseUrl()}/chat/completions`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Z.AI chat failed (${res.status}): ${body.slice(0, 500) || res.statusText}`
    )
  }

  if (!res.body) {
    throw new Error("Z.AI response had no body")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events separated by blank lines
    const parts = buffer.split("\n")
    buffer = parts.pop() ?? ""

    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(":")) continue
      if (!trimmed.startsWith("data:")) continue
      const data = trimmed.slice(5).trim()
      if (data === "[DONE]") return

      try {
        const json = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string | null }
            message?: { content?: string | null }
          }>
        }
        const delta =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content
        if (delta) yield delta
      } catch {
        // ignore partial / non-JSON lines
      }
    }
  }

  // Flush trailing buffer if a final data line had no newline
  const trimmed = buffer.trim()
  if (trimmed.startsWith("data:")) {
    const data = trimmed.slice(5).trim()
    if (data && data !== "[DONE]") {
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string | null } }>
        }
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // ignore
      }
    }
  }
}
