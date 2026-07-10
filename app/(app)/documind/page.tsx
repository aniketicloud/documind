import { redirect } from "next/navigation"

/** Legacy route — Documind chat now starts at /new */
export default function DocumindRedirectPage() {
  redirect("/new")
}
