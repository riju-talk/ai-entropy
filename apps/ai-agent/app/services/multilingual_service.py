"""
NOVYRA — Multilingual Layer

Flow (input non-English):
    Input  →  detect language  →  translate to English
    Output →  translate from English  →  target language

Uses deep-translator (Google Translate backend) — free, no API key needed.
Reasoning is always performed in English internally for consistency.
"""
from __future__ import annotations
import logging
from functools import lru_cache

from langdetect import detect, LangDetectException
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "hi": "Hindi",
    "bn": "Bengali",
    "te": "Telugu",
    "mr": "Marathi",
    "ta": "Tamil",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "zh-cn": "Chinese (Simplified)",
    "ar": "Arabic",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
}


def detect_language(text: str) -> str:
    """
    Return ISO 639-1 language code.
    Returns 'en' on failure.
    """
    try:
        lang = detect(text)
        logger.debug("Detected language: %s", lang)
        return lang
    except LangDetectException:
        logger.warning("Language detection failed, defaulting to 'en'")
        return "en"


async def to_english(text: str, source_lang: str = "auto") -> str:
    """
    Translate text to English.
    source_lang: ISO code or 'auto' for auto-detection.
    """
    if source_lang == "en":
        return text
    try:
        translator = GoogleTranslator(source=source_lang, target="en")
        translated = translator.translate(text)
        logger.debug("to_english [%s → en]: %s", source_lang, translated[:80])
        return translated or text
    except Exception as exc:
        logger.error("Translation to English failed: %s", exc)
        return text  # fallback: return original


async def from_english(text: str, target_lang: str) -> str:
    """
    Translate text from English to target language.
    """
    if target_lang == "en":
        return text
    try:
        translator = GoogleTranslator(source="en", target=target_lang)
        translated = translator.translate(text)
        logger.debug("from_english [en → %s]: %s", target_lang, translated[:80])
        return translated or text
    except Exception as exc:
        logger.error("Translation from English failed: %s", exc)
        return text  # fallback: return English


async def preprocess(text: str) -> tuple[str, str]:
    """
    Detect language and translate to English.
    Returns (english_text, source_language_code).
    """
    lang = detect_language(text)
    if lang == "en":
        return text, "en"
    english = await to_english(text, source_lang=lang)
    return english, lang


async def postprocess(english_text: str, target_lang: str) -> str:
    """
    Translate final English output back to target language.
    If target is English, returns as-is.
    """
    return await from_english(english_text, target_lang=target_lang)
