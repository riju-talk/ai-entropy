# Entropy - what's left (as of 2026-11-13)

Live: web https://entropy-app-psi.vercel.app | Postgres on Neon | pictures in Neon S3 bucket `entropy-pictures`.
Demo data: seeded with `apps/app/prisma/seed-showcase.ts` (22 people, mentors, 12 happenings, 12 communities, Q&A, leaderboard).

- [x] UI interaction pass: skip link, press/hover feedback, 44px touch targets, Ctrl/Cmd+K palette, stat hero, shimmer skeletons.
- [x] Neon Postgres: schema pushed, `DATABASE_URL` (pooled) + `DIRECT_URL` set on Vercel.
- [x] Picture uploads for questions and community posts (`/api/uploads`, private bucket + signed URLs). Tested against the bucket; not yet tested in the browser.

- [ ] **Render AI service**: not deployed (no Render API key here). New > Blueprint on `apps/ai-agent/render.yaml`, then set `BACKEND_URL` on Vercel.
- [ ] **AI_BACKEND_TOKEN**: Vercel has a random value; Render must use the same one.
- [ ] **OAuth sign-in**: set GOOGLE_CLIENT_ID/SECRET and GITHUB_ID/SECRET on Vercel; add https://entropy-app-psi.vercel.app/api/auth/callback/{google,github} in each console. Without this nobody can sign in, so uploads/asking can't be demoed.
- [ ] **Demo login**: `ENABLE_DEV_LOGIN` is off in production. Decide whether to enable a demo account for presentations.
- [ ] **AI features**: Groq, Pinecone, Neo4j, Tavily, Supabase Storage keys unset (document upload, AI chat, knowledge graph).
- [ ] **Rotate** the Neon DB password and the Neon S3 key/secret (both were pasted in chat); update Vercel env vars.
- [ ] **Verify in browser**: home stats, leaderboard, happenings, mentorship, a picture upload on /ask and in a community post.
- [ ] **Uploads follow-ups**: images only render inside Markdown (questions, answers, posts); add delete/orphan cleanup and image validation by magic bytes.
- [ ] Per-page UI polish (ask, profile, AI study, mentorship) and a real `public/og-image.png`.
- [ ] Cleanup: root `.vercel/` and `.env.local` were created by `vercel link` (git-ignored); `Hostiggo-env` Supabase project is a different app, leave alone.
