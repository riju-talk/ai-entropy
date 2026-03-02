"""
Helper utility functions
"""

import hashlib
from typing import Any, Dict
from datetime import datetime

def generate_id(prefix: str = "") -> str:
    """Generate a unique ID"""
    timestamp = datetime.now().isoformat()
    hash_obj = hashlib.md5(timestamp.encode())
    return f"{prefix}{hash_obj.hexdigest()[:12]}"

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal"""
    return filename.replace("..", "").replace("/", "").replace("\\", "")

def format_response(data: Any, message: str = None) -> Dict:
    """Format API response"""
    response = {"data": data}
    if message:
        response["message"] = message
    response["timestamp"] = datetime.now().isoformat()
    return response
