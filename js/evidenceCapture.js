/**
 * Parashakthi - Automatic Evidence Capture
 *
 * Starts audio recording and attempts a one-time photo snapshot
 * when SOS is activated. Evidence is kept locally in memory and
 * offered as downloadable files only – nothing is uploaded.
 */

const EvidenceCaptureModule = (function() {
    let audioStream = null;
    let audioRecorder = null;
    let audioChunks = [];
    let audioBlob = null;
    let recording = false;

    let photoDataUrl = null;
    let photoCaptured = false;

    function updateUi() {
        const audioStatusEl = document.getElementById('evidenceAudioStatus');
        const photoStatusEl = document.getElementById('evidencePhotoStatus');

        if (audioStatusEl) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                audioStatusEl.textContent = 'Audio Recording: Not supported in this browser';
            } else if (recording) {
                audioStatusEl.textContent = 'Audio Recording: Active';
            } else if (audioBlob) {
                audioStatusEl.textContent = 'Audio Recording: Completed';
            } else {
                audioStatusEl.textContent = 'Audio Recording: Not started';
            }
        }

        if (photoStatusEl) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                photoStatusEl.textContent = 'Photo Captured: Not supported in this browser';
            } else if (photoCaptured && photoDataUrl) {
                photoStatusEl.textContent = 'Photo Captured: Yes';
            } else {
                photoStatusEl.textContent = 'Photo Captured: No';
            }
        }
    }

    async function startRecording() {
        if (recording) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Audio recording not supported');
            updateUi();
            return;
        }

        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioRecorder = new MediaRecorder(audioStream);
            audioChunks = [];

            audioRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            audioRecorder.onstop = () => {
                if (audioChunks.length) {
                    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                }
                if (audioStream) {
                    audioStream.getTracks().forEach(t => t.stop());
                    audioStream = null;
                }
                recording = false;
                updateUi();
            };

            audioRecorder.start();
            recording = true;
            updateUi();
        } catch (e) {
            console.warn('Microphone permission denied or unavailable', e);
            if (audioStream) {
                audioStream.getTracks().forEach(t => t.stop());
                audioStream = null;
            }
            recording = false;
            updateUi();
        }
    }

    async function capturePhoto() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            updateUi();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.playsInline = true;

            await new Promise(resolve => {
                video.onloadedmetadata = () => {
                    try {
                        video.play().then(resolve).catch(resolve);
                    } catch {
                        resolve();
                    }
                };
            });

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                photoDataUrl = canvas.toDataURL('image/png');
                photoCaptured = true;
            }

            stream.getTracks().forEach(t => t.stop());
            updateUi();
        } catch (e) {
            console.warn('Camera permission denied or unavailable', e);
            photoCaptured = false;
            photoDataUrl = null;
            updateUi();
        }
    }

    function startCapture() {
        // Fire both asynchronously; they should not block SOS alerts.
        startRecording();
        capturePhoto();
    }

    function stopRecording() {
        if (audioRecorder && recording) {
            try {
                audioRecorder.stop();
            } catch (e) {
                console.warn('Failed to stop audio recorder', e);
            }
        } else if (audioStream) {
            audioStream.getTracks().forEach(t => t.stop());
            audioStream = null;
            recording = false;
            updateUi();
        }
    }

    function downloadAudio() {
        if (!audioBlob) {
            alert('No audio evidence is available yet.');
            return;
        }
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `parashakthi_evidence_audio_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadPhoto() {
        if (!photoDataUrl) {
            alert('No photo evidence captured.');
            return;
        }
        const a = document.createElement('a');
        a.href = photoDataUrl;
        a.download = `parashakthi_evidence_photo_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function initUi() {
        const downloadAudioBtn = document.getElementById('downloadEvidenceAudio');
        const downloadPhotoBtn = document.getElementById('downloadEvidencePhoto');

        if (downloadAudioBtn) {
            downloadAudioBtn.addEventListener('click', () => {
                try {
                    downloadAudio();
                } catch (e) {
                    console.error('Failed to download audio evidence', e);
                }
            });
        }

        if (downloadPhotoBtn) {
            downloadPhotoBtn.addEventListener('click', () => {
                try {
                    downloadPhoto();
                } catch (e) {
                    console.error('Failed to download photo evidence', e);
                }
            });
        }

        updateUi();
    }

    return {
        startCapture,
        stopRecording,
        initUi
    };
})();

