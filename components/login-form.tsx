"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email")?.toString().trim() ?? ""
    const password = formData.get("password")?.toString() ?? ""

    startTransition(async () => {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      })

      if (signInError) {
        setError(signInError.message ?? "Unable to sign in.")
        return
      }

      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="m@example.com"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign In"}
            </Button>
          </Field>
          <FieldError>{error}</FieldError>
        </FieldGroup>
      </form>
      <FieldDescription className="text-center">
        Email and password sign-in is enabled through Better Auth.
      </FieldDescription>
    </div>
  )
}
