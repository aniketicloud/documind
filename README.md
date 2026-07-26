# Documind

Document intelligence app: multi-chat, document upload to S3-compatible storage (RustFS), owner-scoped files, Better Auth, RAG over text files and **text-based PDFs**, and local Docker infrastructure.

## Documentation

Full docs live in a **separate** Fumadocs site:

- Local: sibling repo `../documind-docs` → `npm run dev` → [http://localhost:3001/docs](http://localhost:3001/docs)  
- Production: deploy `documind-docs` to Vercel (see that repo’s README)

## Quick start

```bash
cp example.env .env
# set GEMINI_API_KEY (and optional ZAI_API_KEY) in .env
docker compose up -d
# starts Postgres, Redis, Qdrant, RustFS, pdf-extract, ingest-worker
npm install
npm run db:push
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

Only **one** app terminal is required. Document ingest and PDF text extraction run inside Compose (`ingest-worker`, `pdf-extract`).

**Ingest / PDF / embeddings:** see docs Guide → Document ingest, PDF extract, Embeddings & Qdrant.

| Port | Service |
|------|---------|
| 3000 | Next.js app |
| 5433 | Postgres |
| 6379 | Redis |
| 9000 / 9001 | RustFS API / console |
| 6335 | Qdrant |
| 8090 | PDF extract (PyMuPDF) |

Default RustFS credentials: `rustfsadmin` / `rustfsadmin`.

## What works for chat (RAG)

| Format | Notes |
|--------|--------|
| `.txt`, `.md`, `.csv` | Extracted in the Node worker |
| **Text-based PDF** | Extracted via Docker `pdf-extract` (PyMuPDF) |
| Scanned / image PDF | `failed` until OCR (F1b) |
| DOCX / XLSX (binary) | Storage OK; full text extract later |

Pin **indexed** docs to a chat, then ask questions.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui  
- Better Auth + Drizzle + Postgres  
- RustFS (S3) presigned uploads  
- Redis job queue + Docker ingest worker  
- Qdrant vectors + Gemini embeddings  
- Streaming chat (Z.AI / Gemini Interactions)  

## License

Private / project-specific unless otherwise stated.
