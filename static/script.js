document.addEventListener('DOMContentLoaded', function () {
    const countdownDisplay = document.querySelector('#countdown');
    const trafficStatus = document.querySelector('#traffic-status');
    const dateDisplay = document.querySelector('#date');
    const flightsTable = document.querySelector('#flights-table');

    let probableClosedTimer = null;  // Timer for "Probably Closed"

    async function getRemainingTime() {
        try {
            const response = await fetch('/api/next_flight');
            const data = await response.json();
            console.log(data);

            const { current_time, next_flight, time_remaining, airport_status } = data;

            updateCountdown(time_remaining);
            updateAirportStatus(airport_status);  // Ahora pasamos `airport_status` directamente

            dateDisplay.textContent = current_time;

        } catch (error) {
            console.error("Error fetching remaining time:", error);
        }
    }

    function updateCountdown(remaining_time) {
        let remainingMinutes = parseInt(remaining_time.split(':')[0]);

        if (remainingMinutes < 0) {
            remainingMinutes = 0;
            countdownDisplay.textContent = "Waiting for the airport to open again";
        } else {
            countdownDisplay.textContent = `${remaining_time} Left for closing`;
        }
    }

    function updateAirportStatus(airport_status) {
        // Actualizar el texto del estado
        trafficStatus.textContent = airport_status;

        // Primero eliminamos todas las clases posibles
        trafficStatus.classList.remove('text-red-500', 'text-yellow-200', 'probable-closed', 'open', 'closed');

        // Ahora, agregamos la clase correspondiente según el estado
        if (airport_status === "Probably closed") {
            trafficStatus.classList.add('probable-closed');
        } else if (airport_status === "Closing") {
            trafficStatus.classList.add('text-red-500');
        } else if (airport_status === "Closing soon") {
            trafficStatus.classList.add('text-yellow-200');
        } else if (airport_status === "Airport open") {
            trafficStatus.classList.add('open');
        }

        // Aplicamos clases para "open" y "closed" según el estado
        trafficStatus.classList.toggle('closed', airport_status !== 'Airport open');
    }

    async function showTodaysFlights() {
        try {
            const response = await fetch('/api/todays_flights');
            const flights = await response.json();
            console.log(flights);

            if (flights.error) {
                flightsTable.innerHTML = '<p>Error retrieving today\'s flights.</p>';
                return;
            }

            flightsTable.innerHTML = '';

            const nextFlightIndex = flights.findIndex(flight => flight.status === 'Scheduled');
            const nextFlight = flights[nextFlightIndex];

            flights.forEach((flight, index) => {
                const row = document.createElement('tr');
                row.classList.add('text-center');

                let flightStatusClass = '';
                let flightTextColorClass = 'text-white';

                if (flight.status === 'Arrived' || flight.status === 'Departed') {
                    flightStatusClass = 'text-green-500';
                    flightTextColorClass = 'line-through text-gray-200';
                }

                if (flight === nextFlight) {
                    flightStatusClass = 'text-yellow-500';
                }

                row.innerHTML = `
                    <td class="px-4 py-2 ${flightTextColorClass}">${flight.flight_code}</td>
                    <td class="px-4 py-2 ${flightTextColorClass}">${flight.expected_time}</td>
                    <td class="px-4 py-2 ${flightStatusClass}">${flight.status}</td>
                `;
                flightsTable.appendChild(row);
            });
        } catch (error) {
            console.error("Error fetching today's flights:", error);
            flightsTable.innerHTML = '<tr><td colspan="3">Error retrieving today\'s flights.</td></tr>';
        }
    }

    getRemainingTime();
    showTodaysFlights();
    setInterval(getRemainingTime, 60000); // Refresh every minute
});
