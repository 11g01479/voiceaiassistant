
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat, Part } from "@google/genai";

// --- Fix for TypeScript: Add definitions for Web Speech API ---
// This adds browser-specific speech recognition types that are not in the
// default TypeScript library, resolving compilation errors.
declare global {
  interface Window {
    SpeechRecognition: new () => any;
    webkitSpeechRecognition: new () => any;
  }
}

// Define the specific event types used in the component's handlers.
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index:number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// --- Constants and System Instructions ---
const SYSTEM_INSTRUCTION_TEXT = `あなたは、ユーザーと自然な音声で対話を行うAIアシスタントです。ユーザーの話を深く理解し、的確で思いやりのある応答を返すことを使命としています。親しみやすく、忍耐強い対話のパートナーとして振る舞ってください。

あなたは、ユーザーのカメラを通して視覚情報を得ることができます。ユーザーの音声と同時に画像が提供されることがあります。画像の内容とユーザーの発言の両方を考慮して、総合的な応答を生成してください。

行動指示は以下の通りです。
ユーザーが話している間は、決して話を遮ってはいけません。ユーザーが完全に話し終えるのを辛抱強く待ってください。これは最も重要なルールです。
あなたは、ユーザーの発話が完全に終了した後にのみ、応答を開始するように指示されています。アプリケーション側から応答開始の合図を受け取ってから、思考を開始し、応答を生成してください。
あなたが一度話し始めたら、応答を最後まで中断せずに話し切るようにプログラムされています。途中でユーザーが話し始めたとしても、あなたの発話は完了するまで継続されます。
応答は常に音声で行われることを前提として、自然で聞き取りやすい言葉を選んでください。専門用語を避け、簡潔かつ要点をまとめて話すように心がけてください。
ユーザーの発言内容の文脈を正確に理解し、それに基づいた応答を生成してください。一問一答にならず、会話の流れを意識してください。

あなたの役割は、ユーザーの音声入力に対して、音声で応答を返すことです。テキストの整形やコードの生成は要求されない限り行いません。
ユーザーの話を遮るような行動は、いかなる場合も禁止されています。
`;

const ANALYSIS_SYSTEM_INSTRUCTION = `あなたはカメラの映像をリアルタイムで解説するAIです。送られてくる画像と過去の出来事の要約を見て、何が写っているか、どんな状況かを簡潔に、客観的に説明してください。提供された文脈（過去の出来事やユーザーからの質問）を踏まえ、特に変化点やユーザーが関心を持つ点に注目して説明してください。`;


// --- Web Speech API Setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
}

// --- SVG Icons ---
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
);

const SpeakerIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
);

const ThinkingIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

const ErrorIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
);

const CameraIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 10.5h5.2v5H9.4v-5zm-2.4 5c0 .55.45 1 1 1h5.2c.55 0 1-.45 1-1v-5c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v5zm8-7.5L12.95 6H9.05L7 8H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1h-3z"/></svg>
);

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/></svg>
);

const SwitchCameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-5 13.5V17H9v1.5H7.5V17H6v-5h1.5V10H9V8.5h6V10h1.5v2H18v5h-1.5v1.5h-1.5zM15 12c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3z"/>
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
);

const LogIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
);

const ResetIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
);


// --- React App Component ---
const App = () => {
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
    const [conversationLog, setConversationLog] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [analysisLog, setAnalysisLog] = useState<{ timestamp: number; text: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [isWaitingForAnalysis, setIsWaitingForAnalysis] = useState(false);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(undefined);
    const [analysisPrompt, setAnalysisPrompt] = useState<string>('');

    const [apiKey, setApiKey] = useState<string>('');
    const [isApiReady, setIsApiReady] = useState<boolean>(false);
    const apiKeyInputRef = useRef<HTMLInputElement>(null);

    const chatRef = useRef<Chat | null>(null);
    const analysisChatRef = useRef<Chat | null>(null);
    const isConversationActiveRef = useRef<boolean>(false);
    const conversationLogRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioUnlockedRef = useRef<boolean>(false);

    const initAi = (key: string) => {
        try {
            if (!key) {
                setError("API key is not provided.");
                setStatus('idle');
                setIsApiReady(false);
                return;
            }
            const ai = new GoogleGenAI({ apiKey: key });
            chatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: SYSTEM_INSTRUCTION_TEXT }
            });
            analysisChatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION }
            });

            setApiKey(key);
            setIsApiReady(true);
            setStatus('idle');
            setError(null);
        } catch (e: any) {
             console.error("AI Initialization failed:", e);
             let errorMessage = `Initialization failed: ${e.message}`;
             if (e.message?.includes('API key not valid')) {
                errorMessage = "The provided API key is not valid. Please check and try again.";
             }
             setError(errorMessage);
             setStatus('idle');
             setIsApiReady(false);
             localStorage.removeItem('gemini-api-key');
        }
    };

    useEffect(() => {
        const storedApiKey = localStorage.getItem('gemini-api-key');
        if (storedApiKey) {
            initAi(storedApiKey);
        }
         // Cleanup camera on unmount
        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    useEffect(() => {
        if (conversationLogRef.current) {
            conversationLogRef.current.scrollTop = conversationLogRef.current.scrollHeight;
        }
    }, [conversationLog]);

    useEffect(() => {
        if (isCameraOn && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOn]);

    const captureFrame = (): string | null => {
        if (!isCameraOn || !videoRef.current || videoRef.current.readyState < 2) {
            return null;
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg');
        } catch (e) {
            console.error("Failed to capture frame:", e);
            setCameraError("Failed to capture image from camera.");
            return null;
        }
    };

    const runConversation = async (userMessage: string, imageBase64: string | null) => {
        if (!chatRef.current) return;
        setStatus('processing');
        try {
            let response;
            const message: (string | Part)[] = [userMessage];
            if (imageBase64) {
                 const imagePart = {
                    inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] },
                };
                message.push(imagePart);
            }
            response = await chatRef.current.sendMessage({ message });
            
            const modelResponse = response.text.replace(/\*/g, '');
            setConversationLog(prev => [...prev, { role: 'model', text: modelResponse }]);
            setStatus('speaking');
        } catch (e: any) {
            console.error(e);
            setError(`Failed to get response from AI: ${e.message}`);
            setStatus('error');
            isConversationActiveRef.current = false;
        }
    };
    
    const startCamera = async (deviceId?: string) => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setCameraError(null);
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera access is not supported by this browser.");
            }
    
            const constraints = { video: { deviceId: deviceId ? { exact: deviceId } : undefined } };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
    
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraOn(true);
    
            const currentTrack = stream.getVideoTracks()[0];
            const settings = currentTrack.getSettings();
            setCurrentDeviceId(settings.deviceId);
    
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            setVideoDevices(videoInputs);
    
        } catch (err: any) {
            console.error("Camera Error:", err);
            let message;
            switch (err.name) {
                case 'NotFoundError':
                case 'DevicesNotFoundError':
                    message = "No camera found on this device. Please connect a camera and try again.";
                    break;
                case 'NotAllowedError':
                case 'PermissionDeniedError':
                    message = "Camera access was denied. Please enable camera permissions in your browser and system settings.";
                    break;
                case 'NotReadableError':
                case 'TrackStartError':
                    message = "The camera is currently in use by another application or could not be accessed due to a hardware error.";
                    break;
                case 'OverconstrainedError':
                case 'ConstraintNotSatisfiedError':
                    message = "The camera does not meet the required specifications.";
                    break;
                case 'AbortError':
                    message = "The camera access request was aborted.";
                    break;
                case 'SecurityError':
                     message = "Camera access is blocked by security settings. This may be due to browser policies (e.g., requiring HTTPS) or system security software.";
                    break;
                default:
                    message = `An unknown error occurred while accessing the camera: ${err.name}.`;
                    break;
            }
            setCameraError(message);
            setIsCameraOn(false);
            setVideoDevices([]);
            setCurrentDeviceId(undefined);
        }
    };

    const handleToggleCamera = async () => {
        if (isCameraOn) {
            if(isAnalyzing) return;
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            if(videoRef.current) videoRef.current.srcObject = null;
            setIsCameraOn(false);
            setVideoDevices([]);
            setCurrentDeviceId(undefined);
        } else {
            await startCamera();
        }
    };
    
    const handleSwitchCamera = async () => {
        if (!isCameraOn || videoDevices.length <= 1 || !currentDeviceId) return;

        try {
            const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
            if (currentIndex === -1) return; 

            const nextIndex = (currentIndex + 1) % videoDevices.length;
            const nextDeviceId = videoDevices[nextIndex].deviceId;
            
            await startCamera(nextDeviceId);
        } catch (err) {
            console.error("Failed to switch camera:", err);
            setCameraError("Could not switch to the next camera.");
        }
    };

    const handleToggleAnalysis = () => {
        if (isAnalyzing) {
            setIsAnalyzing(false);
        } else {
            if (!isCameraOn) {
                handleToggleCamera(); 
            }
            setIsAnalyzing(true);
        }
    };
    
    useEffect(() => {
        if (!isAnalyzing || !isCameraOn) {
            return;
        }
    
        let timeoutId: number;
    
        const performAnalysis = async () => {
            if (isWaitingForAnalysis || status !== 'idle' || !isAnalyzing) {
                 if (isAnalyzing) {
                    timeoutId = window.setTimeout(performAnalysis, 3000);
                }
                return;
            }
    
            const promptFromUser = analysisPrompt;
            setAnalysisPrompt('');
    
            setIsWaitingForAnalysis(true);
            setAnalysisResult(promptFromUser ? '質問を解析中...' : '解析中...');
    
            const frameBase64 = captureFrame();
            if (!frameBase64) {
                setIsWaitingForAnalysis(false);
                if (isAnalyzing) timeoutId = window.setTimeout(performAnalysis, 3000);
                return;
            }
    
            try {
                const fiveMinutesAgo = Date.now() - 300000; // 5 minutes (300,000 ms)
                const recentHistory = analysisLog
                    .filter(entry => entry.timestamp > fiveMinutesAgo)
                    .map(entry => entry.text)
                    .join('\n');

                let combinedPrompt = `これはリアルタイム映像のコマ送りです。直近5分間の出来事やユーザーとの対話を考慮して、現在の状況を簡潔に説明してください。\n\n`;
                if(recentHistory) {
                    combinedPrompt += `--- 直近5分間のコンテキスト ---\n${recentHistory}\n--------------------------\n\n`;
                }
                if(promptFromUser) {
                    combinedPrompt += `ユーザーからの質問: 「${promptFromUser}」\n\n`;
                }
                combinedPrompt += "現在の画像についての新しい観察結果を、上記コンテキストを踏まえて報告してください。";

                const imagePart: Part = { inlineData: { mimeType: 'image/jpeg', data: frameBase64.split(',')[1] } };
                const textPart: Part = { text: combinedPrompt };
                const messageParts: Part[] = [textPart, imagePart];

                const response = await analysisChatRef.current.sendMessage({ message: messageParts });
    
                if (!isAnalyzing || status !== 'idle') {
                    return; 
                }
    
                const newAnalysis = response.text.replace(/\*/g, '');
                setAnalysisResult(newAnalysis);
                setAnalysisLog(prev => [...prev, { timestamp: Date.now(), text: newAnalysis }]);
    
            } catch (e: any) {
                console.error("Analysis Error:", e);
                if (isAnalyzing) {
                    setAnalysisResult("解析エラー");
                    setIsAnalyzing(false); 
                }
            } finally {
                setIsWaitingForAnalysis(false);
                if (isAnalyzing) {
                    timeoutId = window.setTimeout(performAnalysis, 3000);
                }
            }
        };
    
        performAnalysis();
    
        return () => {
            clearTimeout(timeoutId);
        };
    }, [isAnalyzing, isCameraOn, analysisPrompt, status]);
    

    useEffect(() => {
        if (status === 'speaking') {
            const lastMessage = conversationLog[conversationLog.length - 1];
            if (lastMessage?.role === 'model') {
                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(lastMessage.text);
                utterance.lang = 'ja-JP';
                utterance.onend = () => {
                    if (isConversationActiveRef.current) {
                        setStatus('listening');
                    } else {
                        setStatus('idle');
                    }
                };
                utterance.onerror = (event) => {
                    if (event.error !== 'interrupted') {
                        console.error('SpeechSynthesis Error:', event.error);
                        setError(`Speech synthesis failed: ${event.error}`);
                        setStatus('error');
                        isConversationActiveRef.current = false;
                    }
                };
                speechSynthesis.speak(utterance);
                return () => {
                    utterance.onend = null;
                    utterance.onerror = null;
                    speechSynthesis.cancel();
                };
            }
        }
    }, [status, conversationLog]);

    useEffect(() => {
        if (!recognition) {
            setError("Speech Recognition API is not supported in this browser.");
            setStatus('error');
            return;
        }

        const handleRecognitionResult = (event: SpeechRecognitionEvent) => {
            const userMessage = event.results[0][0].transcript.trim();
            if (!userMessage) {
                if (isAnalyzing && status === 'listening') setStatus('idle');
                else if (isConversationActiveRef.current) setStatus('listening');
                return;
            }
            
            if (isAnalyzing && status === 'listening') {
                setStatus('idle');
                const logText = `あなたの質問: 「${userMessage}」`;
                setAnalysisLog(prev => [...prev, { timestamp: Date.now(), text: logText }]);
                setAnalysisPrompt(userMessage);
            } else {
                setConversationLog(prev => [...prev, { role: 'user', text: userMessage }]);
                const imageBase64 = captureFrame();
                runConversation(userMessage, imageBase64);
            }
        };

        const handleRecognitionEnd = () => {
            if (isConversationActiveRef.current && status === 'listening') {
                try { recognition.start(); } catch(e) {}
            } else if (isAnalyzing && status === 'listening') {
                // This handles timeouts or no-speech during analysis questions,
                // preventing the UI from getting stuck in the listening state.
                setStatus('idle');
            }
        };

        const handleRecognitionError = (event: SpeechRecognitionErrorEvent) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error('SpeechRecognition Error:', event.error);
                setError(`Speech recognition failed: ${event.error}. Please check microphone permissions.`);
                setStatus('error');
                isConversationActiveRef.current = false;
            }
        };

        recognition.addEventListener('result', handleRecognitionResult);
        recognition.addEventListener('end', handleRecognitionEnd);
        recognition.addEventListener('error', handleRecognitionError);

        if (status === 'listening') {
            try { recognition.start(); } catch(e) { console.error("Could not start recognition", e); }
        } else {
            try { recognition.stop(); } catch(e) {}
        }

        return () => {
            recognition.removeEventListener('result', handleRecognitionResult);
            recognition.removeEventListener('end', handleRecognitionEnd);
            recognition.removeEventListener('error', handleRecognitionError);
            if (recognition.stop) recognition.stop();
        };
    }, [status, isAnalyzing]);

    const handleReset = () => {
        speechSynthesis.cancel();
        if (recognition) {
            try { recognition.stop(); } catch (e) {}
        }
        isConversationActiveRef.current = false;

        setStatus('idle');
        setConversationLog([]);
        setAnalysisLog([]);
        setError(null);
        setCameraError(null);
        setAnalysisResult('');
        setAnalysisPrompt('');
        
        if (apiKey) {
            initAi(apiKey);
        }
    };

    const handleButtonClick = () => {
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

        if (isConversationActiveRef.current) {
            isConversationActiveRef.current = false;
            speechSynthesis.cancel();
            try { recognition.stop(); } catch(e) { /* ignore */ }
            setStatus('idle');
        } else {
            if (!audioUnlockedRef.current && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('');
                speechSynthesis.speak(utterance);
                audioUnlockedRef.current = true;
            }
            isConversationActiveRef.current = true;
            setStatus('listening');
        }
    };
    
    const handleSaveConversation = () => {
        if (conversationLog.length === 0) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `conversation_${timestamp}.txt`;
        
        const logContent = conversationLog.map(entry => {
            const prefix = entry.role === 'user' ? 'You:' : 'AI:';
            return `${prefix}\n${entry.text}`;
        }).join('\n\n---\n\n');

        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const handleSaveAnalysis = () => {
        if (analysisLog.length === 0) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `analysis-log_${timestamp}.txt`;
        
        const logContent = analysisLog.map(entry => entry.text).join('\n\n');

        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveApiKey = () => {
        const inputKey = apiKeyInputRef.current?.value?.trim();
        if (inputKey) {
            localStorage.setItem('gemini-api-key', inputKey);
            initAi(inputKey);
        } else {
            setError("Please enter a valid API key.");
        }
    };

    const getStatusInfo = () => {
        if (isAnalyzing) {
            if (status === 'listening') return { text: '質問やコメントをどうぞ…', icon: <MicIcon />, className: 'listening' };
            if (isWaitingForAnalysis) return { text: '解析中...', icon: <MicIcon />, className: 'idle' };
            return { text: 'ライブ解析中 (タップで質問)', icon: <MicIcon />, className: 'idle' };
        }

        switch (status) {
            case 'listening': return { text: 'お話しください…', icon: <MicIcon />, className: 'listening' };
            case 'processing': return { text: '考え中…', icon: <ThinkingIcon />, className: 'processing' };
            case 'speaking': return { text: '応答中…', icon: <SpeakerIcon />, className: 'speaking' };
            case 'error': return { text: 'エラー (タップでリセット)', icon: <ErrorIcon />, className: 'error' };
            default: return { text: 'タップして話す', icon: <MicIcon />, className: 'idle' };
        }
    };
    
    if (!isApiReady) {
        return (
            <div className="api-key-container">
                <div className="api-key-box">
                    <h1>AI Assistant Setup</h1>
                    <p>Please provide your Google Gemini API key to start the session.</p>
                    <input
                        ref={apiKeyInputRef}
                        type="password"
                        placeholder="Enter your API Key"
                        className="api-key-input"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                    />
                    <button onClick={handleSaveApiKey} className="api-key-button">
                        Start Session
                    </button>
                    {error && <p className="api-key-error">{error}</p>}
                     <p className="api-key-disclaimer">
                        Your API key is stored locally in your browser and is not sent anywhere else.
                    </p>
                </div>
            </div>
        );
    }

    const { text: statusText, icon: statusIcon, className: statusClassName } = getStatusInfo();
    const isConversationActive = ['listening', 'processing', 'speaking'].includes(status) && !isAnalyzing;

    return (
        <div className={`app-container ${isConversationActive ? 'conversation-active' : ''}`}>
             <div className="camera-container">
                <div className="top-left-controls">
                    <button
                        className="control-button save-conversation-button"
                        onClick={handleSaveConversation}
                        aria-label="Save Conversation"
                        title="Save Conversation"
                        disabled={conversationLog.length === 0 || isConversationActive || isAnalyzing}
                    >
                        <DownloadIcon />
                    </button>
                    <button
                        className="control-button save-analysis-button"
                        onClick={handleSaveAnalysis}
                        aria-label="Save Analysis Log"
                        title="Save Analysis Log"
                        disabled={analysisLog.length === 0 || isConversationActive || status === 'listening'}
                    >
                        <LogIcon />
                    </button>
                    <button
                        className="control-button reset-button"
                        onClick={handleReset}
                        aria-label="Reset Session"
                        title="Reset Session"
                        disabled={conversationLog.length === 0 && analysisLog.length === 0 && !error && !cameraError}
                    >
                        <ResetIcon />
                    </button>
                </div>
                {isCameraOn ? (
                    <>
                        <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
                        <div className="top-right-controls">
                            <button
                                className="control-button switch-camera-button"
                                onClick={handleSwitchCamera}
                                aria-label="Switch Camera"
                                title="Switch Camera"
                                disabled={isAnalyzing || videoDevices.length <= 1}
                            >
                                <SwitchCameraIcon />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="camera-off-placeholder">
                        <CameraIcon />
                        <p>Camera is off</p>
                    </div>
                )}
                 {isAnalyzing && analysisResult && (
                    <div className="analysis-overlay">
                        <p>{analysisResult}</p>
                    </div>
                )}
                <div className="controls-container">
                     <div className="button-row">
                        <button
                            className={`camera-toggle-button ${isCameraOn ? 'on' : 'off'}`}
                            onClick={handleToggleCamera}
                            aria-label="Toggle Camera"
                            disabled={isAnalyzing}
                        >
                            <CameraIcon />
                        </button>
                        <button
                            className={`status-indicator ${statusClassName}`}
                            onClick={handleButtonClick}
                            aria-label={statusText}
                        >
                            {isAnalyzing && status === 'idle' ? <MicIcon /> : statusIcon}
                        </button>
                        <button
                            className={`analysis-toggle-button ${isAnalyzing ? 'on' : ''}`}
                            onClick={handleToggleAnalysis}
                            aria-label="Toggle Live Analysis"
                            disabled={status !== 'idle'}
                        >
                            {isWaitingForAnalysis ? <ThinkingIcon /> : <EyeIcon />}
                        </button>
                     </div>
                    <p className="status-text">{statusText}</p>
                </div>
            </div>
            <div className="conversation-log" ref={conversationLogRef}>
                 {!conversationLog.length && !error && !cameraError && (
                    <div className="welcome-message">
                        <h1>Voice AI Assistant</h1>
                        <p>Tap the button below and start speaking.</p>
                    </div>
                )}
                {conversationLog.map((entry, index) => (
                    <div key={index} className={`message ${entry.role}`}>
                        {entry.text}
                    </div>
                ))}
            </div>
            {(error || cameraError) && <div className="error-message">{error || cameraError}</div>}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);