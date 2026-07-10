"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader title="Error" />
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              This page hit an error. You can retry or start a new chat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="break-words rounded-lg border bg-muted/40 p-3 font-mono text-xs text-foreground">
              {error.message || "Unknown error"}
            </p>
            {error.digest ? (
              <p className="text-xs">Digest: {error.digest}</p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/new">New chat</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
