"""
AWS Lambda handler for Entropy AI Engine
Uses Mangum to adapt FastAPI to Lambda
"""
import os

# Set environment before importing app
os.environ.setdefault("APP_ENV", os.environ.get("APP_ENV", "production"))
os.environ.setdefault("AI_PROVIDER", "bedrock")

from mangum import Mangum
from app.main import app

# Create handler
handler = Mangum(app)

# For local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
