"""
Services package initialization
Force import of langchain_service to ensure it's initialized
"""
import logging

logger = logging.getLogger(__name__)

print("=" * 80)
print("🔵 SERVICES PACKAGE INITIALIZATION")
print("=" * 80)

try:
    from app.services.langchain_service import langchain_service
    print(f"✅ langchain_service imported: {langchain_service}")
    print(f"✅ Is None: {langchain_service is None}")
    print("=" * 80)
except Exception as e:
    print("=" * 80)
    print(f"❌ FAILED TO IMPORT langchain_service: {e}")
    print("=" * 80)
    import traceback
    traceback.print_exc()
