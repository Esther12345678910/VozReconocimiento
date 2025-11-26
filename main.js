// variables principales para audio y análisis
let audioContext = null;
let analyser = null;
let microphone = null;
let animationFrame = null;
let isRecording = false;
let timeDomainBuffer = null;

// variables para grabación y transcripción
let mediaRecorder = null;
let audioChunks = [];
let recognition = null;
let finalTranscriptAccumulated = '';
let recordingTimeout = null;
let timerInterval = null;
let secondsCount = 0;

// variables para análisis de género
let genderSamples = [];
let detectedGender = '';
let certaintyPercentage = 0;

// elementos del dom
const micButton = document.getElementById('micButton');
const micIcon = document.getElementById('micIcon');
const errorDiv = document.getElementById('error');
const frequencyValue = document.getElementById('frequencyValue');
const genderBadge = document.getElementById('genderBadge');
const transcriptionText = document.getElementById('transcriptionText');
const audioWrapper = document.getElementById('audioWrapper');
const audioPlayback = document.getElementById('audioPlayback');
const timerDisplay = document.getElementById('timer');
const confirmationModal = document.getElementById('confirmationModal');
const confirmationIcon = document.getElementById('confirmationIcon');
const iconEmoji = document.getElementById('iconEmoji');
const confirmationGender = document.getElementById('confirmationGender');
const retryButton = document.getElementById('retryButton');

// elementos para fondo y video
const maleImage = document.getElementById('maleImage');
const maleVideo = document.getElementById('maleVideo');
const femaleImage = document.getElementById('femaleImage');
const femaleVideo = document.getElementById('femaleVideo');

// reproductor de audio en el modal
const audioWrapperModal = document.getElementById('audioWrapperModal');
const audioPlaybackModal = document.getElementById('audioPlaybackModal');
const modalTranscriptionText = document.getElementById('modalTranscriptionText');

let currentGenderShowing = null;

// configuración de reconocimiento de voz
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscript) {
            finalTranscriptAccumulated += (finalTranscriptAccumulated ? ' ' : '') + finalTranscript.trim();
        }

        const display = (finalTranscriptAccumulated ? finalTranscriptAccumulated + (interimTranscript ? ' ' + interimTranscript : '') : interimTranscript);
        transcriptionText.value = display;

        // log para depuración
        console.log('Transcripción:', display);
    };

    recognition.onerror = (event) => {
        console.error("Error en reconocimiento de voz:", event.error);
    };

    // reiniciar reconocimiento si se detiene inesperadamente
    recognition.onend = () => {
        if (isRecording) {
            recognition.start();
        }
    };
} else {
    transcriptionText.placeholder = "Tu navegador no soporta transcripción de voz a texto.";
}

// evento para iniciar o detener grabación
micButton.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// evento para volver a grabar desde el modal
retryButton.addEventListener('click', () => {
    confirmationModal.classList.remove('show');
    resetRecording();
});

// función principal para iniciar grabación y análisis
async function startRecording() {
    try {
        errorDiv.style.display = 'none';
        audioWrapper.style.display = 'none';
        transcriptionText.value = '';
        audioChunks = [];
        genderSamples = [];
        finalTranscriptAccumulated = '';

        // pedir acceso al micrófono
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // configurar análisis de frecuencia
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 2048;
        timeDomainBuffer = new Float32Array(analyser.fftSize);
        microphone.connect(analyser);

        // configurar grabadora
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        // cuando termina la grabación, mostrar el modal de confirmación
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);

            audioPlaybackModal.src = audioUrl;

            showConfirmation();
        };

        mediaRecorder.start();

        // iniciar reconocimiento de voz
        if (recognition) recognition.start();

        // actualizar interfaz
        isRecording = true;
        micButton.classList.add('recording');
        timerDisplay.classList.add('visible');

        micIcon.innerHTML = `<rect x="6" y="6" width="12" height="12"></rect>`;

        analyzeVoice();
        startTimer();

    } catch (err) {
        errorDiv.textContent = 'Error: No se pudo acceder al micrófono.';
        errorDiv.style.display = 'block';
        console.error(err);
    }
}

// función para mostrar el temporizador de grabación
function startTimer() {
    secondsCount = 0;
    timerDisplay.textContent = `Grabando: 0s / 30s`;

    timerInterval = setInterval(() => {
        secondsCount++;
        timerDisplay.textContent = `Grabando: ${secondsCount}s / 30s`;
    }, 1000);

    recordingTimeout = setTimeout(() => {
        if (isRecording) stopRecording();
    }, 30000);
}

// función para detener grabación y análisis
function stopRecording() {
    clearTimeout(recordingTimeout);
    clearInterval(timerInterval);
    timerDisplay.classList.remove('visible');

    if (animationFrame) cancelAnimationFrame(animationFrame);

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (recognition) recognition.stop();

    if (microphone && microphone.mediaStream) {
        microphone.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }

    isRecording = false;
    micButton.classList.remove('recording');

    micIcon.innerHTML = `
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            `;
}

// función de autocorrelación para detectar la frecuencia fundamental
function autoCorrelate(buffer, sampleRate) {
    let SIZE = buffer.length;
    let rms = 0;

    // calcular volumen para ignorar silencio
    for (let i = 0; i < SIZE; i++) {
        const val = buffer[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    // recortar el buffer a índices útiles
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    buffer = buffer.slice(r1, r2);
    SIZE = buffer.length;

    // autocorrelación
    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buffer[j] * buffer[j + i];
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;

    // interpolación parabólica para mayor precisión
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

// función para analizar la voz y detectar género en tiempo real
function analyzeVoice() {
    const samples = [];
    const maxSamples = 30;
    let lastValidFreq = 0;
    let stableFreqBuffer = [];
    let consecutiveGenderCount = { male: 0, female: 0 };
    const genderChangeThreshold = 15;

    function detect() {
        if (!isRecording) return;

        analyser.getFloatTimeDomainData(timeDomainBuffer);
        const freq = autoCorrelate(timeDomainBuffer, audioContext.sampleRate);

        if (freq !== -1) {
            // limitar al rango vocal válido
            let rawFreq = Math.max(70, Math.min(freq, 250));

            // filtro para rechazar cambios bruscos
            if (lastValidFreq > 0) {
                const freqDiff = Math.abs(rawFreq - lastValidFreq);

                if (freqDiff > 25) {
                    rawFreq = lastValidFreq * 0.9 + rawFreq * 0.1;
                } else if (freqDiff > 15) {
                    rawFreq = lastValidFreq * 0.7 + rawFreq * 0.3;
                } else {
                    rawFreq = lastValidFreq * 0.5 + rawFreq * 0.5;
                }
            }

            // usar mediana para mayor robustez
            samples.push(rawFreq);
            if (samples.length > maxSamples) samples.shift();

            const sortedSamples = [...samples].sort((a, b) => a - b);
            const medianFreq = sortedSamples[Math.floor(sortedSamples.length / 2)];

            // filtro de estabilidad
            let validFreq;
            if (Math.abs(rawFreq - medianFreq) < 20) {
                validFreq = rawFreq;
                stableFreqBuffer.push(rawFreq);
                if (stableFreqBuffer.length > 15) stableFreqBuffer.shift();
            } else {
                validFreq = medianFreq;
            }

            lastValidFreq = validFreq;

            // calcular frecuencia final usando muestras estables
            const finalFreq = stableFreqBuffer.length > 0
                ? stableFreqBuffer.reduce((a, b) => a + b, 0) / stableFreqBuffer.length
                : validFreq;

            // mostrar frecuencia estabilizada
            frequencyValue.textContent = Math.round(finalFreq);

            // guardar para análisis de género
            genderSamples.push(finalFreq);

            // detección de género
            let detectedGenderNow = finalFreq < 155 ? 'male' : 'female';

            // contar muestras consecutivas
            if (detectedGenderNow === 'male') {
                consecutiveGenderCount.male++;
                consecutiveGenderCount.female = 0;
            } else {
                consecutiveGenderCount.female++;
                consecutiveGenderCount.male = 0;
            }

            // cambiar género solo con evidencia fuerte
            let currentGender = detectedGender || detectedGenderNow;

            if (consecutiveGenderCount.male >= genderChangeThreshold && detectedGender !== 'male') {
                if (medianFreq < 155) {
                    genderBadge.textContent = "Hombre";
                    genderBadge.className = "gender-badge male";
                    detectedGender = "male";
                    currentGender = "male";
                }
            } else if (consecutiveGenderCount.female >= genderChangeThreshold && detectedGender !== 'female') {
                if (medianFreq >= 155) {
                    genderBadge.textContent = "Mujer";
                    genderBadge.className = "gender-badge female";
                    detectedGender = "female";
                    currentGender = "female";
                }
            } else if (!detectedGender && stableFreqBuffer.length >= 10) {
                // detección inicial
                const initialAvg = stableFreqBuffer.reduce((a, b) => a + b, 0) / stableFreqBuffer.length;
                if (initialAvg < 155) {
                    genderBadge.textContent = "Hombre";
                    genderBadge.className = "gender-badge male";
                    detectedGender = "male";
                    currentGender = "male";
                } else {
                    genderBadge.textContent = "Mujer";
                    genderBadge.className = "gender-badge female";
                    detectedGender = "female";
                    currentGender = "female";
                }
            }

            // cambiar fondo solo si hay detección confirmada
            if (detectedGender) {
                updateBackgroundMedia(currentGender);
            }
        }

        animationFrame = requestAnimationFrame(detect);
    }
    detect();
}

// calcula el porcentaje de certeza del género detectado
function calculateCertainty() {
    if (genderSamples.length === 0) return 50;

    const threshold = 155;
    let maleCount = 0;
    let femaleCount = 0;

    genderSamples.forEach(freq => {
        if (freq < threshold) {
            maleCount++;
        } else {
            femaleCount++;
        }
    });

    const total = genderSamples.length;
    const maxCount = Math.max(maleCount, femaleCount);

    // calcular porcentaje base
    const baseCertainty = (maxCount / total) * 100;

    // ajustar certeza según consistencia
    const mean = genderSamples.reduce((a, b) => a + b, 0) / total;
    const variance = genderSamples.reduce((sum, freq) => sum + Math.pow(freq - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);

    const consistencyFactor = Math.max(0, 1 - (stdDev / 50));
    const finalCertainty = baseCertainty * (0.7 + 0.3 * consistencyFactor);

    return Math.min(99, Math.max(60, Math.round(finalCertainty)));
}

// muestra el modal de confirmación con los resultados
function showConfirmation() {
    if (detectedGender === 'male') {
        confirmationIcon.className = 'confirmation-icon male';
        iconEmoji.textContent = '👨';
        confirmationGender.className = 'confirmation-gender male';
        confirmationGender.textContent = 'HOMBRE';
    } else {
        confirmationIcon.className = 'confirmation-icon female';
        iconEmoji.textContent = '👩';
        confirmationGender.className = 'confirmation-gender female';
        confirmationGender.textContent = 'MUJER';
    }

    // mostrar transcripción en el modal
    const transcriptionContent = finalTranscriptAccumulated || transcriptionText.value || 'No se detectó texto';
    modalTranscriptionText.textContent = transcriptionContent;

    confirmationModal.classList.add('show');
}

// reinicia la interfaz y variables para volver a grabar
function resetRecording() {
    transcriptionText.value = '';
    audioWrapper.style.display = 'none';
    frequencyValue.textContent = '0';
    genderBadge.textContent = '-';
    genderBadge.className = 'gender-badge';
    genderSamples = [];
    finalTranscriptAccumulated = '';
    detectedGender = '';

    audioPlaybackModal.src = '';
    modalTranscriptionText.textContent = '...';

    resetBackgroundMedia();
}

// cambia el fondo según el género detectado
function updateBackgroundMedia(gender) {
    if (gender === currentGenderShowing) return;

    currentGenderShowing = gender;

    if (gender === 'male') {
        maleImage.classList.add('hidden');
        maleVideo.classList.add('active');
        maleVideo.play().catch(e => console.log('Error playing male video:', e));

        femaleVideo.classList.remove('active');
        femaleVideo.pause();
        femaleImage.classList.remove('hidden');
    } else if (gender === 'female') {
        femaleImage.classList.add('hidden');
        femaleVideo.classList.add('active');
        femaleVideo.play().catch(e => console.log('Error playing female video:', e));

        maleVideo.classList.remove('active');
        maleVideo.pause();
        maleImage.classList.remove('hidden');
    }
}

// reinicia los fondos a imágenes estáticas
function resetBackgroundMedia() {
    maleVideo.classList.remove('active');
    maleVideo.pause();
    maleVideo.currentTime = 0;
    maleImage.classList.remove('hidden');

    femaleVideo.classList.remove('active');
    femaleVideo.pause();
    femaleVideo.currentTime = 0;
    femaleImage.classList.remove('hidden');

    currentGenderShowing = null;
}
