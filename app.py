import os
from flask import Flask, jsonify, render_template, request
from datetime import datetime
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)
URL = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"

# Función para escribir en el archivo de logs
def log_message(message):
    # Obtener la dirección IP y el User-Agent
    ip_address = request.remote_addr
    user_agent = request.headers.get('User-Agent')

    # Crear la carpeta LOGS si no existe
    if not os.path.exists('LOGS'):
        os.makedirs('LOGS')

    # Obtener la fecha actual
    today_date = datetime.now().strftime('%Y-%m-%d')
    log_filename = f"LOGS/{today_date}.txt"

    # Escribir el mensaje en el archivo de logs con IP y User-Agent
    with open(log_filename, 'a') as log_file:
        log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - IP: {ip_address} - User-Agent: {user_agent} - {message}\n")

# Common utilities
def fetch_data(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        log_message(f"Successfully fetched data from {url}")
        return BeautifulSoup(response.text, 'html.parser')
    except requests.RequestException as e:
        log_message(f"Error fetching data from {url}: {e}")
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

def get_next_flight(flights, current_time):
    for flight in flights:
        if flight['status'] not in ["Arrived", "Departed"] and flight['datetime'] and flight['datetime'] > current_time:
            return flight
    return {"message": "No upcoming flights available."}

def calculate_time_remaining(next_flight, current_time):
    if not next_flight.get('datetime'):
        return next_flight

    programmed_time = next_flight['datetime']
    expected_time_str = next_flight.get('expected')
    next_flight_time = programmed_time

    if expected_time_str:
        try:
            expected_time = expected_time_str.split(':', 2)
            expected_time = datetime(
                year=current_time.year, month=current_time.month, day=current_time.day,
                hour=int(expected_time[0]), minute=int(expected_time[1])
            )
            next_flight_time = expected_time
        except (ValueError, IndexError):
            pass

    time_diff = next_flight_time - current_time
    total_minutes = time_diff.total_seconds() // 60
    hours = total_minutes // 60
    minutes = total_minutes % 60

    if hours == 0:
        time_remaining = f"{int(minutes)}m"
    else:
        time_remaining = f"{int(hours)}h {int(minutes)}m"

    if total_minutes < 0:
        airport_status = "closed"  # "Probably closed"
    elif total_minutes <= 3:
        airport_status = "closing"  # "Closing"
    elif total_minutes <= 20:
        airport_status = "closing_soon"  # "Closing soon"
    else:
        airport_status = "open"  # "Airport open"

    next_flight['datetime'] = next_flight['datetime'].strftime('%Y-%m-%d %H:%M:%S')

    return {
        "current_time": current_time.strftime('%Y-%m-%d %H:%M:%S'),
        "time_remaining": time_remaining,
        "airport_status": airport_status,
        "next_flight": next_flight
    }

# Update handle_flight_request to accept specified date and time
def handle_flight_request(processor, day_filter=None):
    soup = fetch_data(URL)
    if not soup:
        log_message("Failed to fetch flight information.")
        return jsonify({"error": "Could not fetch flight information."}), 500

    flights = parse_flight_data(soup)
    if day_filter:
        flights = [flight for flight in flights if flight['date'] == day_filter]

    # Get current time from request parameter, if provided
    current_date_str = request.args.get('date', None)  # Allow the user to specify date
    current_time_str = request.args.get('time', None)  # Allow the user to specify time
    
    if current_date_str and current_time_str:
        try:
            current_datetime_str = f"{current_date_str} {current_time_str}"
            current_time = datetime.strptime(current_datetime_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            log_message(f"Invalid date or time format: {current_date_str} {current_time_str}")
            return jsonify({"error": "Invalid date or time format. Use YYYY-MM-DD for date and HH:MM:SS for time."}), 400
    else:
        current_time = datetime.now()

    log_message(f"Flight data processed for {day_filter if day_filter else 'current day'} with current time {current_time}")
    return jsonify(processor(flights, current_time))

# Update the /api/flights endpoint to handle the day query parameter
@app.route('/api/flights', methods=['GET'])
def get_flights_api():
    day = request.args.get('day', None)  # Day filter for fetching flights
    log_message(f"Fetching flights for day: {day}")
    return handle_flight_request(lambda flights, _: flights, day_filter=day)

# Update /api/next_flight to accept and handle custom day and time
@app.route('/api/next_flight', methods=['GET'])
def get_next_flight_with_time_api():
    log_message("Fetching next flight with time remaining.")
    return handle_flight_request(
        lambda flights, current_time: calculate_time_remaining(
            get_next_flight(flights, current_time), current_time
        )
    )

# Update /api/todays_flights to accept and handle custom date
@app.route('/api/todays_flights', methods=['GET'])
def get_todays_flights():
    date_param = request.args.get('date', default=datetime.now().strftime('%Y-%m-%d'))
    try:
        requested_date = datetime.strptime(date_param, '%Y-%m-%d').strftime('%A %d %B %Y')
    except ValueError:
        log_message(f"Invalid date format requested: {date_param}")
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    log_message(f"Fetching today's flights for date {requested_date}")
    soup = fetch_data(URL)
    if not soup:
        log_message("Failed to fetch flight information.")
        return jsonify({"error": "Could not fetch flight information."}), 500

    flights = parse_flight_data(soup)
    requested_flights = [flight for flight in flights if flight['date'] == requested_date]

    result = [
        {
            'flight_code': flight['flight'],
            'expected_time': flight['expected'] if flight['expected'] else flight['sched'],
            'status': flight['status']
        }
        for flight in requested_flights
    ]
    log_message(f"Fetched {len(requested_flights)} flights for date {requested_date}")
    return jsonify(result)

@app.route('/')
def index():
    log_message("Rendering index page.")
    return render_template('index.html')
