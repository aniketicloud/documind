import { ChatWorkspace } from "@/components/chat-workspace"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params
  return <ChatWorkspace mode="chat" chatId={id} />
}
