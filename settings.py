"""
設定管理モジュール - .envファイルから全設定を読み込み
"""

import os
import secrets

from dotenv import load_dotenv

# .envファイルを読み込み
load_dotenv()

# ===========================================
# AIプロバイダー設定
# ===========================================
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")  # "gemini" or "ollama"

# ===========================================
# 必須設定（プロバイダーに応じて分岐）
# ===========================================
GEMINI_API_KEY = None
OLLAMA_HOST = None
if AI_PROVIDER == "gemini":
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise ValueError("AI_PROVIDERがgeminiの場合、GEMINI_API_KEYは必須です。")
elif AI_PROVIDER == "ollama":
    OLLAMA_HOST = os.getenv("OLLAMA_HOST")
    if not OLLAMA_HOST:
        raise ValueError("AI_PROVIDERがollamaの場合、OLLAMA_HOSTは必須です。")
else:
    raise ValueError(f"無効なAI_PROVIDERです: {AI_PROVIDER}")

# ===========================================
# 任意設定（デフォルト値あり）
# ===========================================

# モデル設定
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.0-flash" if AI_PROVIDER == "gemini" else "llama3:latest")

# アバター設定
AVATAR_NAME = os.getenv("AVATAR_NAME", "Spectra")
AVATAR_FULL_NAME = os.getenv("AVATAR_FULL_NAME", "Spectra Communicator")
AVATAR_IMAGE_IDLE = os.getenv("AVATAR_IMAGE_IDLE", "idle.png")
AVATAR_IMAGE_TALK = os.getenv("AVATAR_IMAGE_TALK", "talk.png")

# AI性格設定（AVATAR_NAMEに依存）
SYSTEM_INSTRUCTION = os.getenv(
    "SYSTEM_INSTRUCTION",
    f"あなたは{AVATAR_NAME}というAIアシスタントです。技術的で直接的なスタイルで簡潔に応答してください。回答は短く要点を押さえたものにしてください。",
)

# サーバー設定
SERVER_HOST = os.getenv("SERVER_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("SERVER_PORT", "5000"))
DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() == "true"
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(16))


# UI設定
TYPEWRITER_DELAY_MS = int(os.getenv("TYPEWRITER_DELAY_MS", "50"))
MOUTH_ANIMATION_INTERVAL_MS = int(os.getenv("MOUTH_ANIMATION_INTERVAL_MS", "150"))

# サウンド設定
BEEP_FREQUENCY_HZ = int(os.getenv("BEEP_FREQUENCY_HZ", "800"))
BEEP_DURATION_MS = int(os.getenv("BEEP_DURATION_MS", "50"))
BEEP_VOLUME = float(os.getenv("BEEP_VOLUME", "0.05"))
BEEP_VOLUME_END = float(os.getenv("BEEP_VOLUME_END", "0.01"))
