import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { MarketingShell } from "@/components/marketing-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SearchIcon,
  File01Icon,
  CheckmarkCircle02Icon,
  Analytics01Icon,
  ChartUpIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

const features = [
  {
    title: "Smart search",
    description:
      "Find answers across PDFs, docs, and notes with natural language queries.",
    icon: SearchIcon,
  },
  {
    title: "Auto summaries",
    description:
      "Generate concise briefs from long documents so your team stays aligned.",
    icon: File01Icon,
  },
  {
    title: "Secure by default",
    description:
      "Role-based access, audit trails, and encrypted storage for sensitive files.",
    icon: CheckmarkCircle02Icon,
  },
  {
    title: "Usage analytics",
    description:
      "See which documents matter most and where knowledge gaps appear.",
    icon: Analytics01Icon,
  },
  {
    title: "Instant answers",
    description:
      "Ask questions in context and get cited responses in seconds.",
    icon: ChartUpIcon,
  },
  {
    title: "Team workspaces",
    description:
      "Organize libraries by project, department, or client without the chaos.",
    icon: UserGroupIcon,
  },
]

const steps = [
  {
    step: "01",
    title: "Upload your library",
    description:
      "Drag in contracts, reports, handbooks, and research papers from any source.",
  },
  {
    step: "02",
    title: "Let Documind index",
    description:
      "We extract structure, entities, and meaning so every page becomes searchable.",
  },
  {
    step: "03",
    title: "Ask and act",
    description:
      "Query your knowledge base, share insights, and keep decisions documented.",
  },
]

const plans = [
  {
    name: "Starter",
    price: "$0",
    description: "For individuals exploring document intelligence.",
    features: ["1 workspace", "50 documents", "Basic search", "Email support"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$29",
    description: "For growing teams that live in shared knowledge.",
    features: [
      "Unlimited workspaces",
      "5,000 documents",
      "AI summaries",
      "Priority support",
    ],
    cta: "Start trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$99",
    description: "For organizations with compliance and scale needs.",
    features: [
      "SSO & audit logs",
      "Unlimited documents",
      "Custom retention",
      "Dedicated success",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
]

const testimonials = [
  {
    quote:
      "Documind cut our onboarding research time in half. New hires find answers without pinging half the company.",
    name: "Priya Shah",
    role: "Head of Ops, Northline",
  },
  {
    quote:
      "We finally have one place for contracts and policy docs. Search actually works across everything.",
    name: "Marcus Chen",
    role: "Legal Counsel, Arcadia",
  },
  {
    quote:
      "The summary feature is perfect for exec briefings. What used to take an hour now takes five minutes.",
    name: "Elena Rossi",
    role: "Chief of Staff, Helio",
  },
]

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/new")
  }

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_55%)] opacity-10" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex-1 space-y-6">
            <Badge variant="outline" className="w-fit">
              Document intelligence platform
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn scattered documents into answers your team can use
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Documind helps you search, summarize, and organize PDFs, reports,
              and internal docs so knowledge never gets buried again.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Get started free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Sign in to dashboard</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card required · Setup in under 2 minutes
            </p>
          </div>
          <div className="flex-1">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardDescription>Live preview</CardDescription>
                <CardTitle className="text-xl">Knowledge snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Documents indexed", value: "12,480" },
                    { label: "Queries this week", value: "3,912" },
                    { label: "Avg. answer time", value: "1.4s" },
                    { label: "Team seats", value: "48" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border bg-muted/40 p-4"
                    >
                      <p className="text-2xl font-semibold tabular-nums">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-sm font-medium">Recent query</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    “What are the refund terms in the Q3 vendor agreements?”
                  </p>
                  <p className="mt-3 text-sm">
                    Found in 6 contracts · Summary ready · 3 citations
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b bg-muted/20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
          <p className="text-center text-sm font-medium text-muted-foreground">
            Trusted by product, legal, and operations teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold tracking-wide text-muted-foreground/80">
            {["Northline", "Arcadia", "Helio", "Vector Labs", "Orbit Co"].map(
              (brand) => (
                <span key={brand}>{brand}</span>
              )
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything you need to manage document knowledge
            </h2>
            <p className="text-muted-foreground">
              Dummy feature set for the landing page — replace with your real
              product story when ready.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="shadow-none">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={feature.icon} strokeWidth={2} className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-b bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              How it works
            </h2>
            <p className="text-muted-foreground">
              Three simple steps from upload to answers.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border bg-card p-6 shadow-sm"
              >
                <p className="text-sm font-medium text-primary">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              What teams are saying
            </h2>
            <p className="text-muted-foreground">
              Placeholder testimonials for layout and design.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <Card key={item.name} className="shadow-none">
                <CardContent className="space-y-0 pt-6">
                  <p className="text-sm leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
                  <div className="mt-6">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-b bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Simple pricing
            </h2>
            <p className="text-muted-foreground">
              Dummy plans so the page feels complete. Numbers are not real.
            </p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "border-primary shadow-sm ring-1 ring-primary/20"
                    : "shadow-none"
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlighted ? (
                      <Badge>Popular</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-end gap-1 pt-2">
                    <span className="text-3xl font-semibold">{plan.price}</span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      /month
                    </span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <Link href="/signup">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="rounded-2xl border bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
            <h2 className="text-3xl font-semibold tracking-tight">
              Ready to organize your knowledge base?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Create a free account, upload a few documents, and explore the
              dashboard with sample analytics.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-background text-foreground hover:bg-background/90"
              >
                <Link href="/signup">Create account</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
