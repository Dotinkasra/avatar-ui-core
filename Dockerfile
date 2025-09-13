FROM python:3.13-slim

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係ファイルを先にコピー
COPY requirements.txt .

# pipで依存関係をインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libc6-dev libasound2-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y gcc libc6-dev && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# アプリケーションファイルをコピー
COPY app.py . 
COPY settings.py . 
COPY static/ ./static/ 
COPY templates/ ./templates/ 

RUN mkdir bin
COPY ./bin/vsay-linux-arm64 ./bin/vsay
RUN chmod +x ./bin/vsay

# prompt_settingsとstatic/audioディレクトリを作成し、初期ファイルをコピー
# これらは永続化のためにマウントされることを想定
RUN mkdir -p prompt_settings static/audio
COPY prompt_settings/ ./prompt_settings/

# アプリケーションがリッスンするポートを公開
EXPOSE 5000 

# コンテナ起動時にアプリケーションを実行
CMD ["python", "app.py"]