import { RedisDemo } from "@/components/redis-demo"
import { SiteHeader } from "@/components/site-header"

export default function RedisPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader title="Redis demo" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <RedisDemo />
      </div>
    </div>
  )
}
