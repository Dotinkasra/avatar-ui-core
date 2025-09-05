/**
 * チャット機能モジュール
 * メッセージの送受信とUI更新を管理
 */
export class ChatManager {
    constructor(settings, animationManager) {
        this.settings = settings;
        this.animationManager = animationManager;
        
        // DOM要素の取得
        this.output = document.getElementById('output');
        this.input = document.getElementById('input');
        this.imageUpload = document.getElementById('image-upload');
        this.fileDisplayContainer = document.getElementById('file-display-container');
        this.fileNameDisplay = document.getElementById('file-name-display');
        this.removeImageBtn = document.getElementById('remove-image-btn');

        this.uploadedFile = null; // アップロードされたファイルを保持
        
        this.initEventListeners();
    }

    // イベントリスナー初期化
    initEventListeners() {
        // テキスト入力でEnterキー押下
        this.input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const message = this.input.value.trim();
                if (message || this.uploadedFile) {
                    await this.sendMessage(message, this.uploadedFile);
                }
            }
        });

        // 画像ファイル選択
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));

        // 画像削除ボタンクリック
        this.removeImageBtn.addEventListener('click', () => this.removeImage());
    }

    // 画像が選択されたときの処理
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.uploadedFile = file;
            this.fileNameDisplay.textContent = file.name;
            this.fileDisplayContainer.style.display = 'flex';
        }
    }

    // 選択された画像を削除
    removeImage() {
        this.uploadedFile = null;
        this.imageUpload.value = ''; // ファイル選択をリセット
        this.fileNameDisplay.textContent = '';
        this.fileDisplayContainer.style.display = 'none';
    }

    // メッセージ送信
    async sendMessage(message, imageFile) {
        // ユーザーメッセージを画面に追加
        this.addLine(message, 'user', imageFile ? imageFile.name : null);
        
        const formData = new FormData();
        formData.append('message', message);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        // 入力とプレビューをリセット
        this.input.value = '';
        this.removeImage();

        try {
            // AIに送信
            const response = await fetch('/api/chat', {
                method: 'POST',
                body: formData // JSONではなくFormDataを送信
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // AIレスポンスをタイプライター効果で表示
            await this.addLine(data.response, 'ai');
        } catch (error) {
            console.error('Chat error:', error);
            this.addLine('エラーが発生しました。再試行してください。', 'system');
        }
    }

    // メッセージを画面に追加
    async addLine(text, type, fileName = null) {
        const line = document.createElement('div');
        line.className = 'line ' + type;
        
        if (type === 'user') {
            let content = `<span class="user-prompt">USER&gt;</span>`;
            if (fileName) {
                content += ` [ファイル: ${fileName}]`;
            }
            content += ` ${text}`;
            line.innerHTML = content;
            this.output.appendChild(line);
            this.scrollToBottom();
        } else if (type === 'ai') {
            // AIメッセージはタイプライター演出
            line.innerHTML = `<span class="ai-prompt">${this.settings.avatarName}&gt;</span> <span class="ai-text"></span>`;
            this.output.appendChild(line);
            
            const aiTextElement = line.querySelector('.ai-text');
            await this.animationManager.typeWriter(aiTextElement, text);
        } else {
            // system メッセージなど
            line.textContent = text;
            this.output.appendChild(line);
            this.scrollToBottom();
        }
    }

    // チャットエリアを最下部にスクロール
    scrollToBottom() {
        this.output.scrollTop = this.output.scrollHeight;
    }
}