# Debianベースの軽量なslimイメージを使用
FROM python:3.13-slim

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係ファイルを先にコピー
COPY requirements.txt .

# pipで依存関係をインストール
# C拡張のコンパイルが必要なパッケージに備え、ビルドツールを一時的にインストールし、後でクリーンアップする
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libc6-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y gcc libc6-dev && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# 必要なアプリケーションファイルとディレクトリを個別にコピー
COPY app.py .
COPY settings.py .
COPY static/ ./static/
COPY templates/ ./templates/
COPY prompt_settings/ ./prompt_settings/

# アプリケーションがリッスンするポートをコンテナに公開
EXPOSE 5020

# コンテナ起動時にアプリケーションを実行
CMD ["python", "app.py"]
