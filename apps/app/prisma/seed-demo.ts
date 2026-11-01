/**
 * Demo data: accounts, Reddit-style communities with threaded discussion, and Q&A.
 * Idempotent: users and communities are upserted by email / slug, and a community that already has
 * posts is left alone, so re-running never duplicates content.
 *
 * Sign in as any of these with the "Demo accounts" buttons (no password; local/Docker only).
 */
import type { PrismaClient, Subject } from "@prisma/client"

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000)

export const DEMO_USERS = [
  { email: "student@local.dev", name: "Test Student", role: "STUDENT", university: "State University", course: "B.Sc. Computer Science", year: 2 },
  { email: "student2@local.dev", name: "Second Student", role: "STUDENT", university: "State University", course: "B.Sc. Physics", year: 3 },
  { email: "mentor@local.dev", name: "Test Mentor", role: "TEACHER", university: "Tech Institute", course: "PhD Machine Learning", year: 5 },
  { email: "priya@local.dev", name: "Priya Nair", role: "STUDENT", university: "City College", course: "B.Tech Electronics", year: 2 },
  { email: "marcus@local.dev", name: "Marcus Webb", role: "STUDENT", university: "Northern Uni", course: "B.A. Mathematics", year: 4 },
  { email: "elena@local.dev", name: "Elena Rossi", role: "TEACHER", university: "Politecnico", course: "Organic Chemistry", year: 6 },
] as const

type Email = (typeof DEMO_USERS)[number]["email"]
type Reply = { by: Email; body: string; up?: Email[]; down?: Email[]; ago?: number; replies?: Reply[] }
type SeedPost = { by: Email; title: string; body?: string; url?: string; ago: number; up: Email[]; down?: Email[]; pinned?: boolean; comments?: Reply[] }
type SeedCommunity = {
  slug: string
  name: string
  subject: Subject
  description: string
  rules: string[]
  admin: Email
  mods?: Email[]
  members: Email[]
  posts: SeedPost[]
}

const ALL: Email[] = DEMO_USERS.map((u) => u.email)

const COMMUNITIES: SeedCommunity[] = [
  {
    slug: "cs-fundamentals",
    name: "CS Fundamentals",
    subject: "COMPUTER_SCIENCE",
    description: "Data structures, algorithms, systems and the theory underneath. Beginners welcome, hand-waving is not.",
    rules: ["Show what you tried before asking for the answer", "No homework dumps: ask about the idea you are stuck on", "Be kind. Everyone was a beginner once"],
    admin: "mentor@local.dev",
    mods: ["priya@local.dev"],
    members: ALL,
    posts: [
      {
        by: "mentor@local.dev",
        title: "Start here: how to ask a good question (and get a good answer)",
        body: "A good question includes **what you expected**, **what happened**, and **the smallest example** that shows it.\n\nIf you are stuck on a concept rather than a bug, say what you already understand. People can then fill the gap instead of repeating the textbook.",
        ago: 140,
        up: ALL,
        pinned: true,
      },
      {
        by: "student@local.dev",
        title: "Why is binary search O(log n)? I can recite it but I don't feel it",
        body: "I know each step halves the search space, but when I try to prove it I get lost.\n\nIf the array has `n` elements, after `k` steps there are `n / 2^k` left. I stop when that is 1, so `k = log2(n)`. Is that the whole argument, or am I missing something about the worst case?",
        ago: 20,
        up: ["student2@local.dev", "priya@local.dev", "mentor@local.dev", "marcus@local.dev"],
        comments: [
          {
            by: "mentor@local.dev",
            body: "That *is* the whole argument. The part people skip is that `k` must be an integer, so the worst case is `floor(log2 n) + 1` comparisons.\n\nTry it by hand for n = 1, 2, 3, 4, 7, 8 and watch the pattern.",
            up: ["student@local.dev", "student2@local.dev", "priya@local.dev", "marcus@local.dev"],
            ago: 18,
            replies: [
              { by: "student@local.dev", body: "Doing n = 7 by hand finally made it click: 7 -> 3 -> 1 is three looks. Thank you!", up: ["mentor@local.dev", "priya@local.dev"], ago: 17 },
              {
                by: "marcus@local.dev",
                body: "Another way to see it: write n in binary. Each comparison drops one bit, so you need as many steps as there are bits.",
                up: ["student@local.dev", "mentor@local.dev", "student2@local.dev"],
                ago: 15,
                replies: [{ by: "priya@local.dev", body: "That bit-counting view is great. It also explains why 1,000,000 items only need ~20 steps.", up: ["marcus@local.dev"], ago: 12 }],
              },
            ],
          },
          { by: "student2@local.dev", body: "Does this still hold if the array has duplicates?", up: ["student@local.dev"], ago: 10, replies: [{ by: "mentor@local.dev", body: "Yes for finding *a* match. Finding the *first* match needs a small change: keep searching the left half after a hit.", up: ["student2@local.dev", "student@local.dev"], ago: 9 }] },
        ],
      },
      {
        by: "priya@local.dev",
        title: "Hash tables: what actually happens on a collision?",
        body: "Two keys land in the same bucket. Do real implementations chain, probe, or something else? And what happens when the table gets too full?",
        ago: 52,
        up: ["student@local.dev", "student2@local.dev", "mentor@local.dev"],
        comments: [
          { by: "mentor@local.dev", body: "Both exist. Java's `HashMap` chains (and turns long chains into trees), Python's `dict` uses open addressing with probing. Either way the table **resizes** when the load factor passes a threshold, which keeps operations O(1) on average.", up: ["priya@local.dev", "student@local.dev", "marcus@local.dev"], ago: 50 },
        ],
      },
      {
        by: "student2@local.dev",
        title: "Free visualiser for sorting algorithms?",
        url: "https://visualgo.net/en/sorting",
        ago: 90,
        up: ["student@local.dev", "priya@local.dev"],
        down: ["marcus@local.dev"],
        comments: [{ by: "student@local.dev", body: "Pair it with stepping through the code by hand once. The animation alone is easy to forget.", up: ["student2@local.dev"], ago: 88 }],
      },
    ],
  },
  {
    slug: "ml-from-scratch",
    name: "ML From Scratch",
    subject: "COMPUTER_SCIENCE",
    description: "Implement the algorithms yourself: gradient descent, backprop, trees. Great place to test the AI tutor on real questions.",
    rules: ["Post code or math, not screenshots of code", "Say which library versions you use", "Cite the paper or lecture you are following"],
    admin: "mentor@local.dev",
    members: ["mentor@local.dev", "student@local.dev", "student2@local.dev", "marcus@local.dev"],
    posts: [
      {
        by: "student@local.dev",
        title: "Gradient descent diverges when I raise the learning rate. Why?",
        body: "My loss goes `3.2, 9.8, 41.0, nan`. Linear regression, one feature. I assumed a bigger step just means faster.\n\nIs there a simple way to see why it blows up?",
        ago: 8,
        up: ["mentor@local.dev", "student2@local.dev", "marcus@local.dev"],
        comments: [
          {
            by: "mentor@local.dev",
            body: "For a quadratic loss the update is a *multiplier* on your error each step. If the learning rate is too large the multiplier has magnitude > 1, so the error grows instead of shrinking. Past a threshold (2 / the curvature) it diverges.",
            up: ["student@local.dev", "marcus@local.dev"],
            ago: 7,
            replies: [{ by: "student@local.dev", body: "So a smaller step is 'safer', and the sweet spot is just under the threshold?", up: ["mentor@local.dev"], ago: 6 }],
          },
        ],
      },
      {
        by: "marcus@local.dev",
        title: "Why do we normalise features before training?",
        body: "I have house price data with area in square feet (thousands) and rooms (1-6). Does the scale really matter for gradient descent?",
        ago: 30,
        up: ["student@local.dev", "mentor@local.dev"],
        comments: [{ by: "student2@local.dev", body: "Different scales stretch the loss surface into a long narrow valley, so gradient descent zig-zags. Standardising makes it rounder and training converges faster.", up: ["marcus@local.dev", "mentor@local.dev", "student@local.dev"], ago: 28 }],
      },
    ],
  },
  {
    slug: "calculus-corner",
    name: "Calculus Corner",
    subject: "MATHEMATICS",
    description: "Limits, derivatives, integrals and the intuition behind them.",
    rules: ["Write the problem in text or LaTeX", "Explain your attempt", "No answer-only replies"],
    admin: "marcus@local.dev",
    members: ["marcus@local.dev", "student@local.dev", "student2@local.dev", "priya@local.dev"],
    posts: [
      {
        by: "priya@local.dev",
        title: "Intuition for why the derivative of sin x is cos x?",
        body: "I can prove it with the limit definition but it feels like magic. Is there a picture that makes it obvious?",
        ago: 26,
        up: ["marcus@local.dev", "student@local.dev", "student2@local.dev"],
        comments: [
          { by: "marcus@local.dev", body: "Picture a point moving around the unit circle at speed 1. Its height is `sin t`. The vertical part of its velocity is the cosine of the angle, so d/dt sin t = cos t.", up: ["priya@local.dev", "student2@local.dev", "student@local.dev"], ago: 24, replies: [{ by: "priya@local.dev", body: "Velocity on the circle. Yes! That finally makes it feel inevitable.", up: ["marcus@local.dev"], ago: 23 }] },
        ],
      },
      { by: "student@local.dev", title: "When is L'Hopital's rule NOT allowed?", body: "I keep using it on everything. When does it quietly give a wrong answer?", ago: 70, up: ["marcus@local.dev", "priya@local.dev"] },
    ],
  },
  {
    slug: "physics-lab",
    name: "Physics Lab",
    subject: "PHYSICS",
    description: "Mechanics to quantum. Problems, lab reports, and the occasional shower thought.",
    rules: ["Include units", "Draw a free-body diagram before posting mechanics problems"],
    admin: "student2@local.dev",
    members: ["student2@local.dev", "student@local.dev", "mentor@local.dev", "priya@local.dev"],
    posts: [
      {
        by: "student2@local.dev",
        title: "If heavier objects don't fall faster, why does a feather fall slowly?",
        body: "Galileo says all objects fall at the same rate. A feather clearly doesn't. Is it only air resistance?",
        ago: 16,
        up: ["student@local.dev", "priya@local.dev", "mentor@local.dev"],
        comments: [{ by: "mentor@local.dev", body: "Yes, only air resistance. In a vacuum chamber they fall together. Look up the Apollo 15 hammer and feather demo.", up: ["student2@local.dev", "student@local.dev", "priya@local.dev"], ago: 14 }],
      },
    ],
  },
  {
    slug: "study-habits",
    name: "Study Habits",
    subject: "PSYCHOLOGY",
    description: "What actually works for learning: spaced repetition, focus, sleep, and beating procrastination.",
    rules: ["Share evidence or your own experience, label which it is", "No productivity-guru spam"],
    admin: "student@local.dev",
    mods: ["elena@local.dev"],
    members: ALL,
    posts: [
      {
        by: "student@local.dev",
        title: "Pomodoro vs. 90-minute blocks: what works for you?",
        body: "I have been using 25/5 for a month. Good for emails, but deep work keeps getting cut off just as I get going. Anyone switched to longer blocks?",
        ago: 12,
        up: ["student2@local.dev", "priya@local.dev", "elena@local.dev", "marcus@local.dev"],
        comments: [
          { by: "elena@local.dev", body: "I do 50/10 for problem sets and 25/5 for reading. Match the block to the task, not the other way around.", up: ["student@local.dev", "priya@local.dev", "student2@local.dev"], ago: 11 },
          { by: "priya@local.dev", body: "Try the focus timer in the app tied to one topic: seeing the totals per topic changed how I plan my week.", up: ["student@local.dev"], ago: 9 },
        ],
      },
      { by: "elena@local.dev", title: "Spaced repetition beats re-reading. Here is the 10-minute setup", body: "1. Turn every confusing idea into a question.\n2. Review them after 1 day, 3 days, 7 days.\n3. Delete the ones that feel boring.\n\nThat is it. The flashcards in the AI study area will generate the questions for you.", ago: 100, up: ["student@local.dev", "student2@local.dev", "priya@local.dev", "marcus@local.dev"] },
    ],
  },
  {
    slug: "orgo-survivors",
    name: "Orgo Survivors",
    subject: "CHEMISTRY",
    description: "Mechanisms, reactions and moral support for organic chemistry.",
    rules: ["Draw the mechanism arrows", "Name the reaction type in the title"],
    admin: "elena@local.dev",
    members: ["elena@local.dev", "student2@local.dev", "priya@local.dev"],
    posts: [
      {
        by: "priya@local.dev",
        title: "SN1 vs SN2: a quick way to decide?",
        body: "Exams give me a substrate and a nucleophile and I freeze. What is your checklist?",
        ago: 44,
        up: ["elena@local.dev", "student2@local.dev"],
        comments: [{ by: "elena@local.dev", body: "Check the **substrate** first: methyl/primary -> SN2, tertiary -> SN1, secondary -> look at nucleophile and solvent. Strong nucleophile + polar aprotic solvent leans SN2.", up: ["priya@local.dev", "student2@local.dev"], ago: 40 }],
      },
    ],
  },
]

const QA = [
  {
    by: "student@local.dev" as Email,
    title: "What is the difference between a process and a thread?",
    content: "My OS course uses both words almost interchangeably. What is actually different, and when would I pick one over the other?",
    subject: "COMPUTER_SCIENCE",
    tags: ["operating-systems", "concurrency"],
    ago: 36,
    answers: [
      { by: "mentor@local.dev" as Email, content: "A **process** has its own memory space; **threads** inside a process share it. Sharing makes threads cheap to create and to communicate between, but one thread can corrupt another's data, hence locks.\n\nUse processes for isolation, threads for shared-state parallel work.", accepted: true, up: 6 },
      { by: "priya@local.dev" as Email, content: "Think of a process as a house and threads as the people living in it: they share the kitchen (memory) but each has their own bed (stack).", accepted: false, up: 3 },
    ],
  },
  {
    by: "student2@local.dev" as Email,
    title: "How do I find the center of mass of an L-shaped plate?",
    content: "Uniform plate, made from two rectangles. I know the formula for each rectangle, but how do I combine them?",
    subject: "PHYSICS",
    tags: ["mechanics", "center-of-mass"],
    ago: 60,
    answers: [{ by: "mentor@local.dev" as Email, content: "Split it into the two rectangles, treat each as a point mass at its own center with mass proportional to its area, then take the area-weighted average of the coordinates.", accepted: true, up: 4 }],
  },
  {
    by: "priya@local.dev" as Email,
    title: "Is a Fourier transform just a change of basis?",
    content: "My signals teacher says it is 'just a change of basis' and moves on. Can someone unpack that?",
    subject: "MATHEMATICS",
    tags: ["signals", "linear-algebra"],
    ago: 6,
    answers: [],
  },
]

export async function seedDemo(prisma: PrismaClient) {
  console.log("Seeding demo users...")
  const users = new Map<Email, string>()
  for (const u of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, role: u.role, university: u.university, course: u.course, year: u.year },
    })
    users.set(u.email, row.id)
  }
  const id = (e: Email) => users.get(e)!

  await prisma.mentorProfile.upsert({
    where: { userId: id("mentor@local.dev") },
    update: {},
    create: {
      userId: id("mentor@local.dev"),
      headline: "ML researcher who likes explaining the why",
      bio: "I help students build intuition for algorithms and machine learning before touching the formulas.",
      university: "Tech Institute",
      subjects: ["COMPUTER_SCIENCE", "MATHEMATICS"],
      expertise: ["algorithms", "machine learning", "linear algebra"],
      availability: "Weekday evenings",
    },
  })

  console.log("Seeding communities...")
  for (const c of COMMUNITIES) {
    const community = await prisma.community.upsert({
      where: { slug: c.slug },
      update: { description: c.description, rules: c.rules },
      create: { slug: c.slug, name: c.name, description: c.description, subject: c.subject, rules: c.rules, createdBy: id(c.admin) },
    })

    for (const email of c.members) {
      const role = email === c.admin ? "ADMIN" : c.mods?.includes(email) ? "MODERATOR" : "MEMBER"
      await prisma.communityMember.upsert({
        where: { userId_communityId: { userId: id(email), communityId: community.id } },
        update: { role },
        create: { userId: id(email), communityId: community.id, role },
      })
    }

    if ((await prisma.post.count({ where: { communityId: community.id } })) > 0) continue

    for (const p of c.posts) {
      const post = await prisma.post.create({
        data: { communityId: community.id, authorId: id(p.by), title: p.title, body: p.body ?? null, url: p.url ?? null, isPinned: !!p.pinned, createdAt: hoursAgo(p.ago) },
      })
      const up = new Set<Email>([p.by, ...p.up])
      const down = (p.down ?? []).filter((e) => !up.has(e))
      await prisma.postVote.createMany({
        data: [...[...up].map((e) => ({ postId: post.id, userId: id(e), value: 1 })), ...down.map((e) => ({ postId: post.id, userId: id(e), value: -1 }))],
      })
      let total = 0
      const addComments = async (list: Reply[], parentId: string | null, parentAgo: number) => {
        for (const r of list) {
          const ago = r.ago ?? Math.max(parentAgo - 1, 1)
          const cm = await prisma.comment.create({ data: { postId: post.id, authorId: id(r.by), parentId, body: r.body, createdAt: hoursAgo(ago) } })
          total++
          const cu = new Set<Email>([r.by, ...(r.up ?? [])])
          const cd = (r.down ?? []).filter((e) => !cu.has(e))
          await prisma.commentVote.createMany({
            data: [...[...cu].map((e) => ({ commentId: cm.id, userId: id(e), value: 1 })), ...cd.map((e) => ({ commentId: cm.id, userId: id(e), value: -1 }))],
          })
          await prisma.comment.update({ where: { id: cm.id }, data: { score: cu.size - cd.length } })
          if (r.replies) await addComments(r.replies, cm.id, ago)
        }
      }
      await addComments(p.comments ?? [], null, p.ago)
      await prisma.post.update({ where: { id: post.id }, data: { score: up.size - down.length, commentCount: total } })
    }
  }

  console.log("Seeding questions...")
  for (const q of QA) {
    if (await prisma.doubt.findFirst({ where: { title: q.title }, select: { id: true } })) continue
    const doubt = await prisma.doubt.create({
      data: {
        title: q.title,
        content: q.content,
        subject: q.subject,
        tags: q.tags,
        authorId: id(q.by),
        isResolved: q.answers.some((a) => a.accepted),
        upvotes: 3 + q.answers.length,
        views: 20 + q.answers.length * 15,
        createdAt: hoursAgo(q.ago),
      },
    })
    for (const a of q.answers) {
      await prisma.answer.create({
        data: { doubtId: doubt.id, authorId: id(a.by), content: a.content, isAccepted: a.accepted, upvotes: a.up, createdAt: hoursAgo(Math.max(q.ago - 2, 1)) },
      })
    }
  }
}
