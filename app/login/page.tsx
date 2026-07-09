import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { MarketingShell } from "@/components/marketing-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auth } from "@/lib/auth"

export default async function LoginPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/dashboard")
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div className="hidden space-y-4 lg:block">
            <p className="text-sm font-medium text-primary">Welcome back</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Sign in to your Documind workspace
            </h1>
            <p className="max-w-md text-muted-foreground">
              Access your dashboard, search documents, and pick up where your
              team left off.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Secure email and password authentication</li>
              <li>• Instant redirect to your personal dashboard</li>
              <li>• Session-aware access across devices</li>
            </ul>
          </div>

          <Card className="mx-auto w-full max-w-md shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create one
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingShell>
  )
}
