from flask import Flask, jsonify, render_template
from datetime import datetime
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

# Función para obtener el HTML de la página
def obtener_html(url: str) -> str:
    """
    Realiza una solicitud GET a la URL proporcionada y devuelve el HTML de la página.
    Si hay un error, retorna None.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()  # Lanza un error si la solicitud falla
        return response.text
    except requests.RequestException as e:
        print(f"Error al obtener el HTML: {e}")
        return None

# Función para extraer los datos de los vuelos desde el HTML
def extraer_datos_vuelos(html: str) -> list:
    """
    Extrae y parsea los vuelos desde el HTML de la página y devuelve una lista de vuelos con sus datos.
    """
    soup = BeautifulSoup(html, 'html.parser')
    flight_data = []

    # Buscar los días y vuelos en la página
    days = soup.find_all('div', class_='flight-day')

    for day in days:
        date = day.find('h6').text.strip()  # Obtener la fecha del vuelo
        table_rows = day.find_all('tr')

        for row in table_rows[1:]:  # Ignorar la fila de encabezado
            cols = row.find_all('td')
            flight_info = {
                'date': date,
                'from': cols[0].text.strip(),
                'flight': cols[1].text.strip(),
                'sched': cols[2].text.strip(),
                'status': cols[3].text.strip(),
                'expected': cols[4].text.strip()
            }

            # Combinar la fecha con la hora de salida
            try:
                date_time_str = f"{date} {flight_info['sched']}"
                flight_info['datetime'] = datetime.strptime(date_time_str, '%A %d %B %Y %H:%M')
            except ValueError:
                flight_info['datetime'] = None  # Si no se puede parsear la fecha y hora

            flight_data.append(flight_info)

    # Ordenar los vuelos por fecha y hora (datetime)
    return sorted(flight_data, key=lambda x: x['datetime'] if x['datetime'] else datetime.max)

# Función para obtener el próximo vuelo
def obtener_proximo_vuelo(vuelos: list) -> dict:
    """
    Devuelve el próximo vuelo basado en la fecha y hora actuales.
    Si no hay vuelos futuros, devuelve un mensaje indicando que no hay vuelos disponibles.
    """
    ahora = datetime.now()
    vuelos_futuros = [vuelo for vuelo in vuelos if vuelo['datetime'] and vuelo['datetime'] > ahora]

    if vuelos_futuros:
        return vuelos_futuros[0]
    else:
        return {"mensaje": "No hay vuelos próximos disponibles."}

# Función para obtener la hora actual y el tiempo restante hasta el siguiente vuelo
def obtener_tiempo_restante(vuelos: list) -> dict:
    """
    Calcula y devuelve el tiempo restante hasta el próximo vuelo.
    Devuelve la hora actual y el tiempo restante en formato "X horas y Y minutos".
    """
    ahora = datetime.now()
    vuelo_proximo = obtener_proximo_vuelo(vuelos)

    if 'mensaje' in vuelo_proximo:
        return vuelo_proximo  # Si no hay vuelos futuros, retornamos el mensaje

    # Calcular el tiempo restante
    tiempo_restante = vuelo_proximo['datetime'] - ahora
    horas_restantes = tiempo_restante.seconds // 3600
    minutos_restantes = (tiempo_restante.seconds // 60) % 60

    return {
        "hora_actual": ahora.strftime('%Y-%m-%d %H:%M:%S'),
        "tiempo_restante": f"{horas_restantes}h {minutos_restantes}m left",
        "proximo_vuelo": vuelo_proximo
    }

# Ruta para obtener todos los vuelos
@app.route('/api/vuelos', methods=['GET'])
def obtener_vuelos_api():
    url = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"
    html = obtener_html(url)

    if html is None:
        return jsonify({"error": "No se pudo obtener la información de vuelos."}), 500

    vuelos = extraer_datos_vuelos(html)

    if len(vuelos) == 0:
        return jsonify({"error": "No se encontraron vuelos."}), 404

    return jsonify(vuelos)

# Ruta para obtener el próximo vuelo
@app.route('/api/proximo_vuelo', methods=['GET'])
def obtener_proximo_vuelo_api():
    url = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"
    html = obtener_html(url)

    if html is None:
        return jsonify({"error": "No se pudo obtener la información de vuelos."}), 500

    vuelos = extraer_datos_vuelos(html)
    proximo_vuelo = obtener_proximo_vuelo(vuelos)

    return jsonify(proximo_vuelo)

# Ruta para obtener la hora actual y el tiempo restante para el siguiente vuelo
@app.route('/api/tiempo_restante', methods=['GET'])
def obtener_tiempo_restante_api():
    url = "https://www.gibraltarairport.gi/airlines-and-destinations/live-flight-information"
    html = obtener_html(url)

    if html is None:
        return jsonify({"error": "No se pudo obtener la información de vuelos."}), 500

    vuelos = extraer_datos_vuelos(html)
    respuesta = obtener_tiempo_restante(vuelos)

    return jsonify(respuesta)

# Ruta para renderizar la página principal
@app.route('/')
def index():
    return render_template('index.html')

# Iniciar la aplicación Flask
if __name__ == '__main__':
    app.run(debug=False)
