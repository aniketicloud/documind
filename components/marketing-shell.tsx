import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
