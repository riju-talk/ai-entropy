"""
Setup script to create required directories and perform initial setup
"""
import os
from pathlib import Path
import sys

def setup_directories():
    """Create necessary directories"""
    directories = [
        Path("data/chroma_db"),
        Path("data/uploads"),
        Path("app/api"),
        Path("app/core"),
        Path("app/services"),
        Path("app/schemas"),
        Path("app/utils")
    ]
    
    for dir_path in directories:
        dir_path.mkdir(parents=True, exist_ok=True)
    
    # Create __init__.py files
    init_files = [
        Path("app/__init__.py"),
        Path("app/api/__init__.py"),
        Path("app/core/__init__.py"),
        Path("app/services/__init__.py"),
        Path("app/schemas/__init__.py"),
        Path("app/utils/__init__.py")
    ]
    
    for init_file in init_files:
        if not init_file.exists():
            init_file.write_text("")

def check_env():
    """Check environment configuration"""
    env_file = Path(".env")
    env_local = Path(".env.local")
    env_example = Path(".env.example")
    
    # Check if either .env or .env.local exists
    if not env_file.exists() and not env_local.exists():
        if env_example.exists():
            print("\n⚠️  No .env file found!")
            print("   Copy .env.example to .env or .env.local and configure it")
        return False
    
    return True

def check_python_version():
    """Check if Python version is 3.11+"""
    if sys.version_info < (3, 11):
        print(f"\n⚠️  Python 3.11+ required. Current: {sys.version_info.major}.{sys.version_info.minor}")
        return False
    return True

if __name__ == "__main__":
    print("🚀 Setting up AI Agent backend...\n")
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Create directories
    setup_directories()
    print("✅ Directory structure created")
    
    # Check environment
    env_ok = check_env()
    if not env_ok:
        print("⚠️  Environment not configured")
    else:
        print("✅ Environment configuration OK")
    
    print("\n" + "="*50)
    print("✨ Setup complete!")
    print("="*50)
    
    if not env_ok:
        print("\nNext steps:")
        print("1. Copy .env.example to .env")
        print("2. Add GROQ_API_KEY to .env")
        print("3. Add AI_BACKEND_TOKEN to .env")
        print("4. Run: pip install -r requirements.txt")
        print("5. Run: npm run dev")
