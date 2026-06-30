"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const currentTheme = mounted ? (resolvedTheme === "light" ? "light" : "dark") : "dark"
  const nextTheme = currentTheme === "dark" ? "light" : "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full shadow-sm"
      aria-label={mounted ? `Switch to ${nextTheme} mode` : "Toggle theme"}
      disabled={!mounted}
      onClick={() => setTheme(nextTheme)}
    >
      {mounted ? `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode` : "Dark mode"}
    </Button>
  )
}

export { ThemeToggle }
