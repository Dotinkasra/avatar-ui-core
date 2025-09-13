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
        this.avatarImg = document.getElementById('avatar-img');
        
        // 設定モーダル関連のDOM
        this.settingsModal = document.getElementById('settings-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.typewriterToggle = document.getElementById('typewriter-toggle');
        this.voiceToggle = document.getElementById('voice-toggle');

        this.uploadedFileData = null; // アップロードされたファイルとDataURLを保持
        this.isTypewriterEnabled = true;
        this.isVoiceEnabled = true;
        
        this.createDragOverlay();
        this.initEventListeners();
        this.loadSettings();
    }

    // ドラッグ＆ドロップ用オーバーレイを生成
    createDragOverlay() {
        this.dragOverlay = document.createElement('div');
        this.dragOverlay.className = 'drag-overlay';
        this.dragOverlay.textContent = 'ファイルをドロップしてアップロード';
        document.body.appendChild(this.dragOverlay);
    }

    // イベントリスナー初期化
    initEventListeners() {
        // --- メイン機能のイベントリスナー ---
        this.input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const message = this.input.value.trim();
                if (message || this.uploadedFileData) {
                    await this.sendMessage(message, this.uploadedFileData);
                }
            }
        });
        this.imageUpload.addEventListener('change', (e) => this.processFiles(e.target.files));
        this.removeImageBtn.addEventListener('click', () => this.removeImage());

        // --- 設定モーダルのイベントリスナー ---
        this.avatarImg.addEventListener('click', () => this.openModal());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeModal();
        });
        this.typewriterToggle.addEventListener('change', (e) => {
            this.isTypewriterEnabled = e.target.checked;
            localStorage.setItem('typewriterEnabled', this.isTypewriterEnabled);
        });
        this.voiceToggle.addEventListener('change', (e) => {
            this.isVoiceEnabled = e.target.checked;
            localStorage.setItem('voiceEnabled', this.isVoiceEnabled);
        });

        // --- ドラッグ＆ドロップのイベントリスナー ---
        const dropZone = document.body;
        let dragCounter = 0;
        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            this.dragOverlay.classList.add('visible');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) this.dragOverlay.classList.remove('visible');
        });
        dropZone.addEventListener('dragover', (e) => e.preventDefault());
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            this.dragOverlay.classList.remove('visible');
            this.processFiles(e.dataTransfer.files);
        });
    }

    // --- 設定関連のメソッド ---
    openModal() { this.settingsModal.style.display = 'flex'; }
    closeModal() { this.settingsModal.style.display = 'none'; }

    loadSettings() {
        const typewriterSetting = localStorage.getItem('typewriterEnabled');
        if (typewriterSetting !== null) {
            this.isTypewriterEnabled = typewriterSetting === 'true';
        }
        this.typewriterToggle.checked = this.isTypewriterEnabled;

        const voiceSetting = localStorage.getItem('voiceEnabled');
        if (voiceSetting !== null) {
            this.isVoiceEnabled = voiceSetting === 'true';
        }
        this.voiceToggle.checked = this.isVoiceEnabled;
    }

    // --- ファイル処理メソッド ---
    processFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) return;
        this.fileNameDisplay.textContent = file.name;
        this.fileDisplayContainer.style.display = 'flex';
        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedFileData = { file: file, dataUrl: e.target.result };
        };
        reader.readAsDataURL(file);
    }

    removeImage() {
        this.uploadedFileData = null;
        this.imageUpload.value = '';
        this.fileNameDisplay.textContent = '';
        this.fileDisplayContainer.style.display = 'none';
    }

    // --- メッセージ送受信と表示 ---
    async sendMessage(message, fileData) {
        this.addLine(message, 'user', { imageUrl: fileData ? fileData.dataUrl : null });
        const formData = new FormData();
        formData.append('message', message);
        if (fileData) formData.append('image', fileData.file);
        this.input.value = '';
        this.removeImage();
        try {
            const response = await fetch('/api/chat', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            await this.addLine(data.response, 'ai', { audioUrl: data.audio_url });
        } catch (error) {
            console.error('Chat error:', error);
            this.addLine('エラーが発生しました。再試行してください。', 'system');
        }
    }

    async addLine(text, type, options = {}) {
        const { imageUrl, audioUrl } = options;
        const line = document.createElement('div');
        line.className = 'line ' + type;
        if (type === 'user') {
            const textContent = document.createElement('span');
            textContent.innerHTML = `<span class="user-prompt">USER&gt;</span> ${text}`;
            line.appendChild(textContent);
            if (imageUrl) {
                const br = document.createElement('br');
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Uploaded image';
                img.onload = () => this.scrollToBottom();
                img.onerror = () => this.scrollToBottom();
                line.appendChild(br);
                line.appendChild(img);
            }
            this.output.appendChild(line);
            this.scrollToBottom();
        } else if (type === 'ai') {
            line.innerHTML = `<span class="ai-prompt">${this.settings.avatarName}&gt;</span> <span class="ai-text"></span>`;
            this.output.appendChild(line);
            this.scrollToBottom();
            if (audioUrl && this.isVoiceEnabled) {
                const audio = new Audio(audioUrl);
                audio.play().catch(e => console.error("Audio play failed:", e));
            }
            const aiTextElement = line.querySelector('.ai-text');
            if (this.isTypewriterEnabled) {
                await this.animationManager.typeWriter(aiTextElement, text);
            } else {
                aiTextElement.textContent = text;
            }
            this.scrollToBottom();
        } else {
            line.textContent = text;
            this.output.appendChild(line);
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        this.output.scrollTop = this.output.scrollHeight;
    }
}
