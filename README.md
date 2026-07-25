# Documind

Document intelligence app: multi-chat, document upload to S3-compatible storage (RustFS), owner-scoped files, Better Auth, and local Docker infrastructure (Postgres, Redis, RustFS, Qdrant).

## Documentation

Full docs live in a **separate** Fumadocs site:

- Local: sibling repo `../documind-docs` → `npm run dev` → [http://localhost:3001/docs](http://localhost:3001/docs)  
- Production: deploy `documind-docs` to Vercel (see that repo’s README)

## Quick start

```bash
cp example.env .env
docker compose up -d
npm install
npm run db:push
npm run dev
# separate terminal — document ingest worker (Option A)
npm run worker:ingest
```

App: [http://localhost:3000](http://localhost:3000)

Without `worker:ingest`, uploads still work but documents stay `processing` until a worker runs.

**What is ingest / why the worker?**  
See docs: [Document ingest (Option A)](../documind-docs/content/docs/guide/document-ingest.mdx)  
(or run docs site → Guide → Document ingest).

| Port | Service |
|------|---------|
| 3000 | Next.js app |
| 5433 | Postgres |
| 6379 | Redis |
| 9000 / 9001 | RustFS API / console |
| 6335 | Qdrant |

Default RustFS credentials: `rustfsadmin` / `rustfsadmin`.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui  
- Better Auth + Drizzle + Postgres  
- RustFS (S3) presigned uploads  
- Redis (demo + future jobs)  
- Qdrant (provisioned for future RAG)  

## License

Private / project-specific unless otherwise stated.
