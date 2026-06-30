import Link from "next/link"
import { headers } from "next/headers"

import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { SignOutButton } from "@/components/sign-out-button"

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
        {session ? (
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Signed in</p>
              <h1 className="text-2xl font-semibold">
                Welcome back{session.user.name ? `, ${session.user.name}` : ""}
              </h1>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
            <div className="flex gap-3">
              <SignOutButton />
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
