import Link from "next/link"
import { headers } from "next/headers"

import { SignOutButton } from "@/components/sign-out-button"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth"

const conversations = [
  "Quarterly product recap",
  "Summarize onboarding notes",
  "Create a release checklist",
]

const suggestedPrompts = [
  "Draft a launch update",
  "Summarize this document",
  "Turn notes into tasks",
]

function getGreeting(hour: number) {
  if (hour < 12) {
    return "Good morning"
  }

  if (hour < 18) {
    return "Good afternoon"
  }

  return "Good evening"
}

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const displayName = session?.user.name?.trim() || "User"
  const firstName = session?.user.name?.trim()?.split(/\s+/)?.[0] ?? null
  const email = session?.user.email ?? ""
  const greeting = getGreeting(new Date().getHours())

  return (
    <div className="min-h-svh bg-background">
      {session ? (
        <div className="flex min-h-svh flex-col lg:flex-row">
          <aside className="hidden w-full max-w-72 shrink-0 border-r bg-muted/30 p-4 lg:flex lg:flex-col">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Documind AI</p>
                <h1 className="text-xl font-semibold">AI workspace</h1>
              </div>
              <Button variant="outline" className="w-full justify-start rounded-2xl">
                + New chat
              </Button>
            </div>
            <div className="mt-6 flex-1 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Recent chats
              </p>
              {conversations.map((conversation) => (
                <button
                  key={conversation}
                  type="button"
                  className="w-full rounded-2xl border border-transparent bg-background/70 px-3 py-3 text-left text-sm transition hover:border-border hover:bg-background"
                >
                  {conversation}
                </button>
              ))}
            </div>
            <div className="space-y-4 rounded-3xl border bg-background p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
              <SignOutButton />
            </div>
          </aside>
          <main className="flex flex-1 flex-col">
            <div className="border-b bg-background/90 px-4 py-4 backdrop-blur md:px-6">
              <div className="mx-auto flex w-full max-w-4xl items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Simple AI chat clone</p>
                  <h2 className="text-2xl font-semibold">
                    {firstName ? `${greeting}, ${firstName}` : greeting}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    A clean assistant view opens as soon as you sign in.
                  </p>
                </div>
                <div className="lg:hidden">
                  <SignOutButton />
                </div>
              </div>
            </div>
            <div className="flex-1 px-4 py-6 md:px-6">
              <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      className="rounded-full bg-background"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="max-w-2xl rounded-3xl border bg-card px-5 py-4 shadow-sm">
                    <p className="text-sm leading-7 text-card-foreground">
                      I&apos;ve opened a simple chat workspace inspired by Claude and ChatGPT.
                      You can keep the layout minimal for now and connect a real model later.
                    </p>
                  </div>
                  <div className="ml-auto max-w-2xl rounded-3xl bg-primary px-5 py-4 text-sm leading-7 text-primary-foreground shadow-sm">
                    Perfect. Keep it focused on the core chat experience with a sidebar,
                    conversation area, and composer.
                  </div>
                  <div className="max-w-2xl rounded-3xl border bg-card px-5 py-4 shadow-sm">
                    <p className="text-sm leading-7 text-card-foreground">
                      Done — this screen acts as the signed-in destination, so the user lands
                      directly in the assistant UI after login.
                    </p>
                  </div>
                </div>
                <div className="rounded-[2rem] border bg-card p-4 shadow-sm">
                  <textarea
                    aria-label="Chat message"
                    className="min-h-24 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Message Documind AI..."
                    defaultValue=""
                  />
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Static UI clone for the post-login chat experience.
                    </p>
                    <Button type="button" className="rounded-full px-4">
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Better Auth is configured</p>
                <h1 className="text-2xl font-semibold">Sign in or create an account</h1>
                <p className="text-sm text-muted-foreground">
                  This project now uses Better Auth email and password flows.
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/signup">Create Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
