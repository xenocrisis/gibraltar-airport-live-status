document.addEventListener('DOMContentLoaded', function () {

    // Textos estáticos (no dependen de la api)
    const countdownDisplay = document.querySelector('#countdown');
    const trafficStatus = document.querySelector('#traffic-status');
    const dateDisplay = document.querySelector('#date');
    const flightsTable = document.querySelector('#flights-table');
    const alertMeWhen = document.querySelector('#alert-me-when');
    const languageSelector = document.getElementById('language-selector');

    // Traducciones por idioma
    const translations = {
        en: {
            countdown: "Left for closing",
            flightCode: "Flight Code",
            expectedTime: "Expected Time",
            flightStatus: "Status",
            loadingService: "Loading service",
            description: "The main purpose of this page is to allow you to quickly check if the border will be temporarily closed due to air traffic when you are heading to cross it. The system operates in real time and adapts the information provided by Gibraltar Airport. With this tool, you can avoid the inconvenient waiting time caused by airplane landings or take-offs by either anticipating your crossing or choosing a more convenient time.",
            airportStatus: ["Airport open", "Closing soon", "Closing", "Probably closed"],
            flightsFor: "Flights schedule for",
            noticeMeWhen: "Alert me when",
            notificationMessage: ["Gibraltar Airport 🇬🇮 closing in", "Hurry up crossing the border! The airport is closing soon."],
        },
        es: {
            countdown: "Para el cierre",
            flightCode: "Código de Vuelo",
            expectedTime: "Hora Estimada",
            flightStatus: "Estado",
            loadingService: "Cargando servicio",
            description: "El propósito principal de esta página es permitirte comprobar rápidamente si la frontera se cerrará temporalmente debido al tráfico aéreo cuando te diriges a cruzarla. El sistema opera en tiempo real y adapta la información proporcionada por el Aeropuerto de Gibraltar. Con esta herramienta, puedes evitar el inconveniente tiempo de espera causado por los aterrizajes o despegues de aviones anticipando tu cruce o eligiendo un momento más conveniente.",
            airportStatus: ["Aeropuerto abierto", "Cerrando pronto", "Cerrando", "Probablemente cerrado"],
            flightsFor: "Horario de vuelos para",
            noticeMeWhen: "Avísame cuando",
            notificationMessage: ["Aeropuerto de Gibraltar 🇬🇮 cerrando en", "¡Apúrate a cruzar la frontera! El aeropuerto está cerrando pronto."],
        },
        pt: {
            countdown: "Para o fechamento",
            flightCode: "Código do Voo",
            expectedTime: "Hora Esperada",
            flightStatus: "Status",
            loadingService: "Carregando serviço",
            description: "O principal objetivo desta página é permitir que você verifique rapidamente se a fronteira será temporariamente fechada devido ao tráfego aéreo quando você estiver indo cruzá-la. O sistema opera em tempo real e adapta as informações fornecidas pelo Aeroporto de Gibraltar. Com esta ferramenta, você pode evitar o inconveniente tempo de espera causado pelos pousos ou decolagens de aviões, antecipando sua travessia ou escolhendo um momento mais conveniente.",
            airportStatus: ["Aeroporto aberto", "Fechando em breve", "Fechando", "Provavelmente fechado"],
            flightsFor: "Horário de voos para",
            noticeMeWhen: "Avise-me quando",
            notificationMessage: ["Aeroporto de Gibraltar 🇬🇮 fechando em", "Apresse-se para cruzar a fronteira! O aeroporto está fechando em breve."],
        },
        cn: {
            countdown: "剩余时间关闭",
            flightCode: "航班代码",
            expectedTime: "预计时间",
            flightStatus: "状态",
            loadingService: "加载服务",
            description: "此页面的主要目的是允许您快速检查边境是否由于航空交通暂时关闭，当您准备过境时。系统实时运行，并根据直布罗陀机场提供的信息进行调整。通过这个工具，您可以避免因飞机着陆或起飞而导致的不便等待时间，您可以提前安排过境或选择更方便的时间。",
            airportStatus: ["机场开放", "即将关闭", "关闭", "可能关闭"],
            flightsFor: "航班时刻表",
            noticeMeWhen: "当...时提醒我",
            notificationMessage: ["直布罗陀机场 🇬🇮 剩余时间关闭", "快点过境！机场即将关闭。"],
        },
        ar: {
            countdown: "المتبقي لإغلاق",
            flightCode: "رمز الرحلة",
            expectedTime: "الوقت المتوقع",
            flightStatus: "الحالة",
            loadingService: "جارٍ تحميل الخدمة",
            description: "الهدف الرئيسي من هذه الصفحة هو السماح لك بالتحقق بسرعة مما إذا كانت الحدود ستغلق مؤقتًا بسبب حركة الطيران عندما تتجه لعبور الحدود. يعمل النظام في الوقت الفعلي ويكيف المعلومات المقدمة من مطار جبل طارق. مع هذه الأداة، يمكنك تجنب وقت الانتظار المزعج الذي تسببه هبوط الطائرات أو إقلاعها عن طريق التنبؤ بعبورك أو اختيار وقت أكثر ملاءمة.",
            airportStatus: ["المطار مفتوح", "يغلق قريبًا", "يغلق", "مغلق على الأرجح"],
            flightsFor: "جدول الرحلات لـ",
            noticeMeWhen: "أعلمني عندما",
            notificationMessage: ["مطار جبل طارق 🇬🇮 يغلق في", "أسرع في عبور الحدود! المطار يغلق قريبًا."],
        }
    };


    // Obtener el idioma del almacenamiento local o usar 'en' como predeterminado
    let currentLang = localStorage.getItem('language') || 'en';
    let currentApiData = {};

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
            let alertTrigger = 0;

            try {
                alertTrigger = time_remaining.split(' ')[1].replace('m', '');
            } catch (error) {
                alertTrigger = time_remaining.replace('m', '');
            }

            if (alertTrigger == savedTime) {
                sendNotification(`${translations[currentLang]?.notificationMessage[0]} ${time_remaining}`, translations[currentLang]?.notificationMessage[1]);
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
