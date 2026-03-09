/**
 * Parashakthi - Fake Call Escape Mode
 *
 * Simulates an incoming phone call so users can safely exit
 * uncomfortable situations. Fully client-side with optional ringtone.
 */

(function() {
    let scheduledTimeoutId = null;
    let callTimerIntervalId = null;
    let callSeconds = 0;

    function getSettings() {
        const nameInput = document.getElementById('fakeCallName');
        const delayRadio = document.querySelector('input[name="fakeCallDelay"]:checked');
        const callerName = (nameInput && nameInput.value.trim()) || 'Family Member';
        const delayMs = delayRadio ? parseInt(delayRadio.value, 10) || 10000 : 10000;
        return { callerName, delayMs };
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        const mm = m.toString().padStart(2, '0');
        const ss = s.toString().padStart(2, '0');
        return `${mm}:${ss}`;
    }

    function startCallTimer() {
        const timerEl = document.getElementById('fakeCallTimer');
        callSeconds = 0;
        if (timerEl) {
            timerEl.textContent = formatTime(callSeconds);
        }
        if (callTimerIntervalId) {
            clearInterval(callTimerIntervalId);
        }
        callTimerIntervalId = setInterval(() => {
            callSeconds += 1;
            if (timerEl) {
                timerEl.textContent = formatTime(callSeconds);
            }
        }, 1000);
    }

    function stopCallTimer() {
        if (callTimerIntervalId) {
            clearInterval(callTimerIntervalId);
            callTimerIntervalId = null;
        }
    }

    function playRingtone() {
        const audio = document.getElementById('fakeCallRingtone');
        if (!audio) return;
        try {
            audio.currentTime = 0;
            // play() may be blocked by autoplay policies; ignore errors.
            const p = audio.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {});
            }
        } catch {
            // ignore
        }
    }

    function stopRingtone() {
        const audio = document.getElementById('fakeCallRingtone');
        if (!audio) return;
        try {
            audio.pause();
        } catch {
            // ignore
        }
    }

    function showIncomingCall(callerName) {
        const modal = document.getElementById('fakeCallModal');
        const nameEl = document.getElementById('fakeCallCallerName');
        const incomingEl = document.getElementById('fakeCallIncomingView');
        const onCallEl = document.getElementById('fakeCallOnCallView');

        if (!modal) return;
        if (nameEl) nameEl.textContent = callerName || 'Family Member';
        if (incomingEl) incomingEl.classList.remove('hidden');
        if (onCallEl) onCallEl.classList.add('hidden');

        modal.classList.remove('hidden');
        playRingtone();
        stopCallTimer();
    }

    function acceptFakeCall() {
        const incomingEl = document.getElementById('fakeCallIncomingView');
        const onCallEl = document.getElementById('fakeCallOnCallView');
        if (incomingEl) incomingEl.classList.add('hidden');
        if (onCallEl) onCallEl.classList.remove('hidden');
        stopRingtone();
        startCallTimer();
    }

    function endFakeCall() {
        const modal = document.getElementById('fakeCallModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        stopRingtone();
        stopCallTimer();
        if (scheduledTimeoutId) {
            clearTimeout(scheduledTimeoutId);
            scheduledTimeoutId = null;
        }
    }

    /**
     * Public API: immediately trigger the fake incoming call.
     */
    function triggerFakeCall() {
        const { callerName } = getSettings();
        showIncomingCall(callerName);
    }

    function scheduleFakeCall() {
        const { callerName, delayMs } = getSettings();
        if (scheduledTimeoutId) {
            clearTimeout(scheduledTimeoutId);
        }
        scheduledTimeoutId = setTimeout(() => {
            showIncomingCall(callerName);
        }, delayMs);
        alert('Your fake call has been scheduled.');
    }

    function attachUi() {
        const triggerBtn = document.getElementById('fakeCallTriggerBtn');
        const acceptBtn = document.getElementById('fakeCallAccept');
        const declineBtn = document.getElementById('fakeCallDecline');
        const closeBtn = document.getElementById('fakeCallClose');

        if (triggerBtn) {
            triggerBtn.addEventListener('click', () => {
                try {
                    scheduleFakeCall();
                } catch (e) {
                    console.error('Failed to schedule fake call', e);
                }
            });
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                try {
                    acceptFakeCall();
                } catch (e) {
                    console.error('Failed to accept fake call', e);
                }
            });
        }

        if (declineBtn) {
            declineBtn.addEventListener('click', () => {
                try {
                    endFakeCall();
                } catch (e) {
                    console.error('Failed to decline fake call', e);
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                try {
                    endFakeCall();
                } catch (e) {
                    console.error('Failed to close fake call modal', e);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachUi);
    } else {
        attachUi();
    }

    // Expose trigger function globally
    window.triggerFakeCall = triggerFakeCall;
})();

