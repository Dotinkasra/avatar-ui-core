"""Webアプリケーション"""

import base64
import json
import os
import subprocess
import time # timeモジュールを追加
import uuid

import google.generativeai as genai
import ollama
from flask import Flask, jsonify, render_template, request, session

import settings

# --- 定数 ---
PROMPT_SETTINGS_DIR = "prompt_settings"
AUDIO_DIR = "static/audio"
DEFAULT_PERSONA = "Spectra"
AUDIO_FILE_LIFETIME_SECONDS = 3600 # 1時間 (3600秒) 経過したファイルを削除

# --- AIクライアントの初期化 ---
if settings.AI_PROVIDER == "gemini":
    genai.configure(api_key=settings.GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(model_name=settings.MODEL_NAME)
elif settings.AI_PROVIDER == "ollama":
    ollama_client = ollama.Client(host=settings.OLLAMA_HOST)

app = Flask(__name__)
app.secret_key = settings.FLASK_SECRET_KEY

os.makedirs(AUDIO_DIR, exist_ok=True)

# --- ヘルパー関数 ---
def load_persona(persona_name):
    default_persona = {
        "avatarName": "Default", "avatarFullName": "Default AI",
        "systemInstruction": "You are a helpful assistant.",
        "avatarImageIdle": "idle.png", "avatarImageTalk": "talk.png",
        "vsayOptions": {"speed": 1.0, "pitch": 0.0, "intonation": 1.0, "tempo": 1.0}
    }
    path = os.path.join(PROMPT_SETTINGS_DIR, f"{persona_name}.json")
    if not os.path.exists(path):
        return default_persona
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default_persona

def save_persona_settings(persona_name, new_settings):
    path = os.path.join(PROMPT_SETTINGS_DIR, f"{persona_name}.json")
    if not os.path.exists(path):
        return False
    current_settings = load_persona(persona_name)
    current_settings.update(new_settings)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(current_settings, f, indent=2, ensure_ascii=False)
    return True

def get_personas():
    if not os.path.isdir(PROMPT_SETTINGS_DIR):
        return []
    return sorted([f.replace('.json', '') for f in os.listdir(PROMPT_SETTINGS_DIR) if f.endswith('.json')])

def clean_old_audio_files():
    """指定された期間より古い音声ファイルを削除する"""
    now = time.time()
    for filename in os.listdir(AUDIO_DIR):
        filepath = os.path.join(AUDIO_DIR, filename)
        if os.path.isfile(filepath):
            try:
                if now - os.path.getmtime(filepath) > AUDIO_FILE_LIFETIME_SECONDS:
                    os.remove(filepath)
                    print(f"Deleted old audio file: {filepath}")
            except OSError as e:
                print(f"Error deleting old audio file {filepath}: {e}")

# --- ルート ---
@app.route("/")
def index():
    persona_name = session.get('current_persona', DEFAULT_PERSONA)
    persona_data = load_persona(persona_name)

    config = {
        "typewriter_delay": settings.TYPEWRITER_DELAY_MS,
        "mouth_animation_interval": settings.MOUTH_ANIMATION_INTERVAL_MS,
        "beep_frequency": settings.BEEP_FREQUENCY_HZ,
        "beep_duration": settings.BEEP_DURATION_MS,
        "beep_volume": settings.BEEP_VOLUME,
        "beep_volume_end": settings.BEEP_VOLUME_END,
        "avatar_name": persona_data.get("avatarName"),
        "avatar_full_name": persona_data.get("avatarFullName"),
        "avatar_image_idle": persona_data.get("avatarImageIdle"),
        "avatar_image_talk": persona_data.get("avatarImageTalk"),
    }
    return render_template("index.html", config=config)

# --- APIルート ---
@app.route("/api/personas", methods=["GET"])
def personas_api():
    return jsonify(get_personas())

@app.route("/api/current_persona", methods=["GET", "POST"])
def current_persona_api():
    if request.method == "POST":
        persona_name = request.json.get('name')
        if persona_name in get_personas():
            session['current_persona'] = persona_name
            session.pop('messages', None)
            return jsonify({"status": "success", "persona": load_persona(persona_name)})
        return jsonify({"status": "error", "message": "Persona not found"}), 404
    persona_name = session.get('current_persona', DEFAULT_PERSONA)
    return jsonify({
        "name": persona_name,
        "data": load_persona(persona_name)
    })

@app.route("/api/persona_settings", methods=["POST"])
def persona_settings_api():
    data = request.json
    persona_name = data.get('name')
    new_settings = data.get('settings')
    if not persona_name or not new_settings or persona_name not in get_personas():
        return jsonify({"status": "error", "message": "Invalid request"}), 400
    save_persona_settings(persona_name, new_settings)
    return jsonify({"status": "success"})

@app.route("/api/chat", methods=["POST"])
def api_chat():
    last_audio_path = session.pop('last_audio_path', None)
    if last_audio_path and os.path.exists(last_audio_path):
        try:
            os.remove(last_audio_path)
        except OSError as e:
            print(f"Error removing file {last_audio_path}: {e}")

    user_message = request.form.get("message", "")
    image_file = request.files.get("image")
    ai_response = ""

    persona_name = session.get('current_persona', DEFAULT_PERSONA)
    persona = load_persona(persona_name)
    system_instruction = persona.get('systemInstruction', '')

    if settings.AI_PROVIDER == "gemini":
        chat_history = session.get('messages', [])
        if not chat_history:
            chat_history.append({'role': 'user', 'parts': [system_instruction]})
            chat_history.append({'role': 'model', 'parts': ["はい、承知いたしました。"]})
        chat = gemini_model.start_chat(history=chat_history)
        response = chat.send_message(user_message)
        ai_response = response.text
        session['messages'] = chat.history

    elif settings.AI_PROVIDER == "ollama":
        messages = session.get("messages", [])
        if not messages:
            messages.append({"role": "system", "content": system_instruction})
        user_prompt = {"role": "user", "content": user_message, "images": []}
        if image_file:
            user_prompt["images"].append(base64.b64encode(image_file.read()).decode("utf-8"))
        messages.append(user_prompt)
        response = ollama_client.chat(model=settings.MODEL_NAME, messages=messages)
        ai_response = response["message"]["content"]
        messages.append({"role": "assistant", "content": ai_response})
        session["messages"] = messages

    audio_url = None
    if ai_response.strip():
        try:
            filename = f"{uuid.uuid4()}.wav"
            save_path = os.path.join(AUDIO_DIR, filename)
            vsay_opts = persona.get("vsayOptions", {})
            command = ["./bin/vsay", "say", "-q", "-s", save_path]
            for key, value in vsay_opts.items():
                command.extend([f"--{key}", str(value)])
            command.append(ai_response)
            subprocess.run(command, check=True, capture_output=True, text=True)
            print(f"Generated audio file: {save_path}") # 成功ログを追加
            audio_url = f"/{save_path}"
            session['last_audio_path'] = save_path
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"音声合成エラー: {e}")

    return jsonify({"response": ai_response, "audio_url": audio_url})

if __name__ == "__main__":
    clean_old_audio_files() # アプリケーション起動時に古いファイルをクリーンアップ
    app.run(host=settings.SERVER_HOST, debug=settings.DEBUG_MODE, port=settings.SERVER_PORT)