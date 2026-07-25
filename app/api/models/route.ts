import { NextResponse } from "next/server"

import {
  listAvailableChatModels,
  resolveChatModel,
} from "@/lib/llm-models"
import { requireSession } from "@/lib/session"

/**
 * GET /api/models
 * Chat models available for the current server env (keys present).
 */
export async function GET() {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const models = listAvailableChatModels().map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      description: m.description,
    }))

    let defaultModelId: string | null = null
    try {
      defaultModelId = resolveChatModel(null).id
    } catch {
      defaultModelId = models[0]?.id ?? null
    }

    return NextResponse.json({
      models,
      defaultModelId,
    })
  } catch (error) {
    console.error("[models]", error)
    return NextResponse.json(
      { error: "Failed to list models" },
      { status: 500 }
    )
  }
}
