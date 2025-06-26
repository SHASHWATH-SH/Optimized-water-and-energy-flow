from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import datetime

app = Flask(__name__)
CORS(app)

# Simulated city state (in-memory for demo)
city_state = {
    'buildings': 10,
    'gardens': 1,
    'waterSources': 4,
    'energyDisrupted': False,
    'waterDisrupted': False,
    'last_optimized': None,
    'stats': {
        'unmet_water_demand': 0,
        'unmet_energy_demand': 0,
        'energy_lost_mwh': 0,
        'outage_duration_hrs': 0,
        'savings': 0,
        'optimized': False
    }
}

# Dummy ML model: optimize water and energy flow
def optimize_city(state):
    optimized = state.copy()
    optimized['last_optimized'] = datetime.datetime.now().isoformat()
    optimized['stats'] = optimized.get('stats', {})
    # Simulate optimization: reduce unmet demand and energy loss
    if optimized['waterDisrupted']:
        optimized['stats']['unmet_water_demand'] = np.random.randint(10, 30)
    else:
        optimized['stats']['unmet_water_demand'] = 0
    if optimized['energyDisrupted']:
        optimized['stats']['unmet_energy_demand'] = np.random.randint(10, 30)
        optimized['stats']['energy_lost_mwh'] = np.random.randint(5, 20)
        optimized['stats']['outage_duration_hrs'] = np.random.randint(1, 5)
    else:
        optimized['stats']['unmet_energy_demand'] = 0
        optimized['stats']['energy_lost_mwh'] = 0
        optimized['stats']['outage_duration_hrs'] = 0
    optimized['stats']['savings'] = float(np.random.uniform(10, 30))
    optimized['stats']['optimized'] = True
    return optimized

@app.route('/')
def home():
    return 'City Simulation API is running!'

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify(city_state)

@app.route('/api/disrupt', methods=['POST'])
def disrupt():
    data = request.json
    if 'waterDisrupted' in data:
        city_state['waterDisrupted'] = bool(data['waterDisrupted'])
    if 'energyDisrupted' in data:
        city_state['energyDisrupted'] = bool(data['energyDisrupted'])
    city_state['stats']['optimized'] = False
    return jsonify({'success': True, 'city_state': city_state})

@app.route('/api/optimize', methods=['POST'])
def optimize():
    # Optionally accept new city data
    data = request.json
    for k in ['buildings', 'gardens', 'waterSources']:
        if k in data:
            city_state[k] = data[k]
    # Run optimization
    optimized = optimize_city(city_state)
    city_state.update(optimized)
    return jsonify(city_state['stats'])

if __name__ == '__main__':
    app.run(debug=True, port=5050) 