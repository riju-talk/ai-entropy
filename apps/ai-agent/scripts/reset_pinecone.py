"""
Delete EVERY vector in the Pinecone index (all namespaces). Irreversible.

    PINECONE_API_KEY=... python scripts/reset_pinecone.py            # dry run: shows what would be deleted
    PINECONE_API_KEY=... python scripts/reset_pinecone.py --yes      # actually deletes

Reads PINECONE_API_KEY / PINECONE_INDEX_NAME / PINECONE_HOST from the environment or apps/ai-agent/.env.
The index itself is kept (same dimension and metric), only its contents go. Postgres doc_chunks are NOT touched.
"""
import sys
from pathlib import Path

from dotenv import dotenv_values, load_dotenv
import os

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
key = os.environ.get("PINECONE_API_KEY", "")
name = os.environ.get("PINECONE_INDEX_NAME", "entropy-ai")
host = os.environ.get("PINECONE_HOST", "")

if not key or "*" in key:
    sys.exit("PINECONE_API_KEY is missing (or still masked). Set the real key and retry.")

from pinecone import Pinecone

pc = Pinecone(api_key=key)
if not host and name not in {i["name"] for i in pc.list_indexes()}:
    sys.exit(f"Index {name!r} does not exist - nothing to delete.")
index = pc.Index(host=host) if host else pc.Index(name)

stats = index.describe_index_stats()
namespaces = stats.get("namespaces") or {}
print(f"Index {name!r}: {stats.get('total_vector_count', 0)} vectors in {len(namespaces)} namespace(s)")
for ns, info in namespaces.items():
    print(f"  {ns or '(default)'}: {info.get('vector_count', 0)}")

if "--yes" not in sys.argv:
    sys.exit("Dry run. Re-run with --yes to delete all of the above.")

for ns in namespaces or {""}:
    index.delete(delete_all=True, namespace=ns)
after = index.describe_index_stats()
print(f"Done. Vectors remaining: {after.get('total_vector_count', 0)} (stats can lag a few seconds)")
