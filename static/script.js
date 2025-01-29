import { translations } from './translation.js';

document.addEventListener('DOMContentLoaded', function () {

    // Textos estáticos (no dependen de la api)
    const countdownDisplay = document.querySelector('#countdown');
    const trafficStatus = document.querySelector('#traffic-status');
    const dateDisplay = document.querySelector('#date');
    const flightsTable = document.querySelector('#flights-table');
    const languageSelector = document.getElementById('language-selector');

    // Datos de la API
    let currentApiData = {};

    // Obtener el idioma del almacenamiento local o usar 'en' como predeterminado
    let currentLang = localStorage.getItem('language');

    if (currentLang === null) {
        currentLang = 'en';
        localStorage.setItem('language', currentLang);
    }

    languageSelector.addEventListener('change', function () {
        const selectedLang = languageSelector.value;
        localStorage.setItem('language', selectedLang); // Guardar el idioma seleccionado
        applyTranslations(selectedLang); // Aplicar traducciones inmediatamente
    });

    // Función para actualizar los textos estáticos con la traducción correcta
    function updateTextContent(trans) {
        countdownDisplay.textContent = trans.countdown;
        document.querySelector('#flight-code-header').textContent = trans.flightCode;
        document.querySelector('#expected-time-header').textContent = trans.expectedTime;
        document.querySelector('#flight-status-header').textContent = trans.flightStatus;
        document.querySelector('#description').textContent = trans.description;
        document.querySelector('#current-date-label').textContent = trans.flightsFor;
        document.querySelector('#alert-me-when').textContent = trans.noticeMeWhen;
    }

    // Función para cambiar el idioma
    function applyTranslations(lang) {
        const trans = translations[lang] || translations.en;
        updateTextContent(trans);

        if (currentApiData.airport_status) {
            const statusIndex = trans.airportStatus.indexOf(currentApiData.airport_status);
            if (statusIndex !== -1) {
                trafficStatus.textContent = trans.airportStatus[statusIndex];
            }
        }
    }

    // Cambiar el idioma al seleccionar una opción en el selector
    languageSelector.addEventListener('change', function () {
        const selectedLang = languageSelector.value;
        localStorage.setItem('language', selectedLang);  // Guardar el idioma seleccionado
        location.reload();  // Recargar la página para aplicar la nueva configuración de idioma
    });

    // Script para alternar entre las campanas activas y desactivadas
    const bellOn = document.getElementById("bell-on");
    const bellOff = document.getElementById("bell-off");

    bellOn.addEventListener("click", () => {
        requestNotificationPermission();
    });

    bellOff.addEventListener("click", () => {
        requestNotificationPermission();
    });

    // Si el usuario ya tiene activadas las notificaciones, mostramos la campana activa
    // Esto es un ejemplo de cómo podrías manejar el estado de las notificaciones

    if (Notification.permission === "granted") {
        bellOn.classList.remove("text-gray-400");
        bellOn.classList.add("text-green-400");

        bellOff.classList.remove("text-red-400");
        bellOff.classList.add("text-gray-400");
    } else if (Notification.permission !== "denied") {
        bellOff.classList.remove("text-gray-400");
        bellOff.classList.add("text-red-400");

        bellOn.classList.remove("text-green-400");
        bellOn.classList.add("text-gray-400");
    }

    const notificationPreferences = document.getElementById('notification-preferences');

    // Guardar el tiempo seleccionado en el almacenamiento local al iniciar la página
    localStorage.setItem('notificationTime', notificationPreferences.value);

    notificationPreferences.addEventListener('change', function () {

        if (Notification.permission !== "denied") {
            requestNotificationPermission();
        }

        const selectedTime = notificationPreferences.value;  // Tiempo seleccionado en minutos
        console.log("Selected time:", selectedTime);

        // Guardar el tiempo seleccionado en el almacenamiento local
        localStorage.setItem('notificationTime', selectedTime);
    });

    // Al cargar la página, si hay un valor guardado en localStorage, establecerlo en el elemento
    window.addEventListener('load', function () {
        const savedTime = localStorage.getItem('notificationTime');
        if (savedTime) {
            notificationPreferences.value = savedTime;
            console.log("Loaded saved time:", savedTime);
        }
    });



    // Actualizar los datos
    async function updateData() {
        try {
            const response = await fetch('/api/next_flight');
            const data = await response.json();
            const { current_time, next_flight, time_remaining, airport_status } = data;

            currentApiData = data;

            updateCountdown(time_remaining);
            updateAirportStatus(airport_status);
            todaysSchedulePreviousMessageCurrentDay(next_flight.date);

            dateDisplay.textContent = current_time;

            // Mandar notificación si es necesario
            let savedTime = localStorage.getItem('notificationTime');

            // Convertir time_remaining a minutos totales
            let totalMinutes = 0;

            // Buscar horas y minutos en time_remaining
            const timeMatch = time_remaining.match(/(?:(\d+)h)?\s*(\d+)m/); // Opcionalmente horas, seguido de minutos
            if (timeMatch) {
                const hours = parseInt(timeMatch[1] || 0, 10); // Si no hay horas, usar 0
                const minutes = parseInt(timeMatch[2], 10);   // Los minutos siempre deben estar
                totalMinutes = (hours * 60) + minutes;       // Convertir horas a minutos y sumar
            }

            // Recuperar el tiempo de alerta guardado en minutos
            const savedAlertTime = parseInt(savedTime, 10);

            // Comparar el tiempo restante con el tiempo de alerta y enviar notificación si coincide
            if (totalMinutes === savedAlertTime) {
                sendNotification(
                    `${translations[currentLang]?.notificationMessage[0]} ${time_remaining}`,
                    translations[currentLang]?.notificationMessage[1]
                );
            }


            // Mostrar vuelos correspondientes a la fecha del próximo vuelo
            showTodaysFlights(data.next_flight.datetime.split(' ')[0]);

        } catch (error) {
            console.error("Error fetching remaining time:", error);
        }
    }

    function todaysSchedulePreviousMessageCurrentDay(next_flight_date) {
        const date = new Date(next_flight_date);

        // Asegurarse de que el idioma es correcto, y usar 'zh-CN' si es chino simplificado
        const lang = currentLang === 'cn' ? 'zh-CN' : currentLang;

        // Opciones para obtener el nombre del día de la semana, el día, el mes y el año
        const options = {
            weekday: 'long',  // Día de la semana completo (Monday, Lunes, Segunda-feira, etc.)
            day: 'numeric',   // Día numérico (27)
            month: 'long',    // Mes completo (January, Enero, Janeiro, etc.)
            year: 'numeric'   // Año completo (2025)
        };

        // Usamos Intl.DateTimeFormat para formatear la fecha según el idioma actual
        const formattedDate = new Intl.DateTimeFormat(lang, options).format(date);

        // Establecemos el texto traducido para la fecha
        document.getElementById('current-date').innerHTML = formattedDate;
    }

    function updateCountdown(remaining_time) {
        let remainingMinutes = parseInt(remaining_time.split(':')[0]);

        if (remainingMinutes < 0) {
            countdownDisplay.textContent = "Waiting for the airport to open again";
        } else {
            countdownDisplay.textContent = `${remaining_time} ${translations[currentLang]?.countdown || translations.en.countdown}`;
        }
    }

    function updateAirportStatus(airport_status) {
        const statusTranslations = translations[currentLang]?.airportStatus || translations.en.airportStatus;

        const statusMap = {
            "open": statusTranslations[0],
            "slosing_soon": statusTranslations[1],
            "closing": statusTranslations[2],
            "closed": statusTranslations[3]
        };

        trafficStatus.textContent = statusMap[airport_status] || statusTranslations[0];

        trafficStatus.classList.remove('text-red-500', 'text-yellow-200', 'text-green-300', 'text-red-400');

        if (airport_status === "closed") {
            trafficStatus.classList.add('text-red-400');
        } else if (airport_status === "closing") {
            trafficStatus.classList.add('text-red-500');
        } else if (airport_status === "closing_soon") {
            trafficStatus.classList.add('text-yellow-200');
        } else if (airport_status === "open") {
            trafficStatus.classList.add('text-green-300');
        }

        trafficStatus.classList.toggle('closed', airport_status !== 'Airport open');
    }

    async function showTodaysFlights(flightDate) {
        try {
            const response = await fetch(`/api/todays_flights?date=${flightDate}`);
            const flights = await response.json();

            flightsTable.innerHTML = '';

            const nextFlight = flights.find(flight => flight.status === 'Scheduled' || flight.status === 'Estimated');

            flights.forEach((flight) => {
                const flightRow = document.createElement('tr');
                flightRow.classList.add('text-center');

                let statusTextColorClass = '';
                let statusBackgroundClass = '';
                let flightTextStyleClass = 'text-white';

                if (flight.status === 'Arrived' || flight.status === 'Departed' || flight.status === 'Diverted' || flight.status === 'Delayed') {
                    statusTextColorClass = 'text-green-500';
                    flightTextStyleClass = 'line-through text-gray-200';
                }

                if (flight === nextFlight) {
                    statusTextColorClass = 'text-yellow-400';
                    statusBackgroundClass = 'bg-gray-600';
                }

                flightRow.innerHTML = `
                    <td class="px-4 py-2 ${statusBackgroundClass} ${flightTextStyleClass}">${flight.flight_code}</td>
                    <td class="px-4 py-2 ${statusBackgroundClass} ${flightTextStyleClass}">${flight.expected_time}</td>
                    <td class="px-4 py-2 ${statusBackgroundClass} ${statusTextColorClass}">${flight.status}</td>
                `;

                flightsTable.appendChild(flightRow);
            });

        } catch (error) {
            console.error("Error fetching today's flights:", error);
            flightsTable.innerHTML = `<tr><td colspan="3">Error retrieving today's flights: ${error.message}</td></tr>`;
        }
    }

    // Función para solicitar permisos de notificación
    function requestNotificationPermission() {
        if (Notification.permission === "granted") {
            console.log("Permiso ya concedido.");
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    console.log("Permiso concedido.");
                    location.reload();
                } else {
                    console.log("Permiso denegado.");
                }
            });
        }
    }

    // Función para enviar la notificación
    function sendNotification(title, body) {
        if (Notification.permission === "granted") {
            new Notification(title, {
                body: body,
                icon: "icono.png", // Ruta a un icono (opcional)
            });
        }
    }

    // Llamada inicial
    applyTranslations(currentLang);  // Aplicar traducción en base al idioma
    updateData();

    // Actualizar cada minuto
    setInterval(updateData, 60000); // Refresh remaining time
});
