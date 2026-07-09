"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = () => {
    setError(null)

    startTransition(async () => {
      const { error: signOutError } = await authClient.signOut()

      if (signOutError) {
        setError(signOutError.message ?? "Unable to sign out.")
        return
      }

      router.push("/login")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleSignOut} disabled={isPending} variant="outline">
        {isPending ? "Signing out..." : "Sign Out"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}