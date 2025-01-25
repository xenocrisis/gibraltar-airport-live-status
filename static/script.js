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
            const { current_time, next_flight, time_remaining, airport_status } = data;

            updateCountdown(time_remaining);
            updateAirportStatus(airport_status);

            dateDisplay.textContent = current_time;

        } catch (error) {
            // console.error("Error fetching remaining time:", error);
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
        trafficStatus.textContent = airport_status;

        trafficStatus.classList.remove('text-red-500', 'text-yellow-200', 'text-green-300', 'text-red-400');

        if (airport_status === "Probably closed") {
            trafficStatus.classList.add('text-red-400');
        } else if (airport_status === "Closing") {
            trafficStatus.classList.add('text-red-500');
        } else if (airport_status === "Closing soon") {
            trafficStatus.classList.add('text-yellow-200');
        } else if (airport_status === "Airport open") {
            trafficStatus.classList.add('text-green-300');
        }

        trafficStatus.classList.toggle('closed', airport_status !== 'Airport open');
    }

    async function showTodaysFlights() {
        try {
            const response = await fetch('/api/todays_flights');
            const flights = await response.json();

            if (flights.error) {
                flightsTable.innerHTML = '<p>Error retrieving today\'s flights.</p>';
                return;
            }

            flightsTable.innerHTML = '';

            const nextFlight = flights.find(flight => flight.status === 'Scheduled' || flight.status === 'Estimated');

            flights.forEach((flight) => {
                const flightRow = document.createElement('tr');
                flightRow.classList.add('text-center');

                let statusTextColorClass = '';
                let statusBackgroundClass = '';
                let flightTextStyleClass = 'text-white';

                if (flight.status === 'Arrived' || flight.status === 'Departed') {
                    statusTextColorClass = 'text-green-500';
                    flightTextStyleClass = 'line-through text-gray-200';
                }
                
                console.log(flight, nextFlight);
                if (flight === nextFlight) {
                    statusTextColorClass = 'text-yellow-500';
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
            // console.error("Error fetching today's flights:", error);
            flightsTable.innerHTML = '<tr><td colspan="3">Error retrieving today\'s flights.</td></tr>';
        }
    }

    // Initial calls
    getRemainingTime();
    showTodaysFlights();

    // Set intervals to refresh APIs every minute
    setInterval(getRemainingTime, 60000); // Refresh remaining time
    setInterval(showTodaysFlights, 60000); // Refresh today's flights
});
