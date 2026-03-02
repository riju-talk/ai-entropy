"""
DEPRECATED: shared-secret authentication removed.

This module previously implemented verify_secret for endpoints.
Mindmap / Quiz / Flashcards endpoints no longer require the shared secret.
If any module still imports verify_secret, update that module to remove the dependency.

Left intentionally empty to avoid enforcing auth.
"""
