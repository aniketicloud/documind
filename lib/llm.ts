import { streamGenerateText as streamGemini } from "@/lib/gemini"
import {
  resolveChatModel,
  type ChatModelDefinition,
} from "@/lib/llm-models"
import { streamZaiChat } from "@/lib/zai"

export type StreamChatOptions = {
  system: string
  user: string
  /** Catalog model id (e.g. glm-4.7-flash, gemini-3.1-flash-lite) */
  modelId?: string | null
}

/**
 * Stream assistant tokens from the selected provider (Z.AI or Gemini Interactions).
 */
export async function* streamChatCompletion(
  options: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const model = resolveChatModel(options.modelId)
  yield* streamWithModel(model, options.system, options.user)
}

async function* streamWithModel(
  model: ChatModelDefinition,
  system: string,
  user: string
): AsyncGenerator<string, void, unknown> {
  if (model.provider === "zai") {
    yield* streamZaiChat({
      model: model.apiModel,
      system,
      user,
    })
    return
  }

  if (model.provider === "gemini") {
    const envName = process.env.GEMINI_CHAT_MODEL?.trim()
    const apiModel =
      model.id === "gemini-3.1-flash-lite" && envName
        ? envName
        : model.apiModel

    yield* streamGemini({
      model: apiModel,
      system,
      user,
    })
    return
  }

  throw new Error(`Unsupported chat provider: ${model.provider}`)
}
