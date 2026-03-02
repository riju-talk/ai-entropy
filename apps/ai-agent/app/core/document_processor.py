"""
Document processing utilities for handling various file formats
"""

import os
from typing import List, Dict, Any
from pathlib import Path
import logging
import io
import re
import markdown

logger = logging.getLogger(__name__)

# Import with error handling
try:
    import pypdf2
    PDF_AVAILABLE = True
except ImportError:
    logger.warning("pypdf2 not available - PDF processing disabled")
    PDF_AVAILABLE = False

try:
    from docx import Document
    DOCX_AVAILABLE = True
except ImportError:
    logger.warning("python-docx not available - DOCX processing disabled")
    DOCX_AVAILABLE = False

try:
    import markdown
    MARKDOWN_AVAILABLE = True
except ImportError:
    logger.warning("markdown not available - Markdown processing disabled")
    MARKDOWN_AVAILABLE = False


def process_document(file_path: str, file_type: str = None) -> Dict[str, Any]:
    """
    Process a document and extract text content
    
    Args:
        file_path: Path to the document file
        file_type: Type of document (pdf, docx, txt, md)
        
    Returns:
        Dictionary containing extracted text and metadata
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Auto-detect file type if not provided
    if file_type is None:
        file_type = os.path.splitext(file_path)[1].lower().lstrip('.')
    
    try:
        if file_type == 'pdf':
            if not PDF_AVAILABLE:
                raise ImportError("pypdf2 is not installed. Install with: pip install pypdf2")
            return process_pdf(file_path)
        elif file_type in ['doc', 'docx']:
            if not DOCX_AVAILABLE:
                raise ImportError("python-docx is not installed. Install with: pip install python-docx")
            return process_docx(file_path)
        elif file_type == 'txt':
            return process_txt(file_path)
        elif file_type == 'md':
            if not MARKDOWN_AVAILABLE:
                raise ImportError("markdown is not installed. Install with: pip install markdown")
            return process_markdown(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    except Exception as e:
        logger.error(f"Error processing document {file_path}: {str(e)}")
        raise


def process_pdf(file_path: str) -> Dict[str, Any]:
    """Extract text from PDF file"""
    try:
        text_content = []
        with open(file_path, 'rb') as file:
            pdf_reader = pypdf2.PdfReader(file)
            num_pages = len(pdf_reader.pages)
            
            for page_num in range(num_pages):
                page = pdf_reader.pages[page_num]
                text_content.append(page.extract_text())
        
        full_text = "\n".join(text_content)
        
        return {
            "text": full_text,
            "type": "pdf",
            "pages": num_pages,
            "file_path": file_path
        }
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise


def process_docx(file_path: str) -> Dict[str, Any]:
    """Extract text from Word document"""
    try:
        doc = Document(file_path)
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        full_text = "\n".join(paragraphs)
        
        return {
            "text": full_text,
            "type": "docx",
            "paragraphs": len(paragraphs),
            "file_path": file_path
        }
    except Exception as e:
        logger.error(f"Error processing DOCX: {str(e)}")
        raise


def process_txt(file_path: str) -> Dict[str, Any]:
    """Extract text from plain text file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            text = file.read()
        
        return {
            "text": text,
            "type": "txt",
            "file_path": file_path
        }
    except Exception as e:
        logger.error(f"Error processing TXT: {str(e)}")
        raise


def process_markdown(file_path: str) -> Dict[str, Any]:
    """Extract text from Markdown file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            md_text = file.read()
        
        # Convert markdown to HTML then extract text
        html = markdown.markdown(md_text)
        
        return {
            "text": md_text,
            "html": html,
            "type": "markdown",
            "file_path": file_path
        }
    except Exception as e:
        logger.error(f"Error processing Markdown: {str(e)}")
        raise


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split text into chunks for processing
    
    Args:
        text: Input text to chunk
        chunk_size: Size of each chunk in characters
        overlap: Number of characters to overlap between chunks
        
    Returns:
        List of text chunks
    """
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    
    return chunks


def extract_key_points(text: str, max_points: int = 5) -> List[str]:
    """
    Extract key points from text (simple implementation)
    
    Args:
        text: Input text
        max_points: Maximum number of key points to extract
        
    Returns:
        List of key points
    """
    # Simple sentence splitting
    sentences = [s.strip() for s in text.split('.') if s.strip()]
    
    # Return first N sentences as key points (can be enhanced with NLP)
    return sentences[:max_points]


# Export all functions
__all__ = [
    'process_document',
    'process_pdf',
    'process_docx',
    'process_txt',
    'process_markdown',
    'chunk_text',
    'extract_key_points'
]
