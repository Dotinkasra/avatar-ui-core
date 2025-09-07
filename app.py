"""Webアプリケーション"""

import base64

import google.generativeai as genai
import ollama
from flask import Flask, jsonify, render_template, request, session

import settings

# --- AIクライアントの初期化 ---
ai_client = None
if settings.AI_PROVIDER == "gemini":
    # Gemini API接続
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name=settings.MODEL_NAME, system_instruction=settings.SYSTEM_INSTRUCTION)
    ai_client = model.start_chat()  # チャットセッション開始
elif settings.AI_PROVIDER == "ollama":
    # Ollamaクライアントの初期化
    ai_client = ollama.Client(host=settings.OLLAMA_HOST)

app = Flask(__name__)
app.secret_key = settings.FLASK_SECRET_KEY


@app.route("/")
def index():
    """メインページ表示"""
    session.clear()  # ページロード時にチャット履歴をリセット
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


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """ユーザー入力を受信しAI応答を返す"""
    user_message = request.form.get("message", "")
    image_file = request.files.get("image")

    ai_response = ""

    if settings.AI_PROVIDER == "gemini":
        # Geminiは現在この実装では画像入力に未対応
        if image_file:
            # 本来はここで画像処理を行う
            # response = ai_client.send_message([user_message, image_file])
            ai_response = "(画像を受け取りましたが、現在Geminiでの画像解析はサポートされていません)"
        else:
            response = ai_client.send_message(user_message)
            ai_response = response.text

    elif settings.AI_PROVIDER == "ollama":
        messages = session.get("messages", [])
        if not messages:
            messages.append({"role": "system", "content": settings.SYSTEM_INSTRUCTION})

        # ユーザーメッセージを作成
        user_prompt = {"role": "user", "content": user_message, "images": []}
        if image_file:
            # 画像をBase64にエンコードしてメッセージに追加
            encoded_image = base64.b64encode(image_file.read()).decode("utf-8")
            user_prompt["images"].append(encoded_image)

        messages.append(user_prompt)

        # Ollama API呼び出し
        response = ai_client.chat(model=settings.MODEL_NAME, messages=messages)
        ai_response = response["message"]["content"]

        # AIの応答を履歴に追加
        messages.append({"role": "assistant", "content": ai_response})
        session["messages"] = messages  # セッションに保存

    return jsonify({"response": ai_response})


if __name__ == "__main__":
    app.run(host=settings.SERVER_HOST, debug=settings.DEBUG_MODE, port=settings.SERVER_PORT)
