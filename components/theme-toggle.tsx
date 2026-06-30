"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme !== "light"
  const nextTheme = isDark ? "light" : "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full shadow-sm"
      aria-label={mounted ? `Switch to ${nextTheme} mode` : "Toggle theme"}
      onClick={() => setTheme(nextTheme)}
    >
      {mounted ? (isDark ? "Dark mode" : "Light mode") : "Dark mode"}
    </Button>
  )
}

export { ThemeToggle }
