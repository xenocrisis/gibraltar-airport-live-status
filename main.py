# main.py
from flask import Flask, jsonify, render_template
from datetime import datetime
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

def obtener_html(url: str) -> str:
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error al obtener el HTML: {e}")
        return None

def extraer_datos_vuelos(html: str) -> list:
    soup = BeautifulSoup(html, 'html.parser')
    flight_data = []
    days = soup.find_all('div', class_='flight-day')

    for day in days:
        date = day.find('h6').text.strip()
        table_rows = day.find_all('tr')
        for row in table_rows[1:]:
            cols = row.find_all('td')
            flight_info = {
                'date': date,
                'from': cols[0].text.strip(),
                'flight': cols[1].text.strip(),
                'sched': cols[2].text.strip(),
                'status': cols[3].text.strip(),
                'expected': cols[4].text.strip()
            }
            try:
                date_time_str = f"{date} {flight_info['sched']}"
                flight_info['datetime'] = datetime.strptime(date_time_str, '%A %d %B %Y %H:%M')
            except ValueError:
                flight_info['datetime'] = None
            flight_data.append(flight_info)

    return sorted(flight_data, key=lambda x: x['datetime'] if x['datetime'] else datetime.max)

def obtener_proximo_vuelo(vuelos: list) -> dict:
    ahora = datetime.now()
    vuelos_futuros = [vuelo for vuelo in vuelos if vuelo['datetime'] and vuelo['datetime'] > ahora]
    return vuelos_futuros[0] if vuelos_futuros else {"mensaje": "No hay vuelos próximos disponibles."}

def obtener_tiempo_restante(vuelos: list) -> dict:
    ahora = datetime.now()
    vuelo_proximo = obtener_proximo_vuelo(vuelos)
    if 'mensaje' in vuelo_proximo:
        return vuelo_proximo

    tiempo_restante = vuelo_proximo['datetime'] - ahora
    horas_restantes = tiempo_restante.seconds // 3600
    minutos_restantes = (tiempo_restante.seconds // 60) % 60
    return {
        "hora_actual": ahora.strftime('%Y-%m-%d %H:%M:%S'),
        "tiempo_restante": f"{horas_restantes}h {minutos_restantes}m left",
        "proximo_vuelo": vuelo_proximo
    }

@app.route('/api/vuelos', methods=['GET'])
def obtener_vuelos_api():
    url = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"
    html = obtener_html(url)
    if html is None:
        return jsonify({"error": "No se pudo obtener la información de vuelos."}), 500
    vuelos = extraer_datos_vuelos(html)
    return jsonify(vuelos)

@app.route('/api/proximo_vuelo', methods=['GET'])
def obtener_proximo_vuelo_api():
    url = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"
    html = obtener_html(url)
    if html is None:
        return jsonify({"error": "No se pudo obtener la información de vuelos."}), 500
    vuelos = extraer_datos_vuelos(html)
    return jsonify(obtener_proximo_vuelo(vuelos))

@app.route('/api/tiempo_restante', methods=['GET'])
def obtener_tiempo_restante_api():
    url = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"
    html = obtener_html(url)
    if html is None:
        return jsonify({"error": "No se pudo obtener la información de vuelos."}), 500
    vuelos = extraer_datos_vuelos(html)
    return jsonify(obtener_tiempo_restante(vuelos))

@app.route('/')
def index():
    return render_template('index.html')
