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

        // vsay設定のDOM
        this.vsaySliders = {
            speed: document.getElementById('vsay-speed'),
            pitch: document.getElementById('vsay-pitch'),
            intonation: document.getElementById('vsay-intonation'),
            tempo: document.getElementById('vsay-tempo'),
        };
        this.vsaySliderValues = {
            speed: document.getElementById('vsay-speed-value'),
            pitch: document.getElementById('vsay-pitch-value'),
            intonation: document.getElementById('vsay-intonation-value'),
            tempo: document.getElementById('vsay-tempo-value'),
        };

        // 状態管理
        this.uploadedFileData = null;
        this.isTypewriterEnabled = true;
        this.isVoiceEnabled = true;
        this.vsayOptions = { speed: 1.1, pitch: 0.0, intonation: 1.0, tempo: 1.0 };
        
        this.createDragOverlay();
        this.initEventListeners();
        this.loadSettings();
    }

    createDragOverlay() {
        this.dragOverlay = document.createElement('div');
        this.dragOverlay.className = 'drag-overlay';
        this.dragOverlay.textContent = 'ファイルをドロップしてアップロード';
        document.body.appendChild(this.dragOverlay);
    }

    initEventListeners() {
        // --- メイン機能 ---
        this.input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && (this.input.value.trim() || this.uploadedFileData)) {
                await this.sendMessage(this.input.value.trim(), this.uploadedFileData);
            }
        });
        this.imageUpload.addEventListener('change', (e) => this.processFiles(e.target.files));
        this.removeImageBtn.addEventListener('click', () => this.removeImage());

        // --- 設定モーダル ---
        this.avatarImg.addEventListener('click', () => this.openModal());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeModal();
        });

        // --- 設定項目 ---
        this.typewriterToggle.addEventListener('change', (e) => {
            this.isTypewriterEnabled = e.target.checked;
            localStorage.setItem('typewriterEnabled', this.isTypewriterEnabled);
        });
        this.voiceToggle.addEventListener('change', (e) => {
            this.isVoiceEnabled = e.target.checked;
            localStorage.setItem('voiceEnabled', this.isVoiceEnabled);
        });

        // vsayスライダーのイベントリスナー
        for (const key in this.vsaySliders) {
            this.vsaySliders[key].addEventListener('input', (e) => {
                const value = parseFloat(e.target.value).toFixed(2);
                this.vsaySliderValues[key].textContent = value;
                this.vsayOptions[key] = parseFloat(value);
            });
            this.vsaySliders[key].addEventListener('change', () => {
                this.saveVsaySettings();
            });
        }

        // --- D&D ---
        // ... (省略)
    }

    // --- 設定関連メソッド ---
    async openModal() {
        await this.loadVsaySettings();
        this.settingsModal.style.display = 'flex';
    }
    closeModal() { this.settingsModal.style.display = 'none'; }

    loadSettings() {
        // ... (省略)
        const typewriterSetting = localStorage.getItem('typewriterEnabled');
        if (typewriterSetting !== null) this.isTypewriterEnabled = typewriterSetting === 'true';
        this.typewriterToggle.checked = this.isTypewriterEnabled;

        const voiceSetting = localStorage.getItem('voiceEnabled');
        if (voiceSetting !== null) this.isVoiceEnabled = voiceSetting === 'true';
        this.voiceToggle.checked = this.isVoiceEnabled;
    }

    async loadVsaySettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            this.vsayOptions = settings;
            for (const key in settings) {
                if (this.vsaySliders[key]) {
                    this.vsaySliders[key].value = settings[key];
                    this.vsaySliderValues[key].textContent = parseFloat(settings[key]).toFixed(2);
                }
            }
        } catch (error) {
            console.error("Failed to load vsay settings:", error);
        }
    }

    async saveVsaySettings() {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.vsayOptions)
            });
        } catch (error) {
            console.error("Failed to save vsay settings:", error);
        }
    }

    // --- ファイル処理 & メッセージ送受信 (省略) ---
    // ... (変更なし)
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