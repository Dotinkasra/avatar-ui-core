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
        this.avatarLabel = document.querySelector('.avatar-label');
        
        // 設定モーダル関連のDOM
        this.settingsModal = document.getElementById('settings-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.personaSelect = document.getElementById('persona-select');
        this.typewriterToggle = document.getElementById('typewriter-toggle');
        this.voiceToggle = document.getElementById('voice-toggle');
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
        this.vsayTextFields = {
            host: document.getElementById('vsay-host'),
            port: document.getElementById('vsay-port'),
            id: document.getElementById('vsay-id'),
            number: document.getElementById('vsay-number'),
            style: document.getElementById('vsay-style'),
        };

        // 状態管理
        this.uploadedFileData = null;
        this.currentPersonaName = null;
        this.isTypewriterEnabled = true;
        this.isVoiceEnabled = true;
        this.lastPersonaName = null; // lastPersonaNameプロパティを追加
        
        this.createDragOverlay();
        this.initEventListeners();
        this.loadSettings();
        this.sendInitialPersonaToServer(); // 初期ペルソナをサーバーに通知
    }

    createDragOverlay() {
        this.dragOverlay = document.createElement('div');
        this.dragOverlay.className = 'drag-overlay';
        this.dragOverlay.textContent = 'ファイルをドロップしてアップロード';
        document.body.appendChild(this.dragOverlay);
    }

    initEventListeners() {
        this.input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && (this.input.value.trim() || this.uploadedFileData)) {
                await this.sendMessage(this.input.value.trim(), this.uploadedFileData);
            }
        });
        this.imageUpload.addEventListener('change', (e) => this.processFiles(e.target.files));
        this.removeImageBtn.addEventListener('click', () => this.removeImage());

        this.avatarImg.addEventListener('click', () => this.openModal());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeModal();
        });

        this.personaSelect.addEventListener('change', (e) => this.handlePersonaChange(e));
        this.typewriterToggle.addEventListener('change', (e) => {
            this.isTypewriterEnabled = e.target.checked;
            localStorage.setItem('typewriterEnabled', this.isTypewriterEnabled);
        });
        this.voiceToggle.addEventListener('change', (e) => {
            this.isVoiceEnabled = e.target.checked;
            localStorage.setItem('voiceEnabled', this.isVoiceEnabled);
        });

        for (const key in this.vsaySliders) {
            this.vsaySliders[key].addEventListener('input', (e) => {
                const value = parseFloat(e.target.value).toFixed(2);
                this.vsaySliderValues[key].textContent = value;
            });
            this.vsaySliders[key].addEventListener('change', (e) => {
                const key = e.target.id.split('-')[1];
                const value = parseFloat(e.target.value);
                this.saveCurrentPersonaVsaySettings({ [key]: value });
            });
        }

        for (const key in this.vsayTextFields) {
            this.vsayTextFields[key].addEventListener('input', (e) => {
                const value = e.target.value;
                this.saveCurrentPersonaVsaySettings({ [key]: value });
            });
        }
        
        const dropZone = document.body;
        let dragCounter = 0;
        dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; this.dragOverlay.classList.add('visible'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0) this.dragOverlay.classList.remove('visible'); });
        dropZone.addEventListener('dragover', (e) => e.preventDefault());
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dragCounter = 0; this.dragOverlay.classList.remove('visible'); this.processFiles(e.dataTransfer.files); });
    }

    async openModal() {
        await this.populatePersonas();
        this.settingsModal.style.display = 'flex';
    }
    closeModal() { this.settingsModal.style.display = 'none'; }

    loadSettings() {
        const typewriterSetting = localStorage.getItem('typewriterEnabled');
        if (typewriterSetting !== null) this.isTypewriterEnabled = typewriterSetting === 'true';
        this.typewriterToggle.checked = this.isTypewriterEnabled;

        const voiceSetting = localStorage.getItem('voiceEnabled');
        if (voiceSetting !== null) this.isVoiceEnabled = voiceSetting === 'true';
        this.voiceToggle.checked = this.isVoiceEnabled;

        this.lastPersonaName = localStorage.getItem('lastPersona'); // lastPersonaNameをlocalStorageから読み込む
    }

    async sendInitialPersonaToServer() {
        if (this.lastPersonaName) {
            try {
                const response = await fetch('/api/current_persona', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: this.lastPersonaName })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    this.updateUIAfterPersonaChange(data.persona);
                    this.currentPersonaName = this.lastPersonaName;
                } else {
                    console.error("Failed to set initial persona on server:", data.message);
                }
            } catch (error) {
                console.error("Error sending initial persona to server:", error);
            }
        }
    }

    async populatePersonas() {
        try {
            const [personasRes, currentPersonaRes] = await Promise.all([fetch('/api/personas'), fetch('/api/current_persona')]);
            const personas = await personasRes.json();
            const currentPersonaData = await currentPersonaRes.json();
            
            this.currentPersonaName = currentPersonaData.name;

            this.personaSelect.innerHTML = '';
            personas.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                if (name === this.currentPersonaName) option.selected = true;
                this.personaSelect.appendChild(option);
            });
            
            const vsayOptions = currentPersonaData.data.vsayOptions || {};
            for (const key in vsayOptions) {
                if (this.vsaySliders[key]) {
                    this.vsaySliders[key].value = vsayOptions[key];
                    this.vsaySliderValues[key].textContent = parseFloat(vsayOptions[key]).toFixed(2);
                } else if (this.vsayTextFields[key]) {
                    this.vsayTextFields[key].value = vsayOptions[key];
                }
            }
        } catch (error) {
            console.error("Failed to load persona data:", error);
        }
    }

    async handlePersonaChange(event) {
        const selectedPersona = event.target.value;
        localStorage.setItem('lastPersona', selectedPersona); // localStorageに保存
        try {
            const response = await fetch('/api/current_persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selectedPersona }) });
            const data = await response.json();
            if (data.status === 'success') {
                this.updateUIAfterPersonaChange(data.persona);
                this.currentPersonaName = selectedPersona;
                const vsayOptions = data.persona.vsayOptions || {};
                for (const key in vsayOptions) {
                    if (this.vsaySliders[key]) {
                        this.vsaySliders[key].value = vsayOptions[key];
                        this.vsaySliderValues[key].textContent = parseFloat(vsayOptions[key]).toFixed(2);
                    } else if (this.vsayTextFields[key]) {
                        this.vsayTextFields[key].value = vsayOptions[key];
                    }
                }
            }
        } catch (error) {
            console.error("Failed to set persona:", error);
        }
    }

    updateUIAfterPersonaChange(persona) {
        document.title = persona.avatarFullName;
        this.avatarImg.src = `/static/images/${persona.avatarImageIdle}`;
        this.avatarImg.alt = persona.avatarName.toUpperCase();
        this.avatarLabel.textContent = persona.avatarName.toUpperCase();
        const systemLine = this.output.querySelector('.line.system');
        if(systemLine) systemLine.textContent = `> SYSTEM: ${persona.avatarFullName} Online`;
    }

    async saveCurrentPersonaVsaySettings(newVsayOption) {
        const personaName = this.currentPersonaName;
        if (!personaName) return;

        try {
            const response = await fetch(`/api/current_persona`);
            const currentPersona = await response.json();
            const updatedOptions = { ...currentPersona.data.vsayOptions, ...newVsayOption };

            await fetch('/api/persona_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: personaName, 
                    settings: { vsayOptions: updatedOptions } 
                })
            });
        } catch (error) {
            console.error("Failed to save vsay settings:", error);
        }
    }

    processFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) return;
        this.fileNameDisplay.textContent = file.name;
        this.fileDisplayContainer.style.display = 'flex';
        const reader = new FileReader();
        reader.onload = (e) => { this.uploadedFileData = { file: file, dataUrl: e.target.result }; };
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