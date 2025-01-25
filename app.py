from flask import Flask, jsonify, render_template, request
from datetime import datetime
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)
URL = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"

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
        airport_status = "Probably closed"
    elif total_minutes <= 3:
        airport_status = "Closing"
    elif total_minutes <= 20:
        airport_status = "Closing soon"
    else:
        airport_status = "Airport open"

    next_flight['datetime'] = next_flight['datetime'].strftime('%Y-%m-%d %H:%M:%S')

    return {
        "current_time": current_time.strftime('%Y-%m-%d %H:%M:%S'),
        "time_remaining": time_remaining,
        "airport_status": airport_status,
        "next_flight": next_flight
    }

def handle_flight_request(processor, day_filter=None):
    soup = fetch_data(URL)
    if not soup:
        return jsonify({"error": "Could not fetch flight information."}), 500

    flights = parse_flight_data(soup)
    if day_filter:
        flights = [flight for flight in flights if flight['date'] == day_filter]

    current_time = datetime.now()
    return jsonify(processor(flights, current_time))

# Endpoints
@app.route('/api/flights', methods=['GET'])
def get_flights_api():
    day = request.args.get('day', None)
    return handle_flight_request(lambda flights, _: flights, day_filter=day)

@app.route('/api/next_flight', methods=['GET'])
def get_next_flight_with_time_api():
    return handle_flight_request(
        lambda flights, current_time: calculate_time_remaining(
            get_next_flight(flights, current_time), current_time
        )
    )

@app.route('/api/todays_flights', methods=['GET'])
def get_todays_flights():
    soup = fetch_data(URL)
    if not soup:
        return jsonify({"error": "Could not fetch flight information."}), 500

    flights = parse_flight_data(soup)
    today = datetime.now().strftime('%A %d %B %Y')

    todays_flights = [flight for flight in flights if flight['date'] == today]
    result = [
        {
            'flight_code': flight['flight'],
            'expected_time': flight['expected'] if flight['expected'] else flight['sched'],
            'status': flight['status']
        }
        for flight in todays_flights
    ]

    return jsonify(result)

@app.route('/')
def index():
    return render_template('index.html')
