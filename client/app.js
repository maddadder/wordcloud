// app.js
// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadTranslationBtn = document.getElementById('downloadTranslationBtn');
const transcriptDiv = document.getElementById('transcript');
const translatedDiv = document.getElementById('translated');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');
const visualizer = document.getElementById('visualizer');
const audioDebug = document.getElementById('audioDebug');

// Audio visualization
const audioBars = [];

// Create audio bars for visualization
for (let i = 0; i < 64; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = '2px';
    visualizer.appendChild(bar);
    audioBars.push(bar);
}

// Configuration
const SERVER_URL = "wss://whisper-live.dankapps.app";
const MODEL = "openai/large-v3-turbo";
const USE_VAD = true;

// Audio statistics
const audioStats = {
    chunksSent: 0,
    lastChunkSize: 0,
    minAmplitude: Infinity,
    maxAmplitude: 0,
    sampleRate: 0,
    firstChunk: null
};

// Transcript storage for SRT file
const transcriptSegments = [];
const translatedSegments = [];
let recordingStartTime = 0;

function updateDebugInfo() {
    const firstChunkPreview = audioStats.firstChunk 
        ? `First: [${audioStats.firstChunk.slice(0, 5).map(v => v.toFixed(6)).join(', ')}...]` 
        : 'First: Not sent';
    
    audioDebug.textContent = 
        `Chunks Sent: ${audioStats.chunksSent}\n` +
        `Last Chunk Size: ${audioStats.lastChunkSize} samples\n` +
        `Min Amp: ${audioStats.minAmplitude.toFixed(6)}\n` +
        `Max Amp: ${audioStats.maxAmplitude.toFixed(6)}\n` +
        `Sample Rate: ${audioStats.sampleRate} Hz → 16000 Hz\n`;// +
        //`${firstChunkPreview}`;
}

// Format time for SRT file
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.round((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

// Generate SRT file content
function generateSRT() {
    let srtContent = '';
    let index = 1;
    
    for (const segment of transcriptSegments) {
        // Check if segment has start and end times
        if (segment.start !== undefined && segment.end !== undefined) {
            srtContent += `${index}\n`;
            srtContent += `${formatTime(segment.start)} --> ${formatTime(segment.end)}\n`;
            srtContent += `${segment.text}\n\n`;
            index++;
        } else if (segment.text) {
            // For messages without timestamps, create a generic segment
            srtContent += `${index}\n`;
            srtContent += `00:00:00,000 --> 00:00:00,000\n`;
            srtContent += `${segment.text}\n\n`;
            index++;
        }
    }
    
    return srtContent;
}


// Generate SRT file content
function generateTranslatedSRT() {
    let srtContent = '';
    let index = 1;
    
    for (const segment of translatedSegments) {
        // Check if segment has start and end times
        if (segment.start !== undefined && segment.end !== undefined) {
            srtContent += `${index}\n`;
            srtContent += `${formatTime(segment.start)} --> ${formatTime(segment.end)}\n`;
            srtContent += `${segment.text}\n\n`;
            index++;
        } else if (segment.text) {
            // For messages without timestamps, create a generic segment
            srtContent += `${index}\n`;
            srtContent += `00:00:00,000 --> 00:00:00,000\n`;
            srtContent += `${segment.text}\n\n`;
            index++;
        }
    }
    
    return srtContent;
}

// Download SRT file
function downloadSRT() {
    const srtContent = generateSRT();
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${new Date().toISOString().replace(/[:.]/g, '-')}.srt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}


// Download SRT file
function downloadTranslatedSRT() {
    const srtContent = generateTranslatedSRT();
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-${new Date().toISOString().replace(/[:.]/g, '-')}.srt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

// Start recording
async function startRecording() {
    try {
        // Reset transcript
        transcriptSegments.length = 0;
        translatedSegments.length = 0;
        transcriptDiv.innerHTML = "<p>Listening...</p>";
        translatedDiv.innerHTML = "<p>Waiting...</p>"

        // Reset stats
        audioStats.chunksSent = 0;
        audioStats.lastChunkSize = 0;
        audioStats.minAmplitude = Infinity;
        audioStats.maxAmplitude = 0;
        audioStats.firstChunk = null;
        recordingStartTime = Date.now();
        
        statusEl.textContent = "Status: Initializing...";
        downloadBtn.disabled = true;
        downloadTranslationBtn.disabled = true;
        
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioStats.sampleRate = audioContext.sampleRate;
        updateDebugInfo();
        
        // Add the AudioWorklet module with resampling
        await audioContext.audioWorklet.addModule('audio-worklet.js');
        
        // Get microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            video: false
        }).catch(error => {
            throw new Error(`Microphone access error: ${error.message}`);
        });
        
        // Log actual settings
        const audioTrack = mediaStream.getAudioTracks()[0];
        const settings = audioTrack.getSettings();
        console.log("Actual audio settings:", settings);
        audioStats.sampleRate = settings.sampleRate || audioContext.sampleRate;
        updateDebugInfo();
        
        // Create audio source
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        // Create AudioWorkletNode
        workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
        
        // Connect audio processing
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
        
        // Handle messages from AudioWorklet processor
        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'audioData' && websocket?.readyState === WebSocket.OPEN) {
                const audioData = event.data.data; // Float32Array
                
                // Calculate amplitude stats
                let min = Infinity;
                let max = -Infinity;
                
                for (let i = 0; i < audioData.length; i++) {
                    const value = audioData[i];
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                }
                
                // Update stats
                audioStats.minAmplitude = Math.min(audioStats.minAmplitude, min);
                audioStats.maxAmplitude = Math.max(audioStats.maxAmplitude, max);
                audioStats.lastChunkSize = audioData.length;
                audioStats.chunksSent++;
                
                // Store first chunk for debugging
                if (!audioStats.firstChunk) {
                    audioStats.firstChunk = Array.from(audioData.slice(0, 5));
                    console.log("First 5 samples:", audioStats.firstChunk.map(v => v.toFixed(6)));
                }
                
                updateDebugInfo();
                
                // Send the raw float16 data to the server
                websocket.send(audioData.buffer);
            }
            else if (event.data.type === 'volume') {
                // Update visualizer
                const volume = event.data.value;
                const height = Math.min(100, volume * 300);
                
                audioBars.forEach((bar, i) => {
                    const barHeight = Math.max(2, height * (Math.sin(i * 0.2) + 1));
                    bar.style.height = `${barHeight}px`;
                });
            }
        };
        
        // Connect to WebSocket server
        connectionEl.textContent = "Connection: Connecting...";
        websocket = new WebSocket(SERVER_URL);
        
        websocket.onopen = () => {
            connectionEl.textContent = "Connection: Connected";
            statusEl.textContent = "Status: Sending configuration...";
            startBtn.disabled = true;
            stopBtn.disabled = false;
            const languageSelect = document.getElementById('languageSelect');
            const translateEnabled = document.getElementById('translateEnabled');

            // Send configuration
            websocket.send(JSON.stringify({
                uid: `client-${Date.now()}`,
                model: MODEL,
                task: translateEnabled.checked ? 'translate' : 'transcribe',
                translate: translateEnabled.checked,
                language: languageSelect.value,
                use_vad: USE_VAD,
                audio_format: 'float16',
                enable_translation: translateEnabled.checked,
                target_language:"en"
            }));
        };
        
        websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Log all messages for debugging
                console.log("Server message:", data);
                
                // Handle server messages
                if (data.message) {
                    if (data.message === 'SERVER_READY') {
                        statusEl.textContent = "Status: Server ready - listening";
                    }
                    return;
                }
                
                // Handle transcript segments
                if (data.segments && data.segments.length > 0) {
                    let fullText = "";
                    
                    // Store segments for SRT file
                    for (const segment of data.segments) {
                        if (segment.text) {
                            // Calculate relative time from recording start
                            const elapsedSeconds = (Date.now() - recordingStartTime) / 1000;
                            segment.absoluteStart = elapsedSeconds - (segment.end - segment.start);
                            segment.absoluteEnd = elapsedSeconds;
                            
                            transcriptSegments.push({
                                start: segment.absoluteStart,
                                end: segment.absoluteEnd,
                                text: segment.text
                            });
                            
                            fullText += segment.text + " ";
                        }
                    }
                    
                    transcriptDiv.innerHTML = `<p>${fullText.trim()}</p>`;
                }

                // Handle translated segments
                if (data.translated_segments && data.translated_segments.length > 0) {
                    let fullText = "";
                    
                    // Store segments for SRT file
                    for (const segment of data.translated_segments) {
                        if (segment.text) {
                            // Calculate relative time from recording start
                            const elapsedSeconds = (Date.now() - recordingStartTime) / 1000;
                            segment.absoluteStart = elapsedSeconds - (segment.end - segment.start);
                            segment.absoluteEnd = elapsedSeconds;
                            
                            translatedSegments.push({
                                start: segment.absoluteStart,
                                end: segment.absoluteEnd,
                                text: segment.text
                            });
                            
                            fullText += segment.text + " ";
                        }
                    }
                    
                    translatedDiv.innerHTML = `<p>${fullText.trim()}</p>`;
                }

            } catch (e) {
                console.error("Error parsing message:", e);
            }
        };
        
        websocket.onerror = (error) => {
            connectionEl.textContent = "Connection: Error";
            statusEl.textContent = `Status: ${error.message || 'Unknown error'}`;
            console.error("WebSocket error:", error);
        };
        
        websocket.onclose = () => {
            connectionEl.textContent = "Connection: Closed";
            statusEl.textContent = "Status: Disconnected";
            downloadBtn.disabled = false;
            downloadTranslationBtn.disabled = false;
        };
        
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        console.error("Recording error:", error);
        
        // Clean up on error
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.close();
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            audioContext.close();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// Stop recording
function stopRecording() {
    try {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.close();
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            audioContext.close();
        }
        
        // Reset visualizer
        audioBars.forEach(bar => bar.style.height = '2px');
        
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusEl.textContent = "Status: Stopped";
        connectionEl.textContent = "Connection: Disconnected";
        
        // Enable download button
        downloadBtn.disabled = false;
        downloadTranslationBtn.disabled = false;
        
    } catch (error) {
        statusEl.textContent = `Error stopping: ${error.message}`;
        console.error("Error stopping recording:", error);
    }
}

// Event listeners
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
downloadBtn.addEventListener('click', downloadSRT);
downloadTranslationBtn.addEventListener('click', downloadTranslatedSRT);

// Display client version
const versionInfo = document.createElement('div');
versionInfo.textContent = `Client Version: ${new Date().toISOString().split('T')[0]}`;
versionInfo.style.position = 'fixed';
versionInfo.style.bottom = '10px';
versionInfo.style.right = '10px';
versionInfo.style.color = 'rgba(255,255,255,0.5)';
versionInfo.style.fontSize = '0.8rem';
document.body.appendChild(versionInfo);
