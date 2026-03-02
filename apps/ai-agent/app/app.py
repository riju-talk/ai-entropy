from app.main import app
from mangum import Mangum

# Mangum adapts ASGI apps (FastAPI) to AWS Lambda / Vercel serverless handler
handler = Mangum(app)
