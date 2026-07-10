import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SignupForm } from "@/components/signup-form"
import { MarketingShell } from "@/components/marketing-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auth } from "@/lib/auth"

export default async function SignupPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/new")
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div className="hidden space-y-4 lg:block">
            <p className="text-sm font-medium text-primary">Get started</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Create your Documind account
            </h1>
            <p className="max-w-md text-muted-foreground">
              Set up a free workspace and explore document search, summaries,
              and analytics with sample data.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Free starter workspace</li>
              <li>• Email and password sign-up</li>
              <li>• Dashboard ready immediately after signup</li>
            </ul>
          </div>

          <Card className="mx-auto w-full max-w-md shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Create account</CardTitle>
              <CardDescription>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignupForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingShell>
  )
}
