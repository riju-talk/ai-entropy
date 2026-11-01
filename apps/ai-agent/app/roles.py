"""
Service roles: one image, three deployable services.

SERVICE_ROLE decides which routers a container mounts, so each part can be deployed, scaled and
restarted on its own. "all" (the default) mounts everything, which is the single-service setup.

    tutor      answers questions: the LLM-heavy request path (streaming Q&A, reasoning, evaluation)
    knowledge  owns the stores: documents / vectors, the concept graph, mastery, gamification
    studio     generates study material: quizzes, flashcards, mind maps

The roles share code, not process memory: each one connects to Postgres / Neo4j itself. Keep this
table in sync with ROUTE_ROLES in apps/app/lib/ai-proxy.js (the web app routes requests by prefix).
"""

# (tag, module, url prefix) per role
ROLES = {
    "tutor": [
        ("qa", "app.api.routes.qa", "/qa"),
        ("reasoning", "app.api.routes.reasoning", "/reasoning"),
        ("evaluation", "app.api.routes.evaluation", "/evaluation"),
    ],
    "knowledge": [
        ("documents", "app.api.routes.documents", "/documents"),
        ("graph", "app.api.routes.graph", "/graph"),
        ("mastery", "app.api.routes.mastery", "/mastery"),
        ("gamification", "app.api.routes.gamification", "/gamification"),
    ],
    "studio": [
        ("quiz", "app.api.routes.quiz", "/quiz"),
        ("flashcards", "app.api.routes.flashcards", "/flashcards"),
        ("mindmap", "app.api.routes.mindmap", "/mindmap"),
    ],
}


def routes_for(role: str):
    """Routes to mount for `role`; unknown roles fail loudly at startup rather than serving nothing."""
    if role == "all":
        return [r for rs in ROLES.values() for r in rs]
    if role not in ROLES:
        raise ValueError(f"SERVICE_ROLE must be one of {['all', *ROLES]}, got {role!r}")
    return ROLES[role]
