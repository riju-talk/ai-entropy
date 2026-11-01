// End-to-end simulation against a running stack (docker compose up).
//   node scripts/simulate.mjs                 everything
//   node scripts/simulate.mjs --skip-ai       community + auth only (no LLM calls)
//
// Signs in through the real NextAuth flow with the demo accounts, then plays out real usage:
// create a community, join, post, comment in a thread, vote, moderate, and the failure cases
// (signed out, not a member, duplicates, bad input). The AI half uploads a document, asks about it
// over the streaming endpoint and checks retrieval, citations, the knowledge graph and stage timings.
//
// Exit code 0 only if every check passed.

const WEB = process.env.WEB_URL || "http://localhost:5000"
const AI = process.env.AI_URL || "http://localhost:8000"
const skipAi = process.argv.includes("--skip-ai")

let passed = 0
const failures = []
const ok = (cond, name, detail = "") => {
  if (cond) {
    passed++
    console.log(`  \x1b[32mok\x1b[0m   ${name}`)
  } else {
    failures.push(name)
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}${detail ? `  (${detail})` : ""}`)
  }
}
const section = (t) => console.log(`\n${t}`)

// ── tiny session with a cookie jar ────────────────────────────────────────────────────────────
class Session {
  constructor(label) {
    this.label = label
    this.cookies = new Map()
  }
  _store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";")
      const i = pair.indexOf("=")
      const name = pair.slice(0, i).trim()
      const val = pair.slice(i + 1)
      if (val === "" || /max-age=0/i.test(c)) this.cookies.delete(name)
      else this.cookies.set(name, val)
    }
  }
  async req(path, { method = "GET", json, form, body, headers = {} } = {}) {
    const h = { ...headers }
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ")
    let payload = body
    if (json !== undefined) {
      h["content-type"] = "application/json"
      payload = JSON.stringify(json)
    } else if (form) {
      h["content-type"] = "application/x-www-form-urlencoded"
      payload = new URLSearchParams(form).toString()
    }
    const res = await fetch(WEB + path, { method, headers: h, body: payload, redirect: "manual" })
    this._store(res)
    return res
  }
  async json(path, opts) {
    const res = await this.req(path, opts)
    let data = null
    try {
      data = await res.json()
    } catch {
      /* not json */
    }
    return { status: res.status, data }
  }
  async signIn(email, name) {
    const { data: csrf } = await this.json("/api/auth/csrf")
    const res = await this.req("/api/auth/callback/dev-login", { method: "POST", form: { csrfToken: csrf.csrfToken, email, name, json: "true", callbackUrl: WEB } })
    await res.text().catch(() => {})
    const { data: session } = await this.json("/api/auth/session")
    this.user = session?.user
    return this.user
  }
}

const rand = Math.random().toString(36).slice(2, 7)

async function main() {
  console.log(`Simulating against ${WEB} (AI service ${AI})`)

  // ── 0. health ───────────────────────────────────────────────────────────────────────────────
  section("0. Services")
  const anon = new Session("anon")
  const web = await anon.json("/api/health")
  ok(web.status === 200, "web app is up")
  const health = await fetch(AI + "/health").then((r) => r.json()).catch(() => null)
  ok(!!health, "AI service answers /health")
  if (health) {
    ok(health.postgres_connected === true, "AI service is connected to Postgres")
    ok(health.neo4j_connected === true, "AI service is connected to Neo4j", `neo4j=${health.neo4j_connected}`)
  }
  // The AI backend is split into three roles; each must report itself and serve only its own routes
  for (const [port, role, own, foreign] of [[8000, "tutor", "/api/qa/health", "/api/quiz/"], [8001, "knowledge", "/api/graph/nodes", "/api/qa/health"], [8002, "studio", "/api/quiz/", "/api/documents/"]]) {
    const h = await fetch(`http://localhost:${port}/health`).then((r) => r.json()).catch(() => null)
    ok(h?.role === role, `AI ${role} service is up on :${port}`, JSON.stringify(h?.role))
    const hdr = { "X-Internal-Token": process.env.AI_TOKEN || "demo-internal-token" }
    const mine = await fetch(`http://localhost:${port}${own}`, { headers: hdr }).catch(() => null)
    const other = await fetch(`http://localhost:${port}${foreign}`, { headers: hdr }).catch(() => null)
    ok(mine && mine.status !== 404, `${role} serves ${own}`, String(mine?.status))
    ok(other?.status === 404, `${role} does NOT serve ${foreign} (belongs to another role)`, String(other?.status))
  }
  const provs = await anon.json("/api/auth/providers")
  ok(!!provs.data?.["dev-login"], "demo login is offered", Object.keys(provs.data || {}).join(","))

  // ── 1. auth ────────────────────────────────────────────────────────────────────────────────
  section("1. Sign-in and protected routes")
  const redirect = await anon.req("/ask")
  ok(redirect.status === 307 && /\/auth\/signin/.test(redirect.headers.get("location") || ""), "signed-out visitor is redirected from /ask to sign-in")
  const unauth = await anon.json("/api/communities", { method: "POST", json: { name: "Nope Nope" } })
  ok(unauth.status === 401, "signed-out user cannot create a community (401)", String(unauth.status))

  const badLogin = new Session("bad")
  await badLogin.signIn("someone@gmail.com", "Eve")
  ok(!badLogin.user, "demo login rejects non-@local.dev emails")

  const student = new Session("student")
  const student2 = new Session("student2")
  const mentor = new Session("mentor")
  await student.signIn("student@local.dev", "Test Student")
  await student2.signIn("student2@local.dev", "Second Student")
  await mentor.signIn("mentor@local.dev", "Test Mentor")
  ok(student.user?.email === "student@local.dev", "student signed in", JSON.stringify(student.user))
  ok(!!student.user?.id && student2.user?.id !== student.user?.id, "two distinct accounts")
  const redirect2 = await student.req("/ask")
  ok(redirect2.status === 200, "signed-in user can open /ask (cookie accepted by middleware)", String(redirect2.status))

  // ── 2. seeded data ─────────────────────────────────────────────────────────────────────────
  section("2. Seeded communities")
  const list = await student.json("/api/communities?limit=50")
  ok(Array.isArray(list.data) && list.data.length >= 6, `communities listed (${list.data?.length})`)
  const cs = list.data?.find((c) => c.slug === "cs-fundamentals")
  ok(!!cs && cs.memberCount >= 5 && cs.isMember, "cs-fundamentals has members and the student has joined")
  const feed = await student.json("/api/feed?sort=hot")
  ok(feed.data?.posts?.length > 0 && feed.data.posts.every((p) => p.community?.slug), "global feed returns posts with their community")
  const csPosts = await student.json("/api/communities/cs-fundamentals/posts?sort=hot")
  ok(csPosts.data?.posts?.[0]?.isPinned === true, "pinned post sorts first")
  const thread = csPosts.data?.posts?.find((p) => /binary search/i.test(p.title))
  const cmts = thread ? await student.json(`/api/communities/cs-fundamentals/posts/${thread.id}/comments`) : null
  ok(cmts?.data?.comments?.some((c) => c.parentId), "seeded thread has nested replies")
  ok(cmts?.data?.comments?.every((c) => typeof c.myVote === "number"), "comments include the viewer's own vote")

  // ── 3. community lifecycle ─────────────────────────────────────────────────────────────────
  section("3. Community lifecycle (create, join, post, comment, vote, moderate)")
  const name = `Sim Lab ${rand}`
  const created = await student.json("/api/communities", { method: "POST", json: { name, description: "Created by the simulation", subject: "PHYSICS", rules: ["Be kind", "Show your work"] } })
  ok(created.status === 201 && created.data?.community?.slug, "student creates a community", JSON.stringify(created.data))
  const slug = created.data?.community?.slug
  const dup = await student.json("/api/communities", { method: "POST", json: { name } })
  ok(dup.status === 409, "duplicate community name is rejected (409)", String(dup.status))
  const tooShort = await student.json("/api/communities", { method: "POST", json: { name: "x" } })
  ok(tooShort.status === 400, "name that is too short is rejected (400)")
  const notJson = await student.req("/api/communities", { method: "POST", body: "not json", headers: { "content-type": "application/json" } })
  ok(notJson.status === 400, "malformed JSON body is a clean 400, not a 500", String(notJson.status))

  const detail = await student.json(`/api/communities/${slug}`)
  ok(detail.data?.role === "ADMIN" && detail.data.memberCount === 1 && detail.data.rules.length === 2, "creator is admin, 1 member, rules saved")

  const outsiderPost = await student2.json(`/api/communities/${slug}/posts`, { method: "POST", json: { title: "Hello there", body: "I am not a member" } })
  ok(outsiderPost.status === 403, "non-member cannot post (403)", String(outsiderPost.status))
  const join = await student2.json(`/api/communities/${slug}/membership`, { method: "POST" })
  ok(join.data?.isMember && join.data.memberCount === 2, "second student joins (2 members)")
  const joinAgain = await student2.json(`/api/communities/${slug}/membership`, { method: "POST" })
  ok(joinAgain.data?.memberCount === 2, "joining twice is idempotent")

  const noContent = await student2.json(`/api/communities/${slug}/posts`, { method: "POST", json: { title: "Empty post" } })
  ok(noContent.status === 400, "post with no text or link is rejected (400)")
  const badLink = await student2.json(`/api/communities/${slug}/posts`, { method: "POST", json: { title: "Bad link", url: "javascript:alert(1)" } })
  ok(badLink.status === 400, "javascript: link is rejected (400)")
  const posted = await student2.json(`/api/communities/${slug}/posts`, { method: "POST", json: { title: "Why do objects fall at the same rate?", body: "Ignoring air, does mass matter?" } })
  ok(posted.status === 201 && posted.data?.post?.score === 1, "member posts (author's own upvote counted)")
  const pid = posted.data?.post?.id

  const up = await student.json(`/api/communities/${slug}/posts/${pid}/vote`, { method: "POST", json: { value: 1 } })
  ok(up.data?.score === 2 && up.data.myVote === 1, "upvote raises score to 2")
  const flip = await student.json(`/api/communities/${slug}/posts/${pid}/vote`, { method: "POST", json: { value: -1 } })
  ok(flip.data?.score === 0, "switching to downvote moves score by 2 (author +1, voter -1 = 0)", JSON.stringify(flip.data))
  const clear = await student.json(`/api/communities/${slug}/posts/${pid}/vote`, { method: "POST", json: { value: 0 } })
  ok(clear.data?.score === 1, "clearing the vote returns to 1")
  const badVote = await student.json(`/api/communities/${slug}/posts/${pid}/vote`, { method: "POST", json: { value: 5 } })
  ok(badVote.status === 400, "vote value 5 is rejected (400)")
  const anonVote = await anon.json(`/api/communities/${slug}/posts/${pid}/vote`, { method: "POST", json: { value: 1 } })
  ok(anonVote.status === 401, "signed-out vote is rejected (401)")

  const c1 = await student.json(`/api/communities/${slug}/posts/${pid}/comments`, { method: "POST", json: { body: "No, mass cancels out." } })
  ok(c1.status === 201, "admin comments on the post")
  const c2 = await student2.json(`/api/communities/${slug}/posts/${pid}/comments`, { method: "POST", json: { body: "Why does it cancel?", parentId: c1.data?.comment?.id } })
  ok(c2.status === 201 && c2.data.comment.parentId === c1.data.comment.id, "reply is nested under the comment")
  const c3 = await student.json(`/api/communities/${slug}/posts/${pid}/comments`, { method: "POST", json: { body: "F=ma and F=mg, so a=g.", parentId: c2.data?.comment?.id } })
  ok(c3.status === 201, "third-level reply")
  const orphan = await student.json(`/api/communities/${slug}/posts/${pid}/comments`, { method: "POST", json: { body: "x", parentId: "does-not-exist" } })
  ok(orphan.status === 404, "reply to a missing comment is a clean 404", String(orphan.status))
  const empty = await student.json(`/api/communities/${slug}/posts/${pid}/comments`, { method: "POST", json: { body: "   " } })
  ok(empty.status === 400, "blank comment is rejected (400)")

  const cv = await student2.json(`/api/communities/${slug}/posts/${pid}/comments/${c1.data.comment.id}/vote`, { method: "POST", json: { value: 1 } })
  ok(cv.data?.score === 2, "comment upvote works")
  const after = await student.json(`/api/communities/${slug}/posts/${pid}/comments`)
  ok(after.data?.comments?.length === 3, "thread has 3 comments")
  const postNow = await student.json(`/api/communities/${slug}/posts?sort=new`)
  ok(postNow.data?.posts?.[0]?.commentCount === 3, "post's comment count is 3")

  const notMod = await student2.json(`/api/communities/${slug}/posts/${pid}`, { method: "PATCH", json: { isPinned: true } })
  ok(notMod.status === 403, "regular member cannot pin (403)")
  const pin = await student.json(`/api/communities/${slug}/posts/${pid}`, { method: "PATCH", json: { isPinned: true } })
  ok(pin.data?.isPinned === true, "admin pins the post")

  const strangerDel = await mentor.json(`/api/communities/${slug}/posts/${pid}/comments/${c2.data.comment.id}`, { method: "DELETE" })
  ok(strangerDel.status === 403, "an outsider cannot remove someone's comment (403)", String(strangerDel.status))
  const modDel = await student.json(`/api/communities/${slug}/posts/${pid}/comments/${c2.data.comment.id}`, { method: "DELETE" })
  ok(modDel.data?.removed === true, "admin removes a comment")
  const afterDel = await student.json(`/api/communities/${slug}/posts/${pid}/comments`)
  const removed = afterDel.data?.comments?.find((c) => c.id === c2.data.comment.id)
  ok(removed?.body === "[removed]" && removed.author === null, "removed comment keeps its place but loses text and author")
  ok(afterDel.data?.comments?.some((c) => c.id === c3.data.comment.id), "replies under a removed comment survive")

  const lastAdmin = await student.json(`/api/communities/${slug}/membership`, { method: "DELETE" })
  ok(lastAdmin.status === 409, "the only admin cannot leave (409)", String(lastAdmin.status))
  const leave = await student2.json(`/api/communities/${slug}/membership`, { method: "DELETE" })
  ok(leave.data?.isMember === false && leave.data.memberCount === 1, "member leaves (1 member left)")
  const missing = await student.json("/api/communities/no-such-community-xyz")
  ok(missing.status === 404, "unknown community is 404")

  // clean up so repeated runs do not pile up in the demo data
  const strangerDelete = await student2.json(`/api/communities/${slug}`, { method: "DELETE" })
  ok(strangerDelete.status === 403, "a non-admin cannot delete the community (403)", String(strangerDelete.status))
  const del = await student.json(`/api/communities/${slug}`, { method: "DELETE" })
  ok(del.data?.deleted === true, "admin deletes the community (posts and comments cascade)")
  ok((await student.json(`/api/communities/${slug}`)).status === 404, "deleted community is gone (404)")

  if (skipAi) return summary()

  // ── 4. AI: documents, retrieval, streaming, graph ──────────────────────────────────────────
  section("4. AI tutor (documents -> retrieval -> streamed answer -> graph)")
  const unauthAi = await anon.req("/api/ai-agent/qa/stream", { method: "POST", json: { question: "hi" } })
  ok(unauthAi.status === 401, "AI endpoint requires sign-in (401)")

  const fileText = [
    "Zorblax Protocol Handbook.",
    "The Zorblax protocol defines three phases: Handshake, Quorum and Commit.",
    "In the Quorum phase, at least 7 of 11 nodes must acknowledge a proposal before it can be committed.",
    "The Zorblax heartbeat interval is 450 milliseconds, and a node missing 3 heartbeats is marked suspect.",
  ].join("\n")
  const fd = new FormData()
  fd.append("files", new Blob([fileText], { type: "text/plain" }), "zorblax-handbook.txt")
  const up1 = await student.req("/api/ai-agent/documents", { method: "POST", body: fd })
  const upBody = await up1.json().catch(() => ({}))
  ok(up1.status === 200 && (upBody.count ?? upBody.chunks ?? 0) >= 0 && !upBody.error, "document upload succeeds", `${up1.status} ${JSON.stringify(upBody).slice(0, 160)}`)

  const t0 = Date.now()
  const stages = []
  let ttft = null
  let streamed = ""
  let finalPayload = null
  let streamError = null
  const res = await student.req("/api/ai-agent/qa/stream", { method: "POST", json: { question: "In the Zorblax protocol, how many nodes must acknowledge a proposal in the Quorum phase?", language: "en" } })
  ok(res.status === 200 && /text\/event-stream/.test(res.headers.get("content-type") || ""), "stream responds as text/event-stream", `${res.status} ${res.headers.get("content-type")}`)
  if (res.status === 200) {
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let cut
      while ((cut = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, cut)
        buf = buf.slice(cut + 2)
        const ev = /^event: (.+)$/m.exec(block)?.[1]
        const raw = /^data: (.+)$/m.exec(block)?.[1]
        if (!ev || !raw) continue
        const data = JSON.parse(raw)
        if (ev === "token") {
          if (ttft === null) ttft = Date.now() - t0
          streamed += data.text
        } else if (ev === "stage" && data.status !== "start") stages.push(data)
        else if (ev === "final") finalPayload = data
        else if (ev === "error") streamError = data
      }
    }
  } else {
    streamError = await res.json().catch(() => ({}))
  }

  if (streamError) {
    ok(false, "AI answer streamed", `${streamError.message || streamError.error}`)
  } else {
    ok(streamed.length > 80, `answer streamed token by token (${streamed.length} chars)`)
    ok(ttft !== null && ttft < 8000, `first token in ${ttft} ms`, `${ttft}`)
    ok(finalPayload?.answer === streamed, "final payload matches the streamed text")
    const names = stages.map((s) => s.name)
    ok(["normalize", "understand", "graph", "learner", "documents", "web", "generate", "verify"].every((n) => names.includes(n)), "all 8 pipeline stages reported", names.join(","))
    ok(stages.every((s) => s.status === "done"), "every stage completed (none errored or timed out)", stages.filter((s) => s.status !== "done").map((s) => `${s.name}:${s.status}`).join(","))
    console.log("       " + stages.map((s) => `${s.name} ${s.ms}ms${s.status !== "done" ? `(${s.status})` : ""}`).join(" | "))
    console.log(`       total ${Date.now() - t0} ms; model concept="${finalPayload?.concept}" intent=${finalPayload?.cognitive_trace?.intent}`)
    ok(/\b7\b|seven/i.test(streamed), "answer uses the uploaded document (7 of 11 nodes)", streamed.slice(0, 160).replace(/\n/g, " "))
    ok(finalPayload?.sources?.some((s) => s.type === "document"), "answer cites the uploaded document", JSON.stringify(finalPayload?.sources?.map((s) => s.type)))
    ok(["PASS", "REVIEW", "FLAG"].includes(finalPayload?.nli_verdict), `verification ran (${finalPayload?.nli_verdict})`)
    ok(Array.isArray(finalPayload?.hint_ladder) && Array.isArray(finalPayload?.stepwise_reasoning), "study aids (steps, hints) returned")
  }

  const generic = []
  await (async () => {
    const r = await student.req("/api/ai-agent/qa/stream", { method: "POST", json: { question: "Explain gradient descent briefly" } })
    const text = await r.text()
    const fin = /event: final\ndata: (.+)/.exec(text)?.[1]
    generic.push(fin ? JSON.parse(fin) : null)
  })()
  ok(!!generic[0]?.answer, "a general question (no documents) is answered too")
  ok(!!generic[0]?.concept, "a concept was identified for it", JSON.stringify(generic[0]?.graph)?.slice(0, 120))

  await new Promise((r) => setTimeout(r, 2500)) // graph growth + persistence run after the answer
  const conv = await student.json(`/api/ai-agent/conversations?user_id=${student.user.id}`)
  ok(conv.status === 200 && JSON.stringify(conv.data).includes("Zorblax"), "the exchange was saved to the conversation history", String(conv.status))
  const nodes = await student.json("/api/ai-agent/graph?action=nodes")
  ok(nodes.status === 200, "knowledge graph endpoint answers", String(nodes.status))

  const empty2 = await student.json("/api/ai-agent/qa/stream", { method: "POST", json: { question: "   " } })
  ok(empty2.status === 400, "empty question is rejected (400)")
  const huge = await student.json("/api/ai-agent/qa/stream", { method: "POST", json: { question: "a".repeat(5000) } })
  ok(huge.status === 400, "oversized question is rejected (400)")

  return summary()
}

function summary() {
  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log("Failed:\n  - " + failures.join("\n  - "))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("\nSimulation crashed:", e)
  process.exit(2)
})
