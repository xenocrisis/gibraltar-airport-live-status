from flask import Flask, jsonify, render_template, request
from datetime import datetime
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)
URL = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"

# Definir la variable `now` globalmente
# TESTING PURPOSE TIME EDITOR, REMEMBER THAT THE NEXT FLY ENDPOINT DETECTS IF THE PLANE HAS ARRIVED OR DEPORTED
# SO IF THE TIME HAS PASSED OUT ANYWAYS STILL GETTING THE NEXT ONE
# now = datetime(year=2025, month=1, day=25, hour=20, minute=40, second=0)
now = datetime.now()

# Common utilities
def fetch_data(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return None

def parse_flight_data(soup):
    flights = []
    for day in soup.find_all('div', class_='flight-day'):
        date = day.find('h6').text.strip()
        for row in day.find_all('tr')[1:]:
            cols = row.find_all('td')
            try:
                datetime_str = f"{date} {cols[2].text.strip()}"
                datetime_obj = datetime.strptime(datetime_str, '%A %d %B %Y %H:%M')
            except ValueError:
                datetime_obj = None

            flights.append({
                'date': date,
                'from': cols[0].text.strip(),
                'flight': cols[1].text.strip(),
                'sched': cols[2].text.strip(),
                'status': cols[3].text.strip(),
                'expected': cols[4].text.strip(),
                'datetime': datetime_obj
            })

    return sorted(flights, key=lambda f: f['datetime'] or datetime.max)

def get_next_flight(flights):
    global now  # Referenciar la variable global 'now'

    # Iterar sobre los vuelos y encontrar el siguiente vuelo
    for flight in flights:
        if flight['status'] == "Scheduled":
            return flight
        else:
            continue

    # Si no encontramos vuelos futuros, devolvemos un mensaje de error
    return {"message": "No upcoming flights available."}

def calculate_time_remaining(next_flight):
    global now  # Referenciar la variable global 'now'

    # Comprobar si hay un tiempo "expected" (más preciso que el tiempo programado)
    if not next_flight.get('datetime'):
        return next_flight

    # Tiempo programado del vuelo
    programmed_time = next_flight['datetime']

    # Intentar obtener el "expected" time, que puede ser más preciso
    expected_time_str = next_flight.get('expected')

    # Inicializar next_flight_time con el tiempo programado por defecto
    next_flight_time = programmed_time

    if expected_time_str:
        try:
            # Si el tiempo esperado está presente, parsearlo y convertirlo en un objeto datetime
            expected_time = expected_time_str.split(':', 2)
            expected_time = datetime(year=now.year, month=now.month, day=now.day, 
                                      hour=int(expected_time[0]), minute=int(expected_time[1]))
            next_flight_time = expected_time  # Usar el tiempo esperado si está disponible
        except (ValueError, IndexError):
            # Si el formato del tiempo esperado es incorrecto, mantener el tiempo programado
            next_flight_time = programmed_time

    # Calcular la diferencia de tiempo entre ahora y el siguiente vuelo
    time_diff = next_flight_time - now

    # Descomponer la diferencia en horas y minutos
    total_minutes = time_diff.total_seconds() // 60  # Tiempo total en minutos
    hours = total_minutes // 60  # Horas
    minutes = total_minutes % 60  # Minutos restantes

    # Determinar cómo formatear la diferencia de tiempo
    if hours == 0:
        time_remaining = f"{int(minutes)}m"
    else:
        time_remaining = f"{int(hours)}h {int(minutes)}m"

    # Calcular el estado del aeropuerto
    if total_minutes < 0:
        airport_status = "Probably closed"
    elif total_minutes <= 3:
        airport_status = "Closing"
    elif total_minutes <= 20:
        airport_status = "Closing soon"
    else:
        airport_status = "Airport open"

    # Formatear la fecha y hora del vuelo en un formato más legible
    next_flight['datetime'] = next_flight['datetime'].strftime('%Y-%m-%d %H:%M:%S')

    return {
        "current_time": now.strftime('%Y-%m-%d %H:%M:%S'),
        "time_remaining": time_remaining,
        "airport_status": airport_status,
        "next_flight": next_flight
    }


# Common route handler
def handle_flight_request(processor, day_filter=None):
    soup = fetch_data(URL)
    if not soup:
        return jsonify({"error": "Could not fetch flight information."}), 500

    flights = parse_flight_data(soup)

    if day_filter:
        # Filtrar vuelos por la fecha proporcionada
        flights = [flight for flight in flights if flight['date'] == day_filter]

    return jsonify(processor(flights))

# Endpoints
@app.route('/api/flights', methods=['GET'])
def get_flights_api():
    # Obtener el parámetro 'day' de la consulta
    day = request.args.get('day', None)
    return handle_flight_request(lambda flights: flights, day_filter=day)

@app.route('/api/next_flight', methods=['GET'])
def get_next_flight_with_time_api():
    return handle_flight_request(lambda flights: calculate_time_remaining(
        get_next_flight(flights)
    ))

@app.route('/api/todays_flights', methods=['GET'])
def get_todays_flights():
    soup = fetch_data(URL)
    if not soup:
        return jsonify({"error": "Could not fetch flight information."}), 500

    flights = parse_flight_data(soup)

    # Obtener la fecha de hoy dinámicamente
    today = datetime.now().strftime('%A %d %B %Y')  # Fecha como "Viernes 25 Enero 2025"

    # Filtrar los vuelos solo para el día de hoy
    todays_flights = [flight for flight in flights if flight['date'] == today]

    # Solo devolver la información necesaria (código de vuelo, expected o sched, y estado)
    result = []
    for flight in todays_flights:
        flight_info = {
            'flight_code': flight['flight'],
            'expected_time': flight['expected'] if flight['expected'] else flight['sched'],
            'status': flight['status']
        }
        result.append(flight_info)

    return jsonify(result)

@app.route('/')
def index():
    return render_template('index.html')
