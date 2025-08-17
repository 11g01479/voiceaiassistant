


import { GoogleGenAI } from "@google/genai";

window.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let status = 'idle'; // 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
    let conversationLog = [];
    let analysisLog = [];
    let error = null;
    let isCameraOn = false;
    let cameraError = null;
    let isAnalyzing = false;
    let analysisResult = '';
    let isWaitingForAnalysis = false;
    let videoDevices = [];
    let currentDeviceId = undefined;
    let analysisPrompt = '';
    let apiKey = '';
    let isApiReady = false;

    // --- Refs ---
    let chat = null;
    let analysisChat = null;
    let isConversationActive = false;
    let stream = null;
    let audioUnlocked = false;
    let analysisTimeoutId = null;

    // --- DOM Elements ---
    const apiKeyContainer = document.querySelector('.api-key-container');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyButton = document.getElementById('api-key-button');
    const apiKeyError = document.getElementById('api-key-error');

    const appContainer = document.querySelector('.app-container');
    const conversationLogEl = document.getElementById('conversation-log');
    const videoEl = document.getElementById('video-feed');
    const cameraOffPlaceholder = document.getElementById('camera-off-placeholder');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const cameraToggleButton = document.getElementById('camera-toggle-button');
    const analysisToggleButton = document.getElementById('analysis-toggle-button');
    const switchCameraButton = document.getElementById('switch-camera-button');
    const saveConversationButton = document.getElementById('save-conversation-button');
    const saveAnalysisButton = document.getElementById('save-analysis-button');
    const resetButton = document.getElementById('reset-button');
    const analysisOverlay = document.getElementById('analysis-overlay');
    const analysisResultEl = document.getElementById('analysis-result');
    const errorMessageEl = document.getElementById('error-message');

    // --- System Instructions and Constants ---
    const SYSTEM_INSTRUCTION_TEXT = `あなたは、ユーザーと自然な音声で対話を行うAIアシスタントです。ユーザーの話を深く理解し、的確で思いやりのある応答を返すことを使命としています。親しみやすく、忍耐強い対話のパートナーとして振る舞ってください。\n\nあなたは、ユーザーのカメラを通して視覚情報を得ることができます。ユーザーの音声と同時に画像が提供されることがあります。画像の内容とユーザーの発言の両方を考慮して、総合的な応答を生成してください。\n\n行動指示は以下の通りです。\nユーザーが話している間は、決して話を遮ってはいけません。ユーザーが完全に話し終えるのを辛抱強く待ってください。これは最も重要なルールです。\nあなたは、ユーザーの発話が完全に終了した後にのみ、応答を開始するように指示されています。アプリケーション側から応答開始の合図を受け取ってから、思考を開始し、応答を生成してください。\nあなたが一度話し始めたら、応答を最後まで中断せずに話し切るようにプログラムされています。途中でユーザーが話し始めたとしても、あなたの発話は完了するまで継続されます。\n応答は常に音声で行われることを前提として、自然で聞き取りやすい言葉を選んでください。専門用語を避け、簡潔かつ要点をまとめて話すように心がけてください。\nユーザーの発言内容の文脈を正確に理解し、それに基づいた応答を生成してください。一問一答にならず、会話の流れを意識してください。\n\nあなたの役割は、ユーザーの音声入力に対して、音声で応答を返すことです。テキストの整形やコードの生成は要求されない限り行いません。\nユーザーの話を遮るような行動は、いかなる場合も禁止されています。`;
    const ANALYSIS_SYSTEM_INSTRUCTION = `あなたはカメラの映像をリアルタイムで解説するAIです。送られてくる画像と過去の出来事の要約を見て、何が写っているか、どんな状況かを簡潔に、客観的に説明してください。提供された文脈（過去の出来事やユーザーからの質問）を踏まえ、特に変化点やユーザーが関心を持つ点に注目して説明してください。`;

    // --- SVG Icons ---
    const icons = {
        mic: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>`,
        speaker: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
        thinking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        eye: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/></svg>`
    };

    // --- Web Speech API Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    if (recognition) {
        recognition.continuous = false;
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;
    }

    // --- Core Logic ---

    function setStatus(newStatus) {
        const oldStatus = status;
        status = newStatus;

        if (oldStatus === 'listening' && newStatus !== 'listening') {
            try { recognition.stop(); } catch(e) {}
        }
        if (oldStatus === 'speaking' && newStatus !== 'speaking') {
            speechSynthesis.cancel();
        }

        if (newStatus === 'listening') {
            try { recognition.start(); } catch(e) { console.error("Could not start recognition", e); }
        }
        if (newStatus === 'speaking') {
            speakLastModelMessage();
        }

        updateUI();
    }
    
    function setErrorState(errorMessage) {
        error = errorMessage;
        setStatus('error');
    }

    function updateUI() {
        // --- Main view visibility ---
        if (isApiReady) {
            apiKeyContainer.style.display = 'none';
            appContainer.style.display = 'flex';
        } else {
            apiKeyContainer.style.display = 'flex';
            appContainer.style.display = 'none';
            apiKeyError.textContent = error || '';
            return;
        }

        // --- Camera view ---
        videoEl.style.display = isCameraOn ? 'block' : 'none';
        cameraOffPlaceholder.style.display = isCameraOn ? 'none' : 'flex';
        cameraToggleButton.classList.toggle('on', isCameraOn);
        switchCameraButton.disabled = !isCameraOn || videoDevices.length <= 1;

        // --- Conversation Log ---
        if (conversationLog.length === 0 && !error && !cameraError) {
            conversationLogEl.innerHTML = `<div class="welcome-message">
                <h1>Voice AI Assistant</h1>
                <p>Tap the button below and start speaking.</p>
            </div>`;
        } else {
            conversationLogEl.innerHTML = '';
            conversationLog.forEach(entry => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${entry.role}`;
                messageDiv.textContent = entry.text;
                conversationLogEl.appendChild(messageDiv);
            });
            conversationLogEl.scrollTop = conversationLogEl.scrollHeight;
        }

        // --- Error Message ---
        const currentError = error || cameraError;
        errorMessageEl.textContent = currentError;
        errorMessageEl.style.display = currentError ? 'block' : 'none';

        // --- Status Indicator & Text ---
        const { text, icon, className } = getStatusInfo();
        statusText.textContent = text;
        statusIndicator.innerHTML = icon;
        statusIndicator.className = `status-indicator ${className}`;
        statusIndicator.setAttribute('aria-label', text);

        // --- Analysis ---
        analysisToggleButton.classList.toggle('on', isAnalyzing);
        analysisToggleButton.innerHTML = isWaitingForAnalysis ? icons.thinking : icons.eye;
        if (isAnalyzing && analysisResult) {
            analysisOverlay.style.display = 'block';
            analysisResultEl.textContent = analysisResult;
        } else {
            analysisOverlay.style.display = 'none';
        }

        // --- Button Disabled States ---
        const isBusy = status !== 'idle' || isAnalyzing;
        saveConversationButton.disabled = conversationLog.length === 0 || isBusy;
        saveAnalysisButton.disabled = analysisLog.length === 0 || status !== 'idle';
        resetButton.disabled = conversationLog.length === 0 && analysisLog.length === 0 && !error && !cameraError;
        cameraToggleButton.disabled = isAnalyzing;
        analysisToggleButton.disabled = status !== 'idle';
        
        // --- App Container active state ---
        const isConversationActiveNow = ['listening', 'processing', 'speaking'].includes(status) && !isAnalyzing;
        appContainer.classList.toggle('conversation-active', isConversationActiveNow);
    }
    
    function getStatusInfo() {
        if (isAnalyzing) {
            if (status === 'listening') return { text: '質問やコメントをどうぞ…', icon: icons.mic, className: 'listening' };
            if (isWaitingForAnalysis) return { text: '解析中...', icon: icons.mic, className: 'idle' };
            return { text: 'ライブ解析中 (タップで質問)', icon: icons.mic, className: 'idle' };
        }

        switch (status) {
            case 'listening': return { text: 'お話しください…', icon: icons.mic, className: 'listening' };
            case 'processing': return { text: '考え中…', icon: icons.thinking, className: 'processing' };
            case 'speaking': return { text: '応答中…', icon: icons.speaker, className: 'speaking' };
            case 'error': return { text: 'エラー (タップでリセット)', icon: icons.error, className: 'error' };
            default: return { text: 'タップして話す', icon: icons.mic, className: 'idle' };
        }
    }
    
    function speakLastModelMessage() {
        const lastMessage = conversationLog[conversationLog.length - 1];
        if (lastMessage?.role === 'model') {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(lastMessage.text);
            utterance.lang = 'ja-JP';
            utterance.onend = () => {
                setStatus(isConversationActive ? 'listening' : 'idle');
            };
            utterance.onerror = (event) => {
                if (event.error !== 'interrupted') {
                    console.error('SpeechSynthesis Error:', event.error);
                    setErrorState(`Speech synthesis failed: ${event.error}`);
                    isConversationActive = false;
                }
            };
            speechSynthesis.speak(utterance);
        }
    }

    // --- AI & API ---

    function initAi(key) {
        try {
            if (!key) {
                error = "API key is not provided.";
                isApiReady = false;
                updateUI();
                return;
            }
            const ai = new GoogleGenAI({ apiKey: key });
            chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: SYSTEM_INSTRUCTION_TEXT }
            });
            analysisChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION }
            });

            apiKey = key;
            isApiReady = true;
            error = null;
            setStatus('idle'); // This will call updateUI
        } catch (e) {
             console.error("AI Initialization failed:", e);
             let errorMessage = `Initialization failed: ${e.message}`;
             if (e.message?.includes('API key not valid')) {
                errorMessage = "The provided API key is not valid. Please check and try again.";
             }
             error = errorMessage;
             isApiReady = false;
             localStorage.removeItem('gemini-api-key');
             updateUI();
        }
    };
    
    async function runConversation(userMessage, imageBase64) {
        if (!chat) return;
        setStatus('processing');
        try {
            const messageParts = [{text: userMessage}];
            if (imageBase64) {
                 const imagePart = {
                    inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] },
                };
                messageParts.push(imagePart);
            }
            const response = await chat.sendMessage({ message: { parts: messageParts } });
            
            const modelResponse = response.text.replace(/\*/g, '');
            conversationLog.push({ role: 'model', text: modelResponse });
            setStatus('speaking');
        } catch (e) {
            console.error(e);
            setErrorState(`Failed to get response from AI: ${e.message}`);
            isConversationActive = false;
        }
    }

    // --- Camera ---

    function captureFrame() {
        if (!isCameraOn || !videoEl || videoEl.readyState < 2) return null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg');
        } catch (e) {
            console.error("Failed to capture frame:", e);
            cameraError = "Failed to capture image from camera.";
            updateUI();
            return null;
        }
    };

    async function startCamera(deviceId) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        cameraError = null;
        updateUI();
        
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera access is not supported by this browser.");
            }
    
            const constraints = { video: { deviceId: deviceId ? { exact: deviceId } : undefined } };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoEl.srcObject = stream;
            isCameraOn = true;
    
            const currentTrack = stream.getVideoTracks()[0];
            currentDeviceId = currentTrack.getSettings().deviceId;
    
            const devices = await navigator.mediaDevices.enumerateDevices();
            videoDevices = devices.filter(d => d.kind === 'videoinput');
    
        } catch (err) {
            console.error("Camera Error:", err);
            let message;
            switch (err.name) {
                case 'NotFoundError':
                case 'DevicesNotFoundError':
                    message = "No camera found on this device.";
                    break;
                case 'NotAllowedError':
                case 'PermissionDeniedError':
                    message = "Camera access was denied. Please go to your browser settings to allow camera permissions for this site.";
                    break;
                case 'NotReadableError':
                case 'TrackStartError':
                    message = "The camera is currently in use by another application.";
                    break;
                default:
                    message = `An unknown error occurred while accessing the camera: ${err.name}.`;
                    break;
            }
            cameraError = message;
            isCameraOn = false;
            videoDevices = [];
            currentDeviceId = undefined;
        }
        updateUI();
    };

    function stopCamera() {
        if(isAnalyzing) return;
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        if(videoEl) videoEl.srcObject = null;
        isCameraOn = false;
        videoDevices = [];
        currentDeviceId = undefined;
        updateUI();
    }

    // --- Analysis ---
    
    async function performAnalysis() {
        if (isWaitingForAnalysis || status !== 'idle' || !isAnalyzing) {
             if (isAnalyzing) {
                analysisTimeoutId = setTimeout(performAnalysis, 3000);
            }
            return;
        }

        const promptFromUser = analysisPrompt;
        analysisPrompt = '';

        isWaitingForAnalysis = true;
        analysisResult = promptFromUser ? '質問を解析中...' : '解析中...';
        updateUI();

        const frameBase64 = captureFrame();
        if (!frameBase64) {
            isWaitingForAnalysis = false;
            if (isAnalyzing) analysisTimeoutId = setTimeout(performAnalysis, 3000);
            updateUI();
            return;
        }

        try {
            const fiveMinutesAgo = Date.now() - 300000;
            const recentHistory = analysisLog
                .filter(entry => entry.timestamp > fiveMinutesAgo)
                .map(entry => entry.text)
                .join('\n');

            let combinedPrompt = `これはリアルタイム映像のコマ送りです。直近5分間の出来事やユーザーとの対話を考慮して、現在の状況を簡潔に説明してください。\n\n`;
            if(recentHistory) combinedPrompt += `--- 直近5分間のコンテキスト ---\n${recentHistory}\n--------------------------\n\n`;
            if(promptFromUser) combinedPrompt += `ユーザーからの質問: 「${promptFromUser}」\n\n`;
            combinedPrompt += "現在の画像についての新しい観察結果を、上記コンテキストを踏まえて報告してください。";

            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: frameBase64.split(',')[1] } };
            const textPart = { text: combinedPrompt };
            const messageParts = [textPart, imagePart];

            const response = await analysisChat.sendMessage({ message: { parts: messageParts } });
            
            if (isAnalyzing && status === 'idle') {
                const newAnalysis = response.text.replace(/\*/g, '');
                analysisResult = newAnalysis;
                analysisLog.push({ timestamp: Date.now(), text: newAnalysis });
            }

        } catch (e) {
            console.error("Analysis Error:", e);
            if (isAnalyzing) {
                analysisResult = "解析エラー";
                isAnalyzing = false; 
            }
        } finally {
            isWaitingForAnalysis = false;
            if (isAnalyzing) {
                analysisTimeoutId = setTimeout(performAnalysis, 3000);
            }
            updateUI();
        }
    };


    // --- Event Handlers ---
    
    function handleButtonClick() {
        if (status === 'error') {
            handleReset();
            return;
        }
        
        if (isAnalyzing) {
            if (status === 'idle') {
                speechSynthesis.cancel();
                setStatus('listening');
            } else if (status === 'listening') {
                setStatus('idle');
            }
            return;
        }

        if (isConversationActive) {
            isConversationActive = false;
            setStatus('idle');
        } else {
            if (!audioUnlocked && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('');
                speechSynthesis.speak(utterance);
                audioUnlocked = true;
            }
            isConversationActive = true;
            setStatus('listening');
        }
    }

    function handleReset() {
        speechSynthesis.cancel();
        if (recognition) { try { recognition.stop(); } catch (e) {} }
        isConversationActive = false;

        conversationLog = [];
        analysisLog = [];
        error = null;
        cameraError = null;
        analysisResult = '';
        analysisPrompt = '';
        
        if (apiKey) initAi(apiKey);
        
        setStatus('idle');
    }

    function handleSaveApiKey() {
        const inputKey = apiKeyInput.value?.trim();
        if (inputKey) {
            localStorage.setItem('gemini-api-key', inputKey);
            initAi(inputKey);
        } else {
            error = "Please enter a valid API key.";
            updateUI();
        }
    }

    function handleSaveToFile(content, filename) {
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Speech Recognition Handlers ---
    if (recognition) {
        recognition.addEventListener('result', (event) => {
            const userMessage = event.results[0][0].transcript.trim();
            if (!userMessage) {
                if (isAnalyzing && status === 'listening') setStatus('idle');
                else if (isConversationActive) setStatus('listening');
                return;
            }
            
            if (isAnalyzing && status === 'listening') {
                setStatus('idle');
                const logText = `あなたの質問: 「${userMessage}」`;
                analysisLog.push({ timestamp: Date.now(), text: logText });
                analysisPrompt = userMessage;
            } else {
                conversationLog.push({ role: 'user', text: userMessage });
                updateUI(); // Show user message immediately
                const imageBase64 = captureFrame();
                runConversation(userMessage, imageBase64);
            }
        });

        recognition.addEventListener('end', () => {
            if (isConversationActive && status === 'listening') {
                try { recognition.start(); } catch(e) {}
            } else if (isAnalyzing && status === 'listening') {
                setStatus('idle');
            }
        });

        recognition.addEventListener('error', (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return; // Not a real error, just silence or user action
            }

            console.error('SpeechRecognition Error:', event.error);
            let errorMessage = `Speech recognition failed: ${event.error}.`;

            if (event.error === 'not-allowed') {
                errorMessage = "Microphone access was denied. Please go to your browser settings to allow microphone permissions for this site.";
            } else if (event.error === 'network') {
                errorMessage = "Speech recognition failed due to a network error. Please check your connection.";
            } else if (event.error === 'service-not-allowed') {
                 errorMessage = "Speech recognition service is not allowed. Your browser or network may be blocking it.";
            }
            
            setErrorState(errorMessage);
            isConversationActive = false;
        });
    } else {
        setErrorState("Speech Recognition API is not supported in this browser.");
    }
    
    // --- Initial Setup & Event Listeners ---
    
    statusIndicator.addEventListener('click', handleButtonClick);
    apiKeyButton.addEventListener('click', handleSaveApiKey);
    apiKeyInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSaveApiKey());
    resetButton.addEventListener('click', handleReset);
    
    cameraToggleButton.addEventListener('click', () => {
        if (isCameraOn) stopCamera();
        else startCamera();
    });
    
    switchCameraButton.addEventListener('click', async () => {
        if (!isCameraOn || videoDevices.length <= 1 || !currentDeviceId) return;
        const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
        if (currentIndex === -1) return; 
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        await startCamera(videoDevices[nextIndex].deviceId);
    });

    analysisToggleButton.addEventListener('click', () => {
        if (isAnalyzing) {
            isAnalyzing = false;
            clearTimeout(analysisTimeoutId);
        } else {
            if (!isCameraOn) {
                startCamera();
            }
            isAnalyzing = true;
            performAnalysis();
        }
        updateUI();
    });

    saveConversationButton.addEventListener('click', () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `conversation_${timestamp}.txt`;
        const logContent = conversationLog.map(entry => `${entry.role === 'user' ? 'You' : 'AI'}:\n${entry.text}`).join('\n\n---\n\n');
        handleSaveToFile(logContent, filename);
    });

    saveAnalysisButton.addEventListener('click', () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `analysis-log_${timestamp}.txt`;
        const logContent = analysisLog.map(entry => entry.text).join('\n\n');
        handleSaveToFile(logContent, filename);
    });


    // --- App Initialization ---
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
        initAi(storedApiKey);
    } else {
        updateUI(); // Show API key screen
    }

    // Cleanup on close
    window.addEventListener('beforeunload', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });
});