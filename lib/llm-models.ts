/**
 * Chat model catalog + provider availability (server-side).
 * Client loads available models via GET /api/models.
 */

export type ChatProvider = "gemini" | "zai"

export type ChatModelDefinition = {
  id: string
  label: string
  provider: ChatProvider
  /** Provider-native model name sent to the API */
  apiModel: string
  description: string
}

/** Built-in selectable chat models. */
export const CHAT_MODELS: ChatModelDefinition[] = [
  {
    id: "glm-4.7-flash",
    label: "GLM 4.7 Flash",
    provider: "zai",
    apiModel: "glm-4.7-flash",
    description: "Z.AI · OpenAI-compatible",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    provider: "gemini",
    apiModel: "gemini-3.1-flash-lite",
    description: "Google · Interactions API",
  },
]

export function getChatModel(id: string | undefined | null) {
  if (!id) return null
  return CHAT_MODELS.find((m) => m.id === id) ?? null
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

export function isZaiConfigured() {
  return Boolean(process.env.ZAI_API_KEY?.trim())
}

export function isProviderConfigured(provider: ChatProvider) {
  if (provider === "gemini") return isGeminiConfigured()
  if (provider === "zai") return isZaiConfigured()
  return false
}

/** Models the server can actually call right now. */
export function listAvailableChatModels() {
  return CHAT_MODELS.filter((m) => isProviderConfigured(m.provider))
}

/**
 * Resolve model for a request.
 * Prefer client selection if valid & configured; else DEFAULT_CHAT_MODEL; else first available (Z.AI preferred).
 */
export function resolveChatModel(
  requestedId?: string | null
): ChatModelDefinition {
  const available = listAvailableChatModels()
  if (available.length === 0) {
    throw new Error(
      "No chat provider configured. Set ZAI_API_KEY and/or GEMINI_API_KEY in .env"
    )
  }

  if (requestedId) {
    const requested = getChatModel(requestedId)
    if (requested && isProviderConfigured(requested.provider)) {
      return requested
    }
  }

  const fromEnv = process.env.DEFAULT_CHAT_MODEL?.trim()
  if (fromEnv) {
    const envModel = getChatModel(fromEnv)
    if (envModel && isProviderConfigured(envModel.provider)) {
      return envModel
    }
  }

  // Prefer Z.AI when both exist
  const zai = available.find((m) => m.provider === "zai")
  return zai ?? available[0]!
}
