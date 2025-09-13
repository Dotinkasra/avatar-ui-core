"""Webアプリケーション"""

import base64
import json
import os
import subprocess
import uuid

import google.generativeai as genai
import ollama
from flask import Flask, jsonify, render_template, request, session

import settings

# --- 定数 ---
VSAY_SETTINGS_FILE = "vsay_settings.json"
AUDIO_DIR = "static/audio"

# --- AIクライアントの初期化 ---
ai_client = None
if settings.AI_PROVIDER == "gemini":
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name=settings.MODEL_NAME, system_instruction=settings.SYSTEM_INSTRUCTION)
    ai_client = model.start_chat()
elif settings.AI_PROVIDER == "ollama":
    ai_client = ollama.Client(host=settings.OLLAMA_HOST)

app = Flask(__name__)
app.secret_key = settings.FLASK_SECRET_KEY

os.makedirs(AUDIO_DIR, exist_ok=True)

# --- 設定ヘルパー関数 ---
def load_vsay_settings():
    """vsayの設定をJSONファイルから読み込む"""
    default_settings = {"speed": 1.1, "pitch": 0.0, "intonation": 1.0, "tempo": 1.0}
    if not os.path.exists(VSAY_SETTINGS_FILE):
        return default_settings
    try:
        with open(VSAY_SETTINGS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default_settings

def save_vsay_settings(new_settings):
    """vsayの設定をJSONファイルに保存する"""
    with open(VSAY_SETTINGS_FILE, 'w') as f:
        json.dump(new_settings, f, indent=4)

# --- ルート ---
@app.route("/")
def index():
    """メインページ表示"""
    session.clear()
    config = {
        "typewriter_delay": settings.TYPEWRITER_DELAY_MS,
        "avatar_name": settings.AVATAR_NAME,
        "avatar_full_name": settings.AVATAR_FULL_NAME,
        "mouth_animation_interval": settings.MOUTH_ANIMATION_INTERVAL_MS,
        "beep_frequency": settings.BEEP_FREQUENCY_HZ,
        "beep_duration": settings.BEEP_DURATION_MS,
        "beep_volume": settings.BEEP_VOLUME,
        "beep_volume_end": settings.BEEP_VOLUME_END,
        "avatar_image_idle": settings.AVATAR_IMAGE_IDLE,
        "avatar_image_talk": settings.AVATAR_IMAGE_TALK,
    }
    return render_template("index.html", config=config)

# --- APIルート ---
@app.route("/api/settings", methods=["GET", "POST"])
def vsay_settings_api():
    """vsay設定の取得と保存を行うAPI"""
    if request.method == "GET":
        return jsonify(load_vsay_settings())
    elif request.method == "POST":
        new_settings = request.json
        save_vsay_settings(new_settings)
        return jsonify({"status": "success"})

@app.route("/api/chat", methods=["POST"])
def api_chat():
    """チャット処理と音声合成"""
    last_audio_path = session.pop('last_audio_path', None)
    if last_audio_path and os.path.exists(last_audio_path):
        try:
            os.remove(last_audio_path)
        except OSError as e:
            print(f"Error removing file {last_audio_path}: {e}")

    user_message = request.form.get("message", "")
    image_file = request.files.get("image")
    ai_response = ""

    if settings.AI_PROVIDER == "gemini":
        if image_file:
            ai_response = "(画像を受け取りましたが、現在Geminiでの画像解析はサポートされていません)"
        else:
            response = ai_client.send_message(user_message)
            ai_response = response.text
    elif settings.AI_PROVIDER == "ollama":
        messages = session.get("messages", [])
        if not messages:
            messages.append({"role": "system", "content": settings.SYSTEM_INSTRUCTION})
        user_prompt = {"role": "user", "content": user_message, "images": []}
        if image_file:
            user_prompt["images"].append(base64.b64encode(image_file.read()).decode("utf-8"))
        messages.append(user_prompt)
        response = ai_client.chat(model=settings.MODEL_NAME, messages=messages)
        ai_response = response["message"]["content"]
        messages.append({"role": "assistant", "content": ai_response})
        session["messages"] = messages

    audio_url = None
    if ai_response.strip():
        try:
            filename = f"{uuid.uuid4()}.wav"
            save_path = os.path.join(AUDIO_DIR, filename)
            
            vsay_opts = load_vsay_settings()
            command = ["./bin/vsay", "say", "-q", "-s", save_path]
            for key, value in vsay_opts.items():
                command.extend([f"--{key}", str(value)])
            command.append(ai_response)

            subprocess.run(command, check=True, capture_output=True, text=True)
            
            audio_url = f"/{save_path}"
            session['last_audio_path'] = save_path

        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"音声合成エラー: {e}")

    return jsonify({"response": ai_response, "audio_url": audio_url})

if __name__ == "__main__":
    app.run(host=settings.SERVER_HOST, debug=settings.DEBUG_MODE, port=settings.SERVER_PORT)
