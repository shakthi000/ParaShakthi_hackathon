/**
 * Parashakthi - SOS via SMS
 *
 * Adds the ability to open the device SMS composer with a prefilled
 * emergency message to the selected emergency contacts.
 *
 * This module is additive and does not modify existing SOS / WhatsApp logic.
 */

(function() {
    function buildSmsMessage(latitude, longitude) {
        const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
        const lines = [
            '🚨 EMERGENCY ALERT',
            '',
            'I need help immediately.',
            ''
        ];

        if (hasCoords) {
            const lat = latitude;
            const lng = longitude;
            lines.push(
                'My current location:',
                `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
                '',
                'Please respond urgently.'
            );
        } else {
            lines.push(
                'My location could not be determined.',
                '',
                'Please respond urgently.'
            );
        }

        return lines.join('\n');
    }

    /**
     * Send SOS via SMS to the given contacts.
     * @param {Array<{phone: string}>} contacts
     * @param {number} latitude
     * @param {number} longitude
     */
    function sendSOSviaSMS(contacts, latitude, longitude) {
        if (!contacts || !contacts.length) {
            alert('No emergency contacts selected for SMS.');
            return;
        }

        const message = buildSmsMessage(latitude, longitude);
        const encoded = encodeURIComponent(message);

        let smsSupported = true;
        let attempted = false;

        contacts.forEach(contact => {
            const rawPhone = (contact && contact.phone != null) ? String(contact.phone) : '';
            const phone = rawPhone.replace(/[^\d+]/g, '');
            if (!phone) return;

            const url = `sms:${phone}?body=${encoded}`;
            try {
                const win = window.open(url, '_blank');
                attempted = true;
                // Some browsers return null when blocked / unsupported.
                if (win == null) {
                    smsSupported = false;
                }
            } catch (e) {
                console.warn('Failed to open SMS composer', e);
                smsSupported = false;
            }
        });

        if (attempted && !smsSupported) {
            alert('SMS sending is not supported on this device or browser.');
        }
    }

    function getSelectedContactsForAll() {
        if (typeof window.getEmergencyContacts !== 'function') return [];
        try {
            return window.getEmergencyContacts() || [];
        } catch (e) {
            console.error('Failed to read emergency contacts for SMS', e);
            return [];
        }
    }

    function getSelectedContactsFromCheckboxes() {
        if (typeof window.getEmergencyContacts !== 'function') return [];
        const all = window.getEmergencyContacts() || [];
        const selected = [];
        document.querySelectorAll('.sos-contact-checkbox:checked').forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-index') || '-1', 10);
            if (!isNaN(idx) && all[idx]) {
                selected.push(all[idx]);
            }
        });
        return selected;
    }

    function getSelectedChannel() {
        const checked = document.querySelector('input[name="sosChannel"]:checked');
        const value = checked && checked.value ? checked.value : 'whatsapp';
        return value;
    }

    function withBrowserLocation(callback) {
        if (!navigator.geolocation) {
            callback(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => callback([pos.coords.latitude, pos.coords.longitude]),
            () => callback(null)
        );
    }

    function handleAllContactsSms() {
        const channel = getSelectedChannel();
        if (channel !== 'sms' && channel !== 'both') return;

        const contacts = getSelectedContactsForAll();
        if (!contacts.length) return;

        withBrowserLocation(pos => {
            const lat = pos ? pos[0] : undefined;
            const lng = pos ? pos[1] : undefined;
            sendSOSviaSMS(contacts, lat, lng);
        });
    }

    function handleSelectedContactsSms() {
        const channel = getSelectedChannel();
        if (channel !== 'sms' && channel !== 'both') return;

        const contacts = getSelectedContactsFromCheckboxes();
        if (!contacts.length) return;

        withBrowserLocation(pos => {
            const lat = pos ? pos[0] : undefined;
            const lng = pos ? pos[1] : undefined;
            sendSOSviaSMS(contacts, lat, lng);
        });
    }

    function attachUiListeners() {
        const sendAllBtn = document.getElementById('sosSendAllBtn');
        const sendSelectedConfirmBtn = document.getElementById('sosSendSelectedConfirmBtn');

        if (sendAllBtn) {
            sendAllBtn.addEventListener('click', () => {
                try {
                    handleAllContactsSms();
                } catch (e) {
                    console.error('SMS SOS (all contacts) failed', e);
                }
            });
        }

        if (sendSelectedConfirmBtn) {
            sendSelectedConfirmBtn.addEventListener('click', () => {
                try {
                    handleSelectedContactsSms();
                } catch (e) {
                    console.error('SMS SOS (selected contacts) failed', e);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachUiListeners);
    } else {
        attachUiListeners();
    }

    // Expose core function globally as requested
    window.sendSOSviaSMS = sendSOSviaSMS;
})();

