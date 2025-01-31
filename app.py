from datetime import datetime, timedelta
import json
from flask import Flask, jsonify, render_template, request
import os
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)
URL = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"

# Función para escribir en el archivo de logs
def log_message(message):
    ip_address = request.remote_addr
    user_agent = request.headers.get('User-Agent')

    if not os.path.exists('LOGS'):
        os.makedirs('LOGS')

    today_date = datetime.now().strftime('%Y-%m-%d')
    log_filename = f"LOGS/{today_date}.txt"

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
                'datetime': datetime_obj.strftime('%Y-%m-%d %H:%M:%S') if datetime_obj else None
            })

    return sorted(flights, key=lambda f: f['datetime'] or "9999-12-31 23:59:59")

def get_next_flight(flights, current_time):
    for flight in flights:
        if flight['status'] not in ["Arrived", "Departed"] and flight['datetime']:
            flight_datetime = datetime.strptime(flight['datetime'], '%Y-%m-%d %H:%M:%S')
            if flight_datetime > current_time:
                return flight
    return {"message": "No upcoming flights available."}

def calculate_time_remaining(next_flight, current_time):
    if not next_flight.get('datetime'):
        return next_flight

    programmed_time = datetime.strptime(next_flight['datetime'], '%Y-%m-%d %H:%M:%S')
    expected_time_str = next_flight.get('expected')
    next_flight_time = programmed_time

    if expected_time_str:
        try:
            expected_time = datetime(
                year=current_time.year, month=current_time.month, day=current_time.day,
                hour=int(expected_time_str.split(':')[0]), minute=int(expected_time_str.split(':')[1])
            )
            next_flight_time = expected_time
        except (ValueError, IndexError):
            pass

    time_diff = next_flight_time - current_time
    total_minutes = time_diff.total_seconds() // 60
    hours = total_minutes // 60
    minutes = total_minutes % 60

    time_remaining = f"{int(hours)}h {int(minutes)}m" if hours > 0 else f"{int(minutes)}m"

    airport_status = (
        "closed" if total_minutes < 0 else
        "closing" if total_minutes <= 3 else
        "closing_soon" if total_minutes <= 20 else
        "open"
    )

    return {
        "current_time": current_time.strftime('%Y-%m-%d %H:%M:%S'),
        "time_remaining": time_remaining,
        "airport_status": airport_status,
        "next_flight": next_flight
    }

def handle_flight_request(processor, day_filter=None):
    soup = fetch_data(URL)
    if not soup:
        log_message("Failed to fetch flight information.")
        return []

    flights = parse_flight_data(soup)
    if day_filter:
        flights = [flight for flight in flights if flight['date'] == day_filter]

    current_time = datetime.now()
    log_message(f"Flight data processed for {day_filter if day_filter else 'current day'} with current time {current_time}")

    return processor(flights, current_time)

def checkLastUpdate():
    try:
        with open('last_update.txt', 'r') as f:
            stored_data_last_update = f.readline().strip()
            return stored_data_last_update and datetime.strptime(stored_data_last_update, '%Y-%m-%d %H:%M:%S') >= datetime.now() - timedelta(minutes=1)
    except FileNotFoundError:
        return False

@app.route('/api/flights', methods=['GET'])
def get_flights_api():
    day = request.args.get('day', None)
    log_message(f"Fetching flights for day: {day}")

    if not checkLastUpdate():
        flights = handle_flight_request(lambda flights, _: flights, day_filter=day)
        next_flight = get_next_flight(flights, datetime.now())
        next_flight_info = calculate_time_remaining(next_flight, datetime.now())

        flights.append({"next_flight": next_flight_info})

        with open('last_update.txt', 'w') as f:
            f.write(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

        with open('flights_response.json', 'w') as json_file:
            json.dump(flights, json_file)
    else:
        with open('flights_response.json', 'r') as json_file:
            flights = json.load(json_file)

    return jsonify(flights)

@app.route('/')
def index():
    log_message("Rendering index page.")
    return render_template('index.html')

@app.route('/information')
def information():
    log_message("Rendering information page.")
    return render_template('information.html')

if __name__ == '__main__':
    app.run(debug=True)
