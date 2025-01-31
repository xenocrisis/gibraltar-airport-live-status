document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        countdownDisplay: document.querySelector('#countdown'),
        trafficStatus: document.querySelector('#traffic-status'),
        dateDisplay: document.querySelector('#date'),
        currentDay: document.querySelector('#current-date'),
        flightsTable: document.querySelector('#flights-table'),
        languageSelector: document.getElementById('language-selector'),
        notificationPreferences: document.getElementById('notification-preferences'),
        bellOn: document.getElementById('bell-on'),
        bellOff: document.getElementById('bell-off')
    };

    let currentApiData;
    let currentLang = localStorage.getItem('language') || 'en';
    localStorage.setItem('language', currentLang);
    elements.languageSelector.value = currentLang;

    initializeEventListeners();
    updateData();
    applyTranslations(currentLang);
    updateBellState();
    setInterval(updateData, 58000);

    function initializeEventListeners() {
        elements.languageSelector.addEventListener('change', () => {
            const selectedLang = elements.languageSelector.value;
            localStorage.setItem('language', selectedLang);
            location.reload();
        });

        elements.notificationPreferences.addEventListener('change', () => {
            localStorage.setItem('notificationTime', elements.notificationPreferences.value);
            if (Notification.permission !== "denied") {
                requestNotificationPermission();
            }
        });

        // Alternar estado de las notificaciones al hacer clic en las campanas
        elements.bellOn.addEventListener('click', () => {
            requestNotificationPermission();
        });

        elements.bellOff.addEventListener('click', () => {
            requestNotificationPermission();
        });

        window.addEventListener('load', () => {
            const savedTime = localStorage.getItem('notificationTime');
            if (savedTime) elements.notificationPreferences.value = savedTime;
            updateBellState();
        });
    }

    // Cambiar el estado de las campanas según las notificaciones
    function setNotificationState(isActive) {
        if (isActive) {
            // Activar la campana
            elements.bellOn.classList.add('text-green-300');
            elements.bellOn.classList.remove('text-dark');
            elements.bellOff.classList.remove('text-highlight');
            elements.bellOff.classList.add('text-dark');
        } else {
            // Desactivar la campana
            elements.bellOff.classList.add('text-highlight');
            elements.bellOff.classList.remove('text-dark');
            elements.bellOn.classList.remove('text-highlight');
            elements.bellOn.classList.add('text-dark');
        }
    }

    // Verificar el estado de las notificaciones y actualizar las campanas
    function updateBellState() {
        if (Notification.permission === "granted") {
            setNotificationState(true);
        } else if (Notification.permission === "denied") {
            setNotificationState(false);
        } else {
            setNotificationState(false);
        }
    }

    function applyTranslations(lang) {
        const trans = translations[lang] || translations.en;
        updateTextContent(trans);
    }

    function updateTextContent(trans) {
        elements.countdownDisplay.textContent = trans.countdown;
        document.querySelector('#flight-code-header').textContent = trans.flightCode;
        document.querySelector('#expected-time-header').textContent = trans.expectedTime;
        document.querySelector('#flight-status-header').textContent = trans.flightStatus;
        document.querySelector('#description').textContent = trans.description;
        document.querySelector('#current-date-label').textContent = trans.flightsFor;
        document.querySelector('#alert-me-when').textContent = trans.noticeMeWhen;
    }

    async function updateData() {
        try {
            const response = await fetch('/api/flights');
            const data = await response.json();
            currentApiData = data;

            let nextFlight = currentApiData[data.length - 1].next_flight;

            updateCountdown(nextFlight.time_remaining);
            updateTrafficStatus(nextFlight.airport_status);
            showTodaysFlights(nextFlight.next_flight.datetime, nextFlight.next_flight.flight);
            checkNotificationTrigger(nextFlight.time_remaining);
        } catch (error) {
            console.error("Error fetching remaining time:", error);
        }
    }

    function updateCountdown(remainingTime) {
        let remainingMinutes = parseInt(remainingTime.split(':')[0]);
        elements.countdownDisplay.textContent = remainingMinutes < 0
            ? "Waiting for the airport to open again"
            : `${remainingTime} ${translations[currentLang]?.countdown || translations.en.countdown}`;
    }

    function updateTrafficStatus(status) {
        const trans = translations[currentLang]?.airportStatus || translations.en.airportStatus;
        const statusMap = { open: trans[0], closing_soon: trans[1], closing: trans[2], closed: trans[3] };
        elements.trafficStatus.textContent = statusMap[status] || trans[0];

        elements.trafficStatus.classList.remove('text-red-500', 'text-yellow-200', 'text-green-300', 'text-red-400');

        switch (status) {
            case "open":
                elements.trafficStatus.classList.add('text-green-300');
                break;
            case "closing_soon":
                elements.trafficStatus.classList.add('text-yellow-200');
                break;
            case "closing":
                elements.trafficStatus.classList.add('text-red-500');
                break;
            case "closed":
                elements.trafficStatus.classList.add('text-red-400');
                break;
            default:
                elements.trafficStatus.classList.add('text-gray-500');
        }
    }

    function checkNotificationTrigger(timeRemaining) {
        const savedTime = parseInt(localStorage.getItem('notificationTime'), 10);
        const totalMinutes = parseTimeToMinutes(timeRemaining);
        if (totalMinutes === savedTime) sendNotification("Flight Reminder", `Flight in ${timeRemaining}`);
    }

    function parseTimeToMinutes(timeStr) {
        const match = timeStr.match(/(?:(\d+)h)?\s*(\d+)m/);
        return match ? (parseInt(match[1] || 0, 10) * 60) + parseInt(match[2], 10) : 0;
    }

    function showTodaysFlights(date, nextFlightCode) {

        document.querySelector('#current-date-label').textContent += ' ' + date.split(' ')[0].replaceAll('-', ' '); // Mostrar la fecha actual

        elements.flightsTable.innerHTML = ''; // Limpiar la tabla antes de actualizar

        // Usamos la fecha proporcionada tal como está
        const formattedDate = date.split(' ')[0];; // date ya es una cadena en formato YYYY-MM-DD

        currentApiData.every(flight => {
            const flightDate = flight.datetime.split(' ')[0];

            if (flightDate === formattedDate) {
                const row = document.createElement('tr');
                row.classList.add('text-center');

                // Determinamos si este vuelo es el siguiente
                let nextFlightStyle = flight.flight === nextFlightCode ? 'text-highlight' : '';

                // Añadimos los datos a la tabla
                row.innerHTML = `
                    <td class="px-4 py-2 ${nextFlightStyle}">${flight.flight}</td>
                    <td class="px-4 py-2 ${nextFlightStyle}">${flight.sched}</td>
                    <td class="px-4 py-2 ${nextFlightStyle}">${flight.status}</td>
                `;
                elements.flightsTable.appendChild(row);
                return true;
            } else {
                return false;
            }
        });
    }

    function requestNotificationPermission() {
        if (Notification.permission === "granted") return;
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                updateBellState();
            }
        });
    }

    function sendNotification(title, body) {
        if (Notification.permission === "granted") {
            new Notification(title, { body, icon: "icono.png" });
        }
    }
});
