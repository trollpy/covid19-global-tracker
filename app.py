"""
Main application file for the COVID-19 tracker.
"""

import os
import json
import time
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import requests
import pandas as pd
from apscheduler.schedulers.background import BackgroundScheduler

# Import configuration
from config import *

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# In-memory cache
cache = {
    'countries': {'data': None, 'timestamp': 0},
    'global': {'data': None, 'timestamp': 0},
    'historical': {'data': {}, 'timestamp': 0},
    'vaccine': {'data': {}, 'timestamp': 0}
}

# Create data directory if it doesn't exist
os.makedirs(DATA_DIR, exist_ok=True)


def fetch_covid_data():
    """Fetch latest COVID-19 data and update cache."""
    try:
        # Fetch global data
        global_response = requests.get(f"{COVID_API_BASE_URL}/all")
        if global_response.status_code == 200:
            cache['global']['data'] = global_response.json()
            cache['global']['timestamp'] = time.time()
            
            # Save to file for backup
            with open(f"{DATA_DIR}/global_data.json", 'w') as f:
                json.dump(cache['global']['data'], f)
            
        # Fetch countries data
        countries_response = requests.get(COVID_COUNTRIES_ENDPOINT)
        if countries_response.status_code == 200:
            cache['countries']['data'] = countries_response.json()
            cache['countries']['timestamp'] = time.time()
            
            # Save to file for backup
            with open(f"{DATA_DIR}/countries_data.json", 'w') as f:
                json.dump(cache['countries']['data'], f)
            
        print(f"COVID data updated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print(f"Error updating COVID data: {e}")


# Schedule data refresh every hour
scheduler = BackgroundScheduler()
scheduler.add_job(func=fetch_covid_data, trigger="interval", hours=1)
scheduler.start()

# Fetch data on startup
fetch_covid_data()


@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')


@app.route('/api/countries')
def get_countries():
    """API endpoint to get COVID-19 data for all countries."""
    current_time = time.time()
    
    # If cache is expired or empty, fetch new data
    if (cache['countries']['data'] is None or 
            current_time - cache['countries']['timestamp'] > CACHE_EXPIRATION):
        fetch_covid_data()
        
    # If we still don't have data, try to load from backup file
    if cache['countries']['data'] is None and os.path.exists(f"{DATA_DIR}/countries_data.json"):
        with open(f"{DATA_DIR}/countries_data.json", 'r') as f:
            cache['countries']['data'] = json.load(f)
            cache['countries']['timestamp'] = current_time
    
    return jsonify(cache['countries']['data'])


@app.route('/api/global')
def get_global():
    """API endpoint to get global COVID-19 data."""
    current_time = time.time()
    
    # If cache is expired or empty, fetch new data
    if (cache['global']['data'] is None or 
            current_time - cache['global']['timestamp'] > CACHE_EXPIRATION):
        fetch_covid_data()
        
    # If we still don't have data, try to load from backup file
    if cache['global']['data'] is None and os.path.exists(f"{DATA_DIR}/global_data.json"):
        with open(f"{DATA_DIR}/global_data.json", 'r') as f:
            cache['global']['data'] = json.load(f)
            cache['global']['timestamp'] = current_time
    
    return jsonify(cache['global']['data'])


@app.route('/api/country/<country>')
def get_country(country):
    """API endpoint to get COVID-19 data for a specific country."""
    current_time = time.time()
    
    # If cache is expired or empty, fetch new data
    if (cache['countries']['data'] is None or 
            current_time - cache['countries']['timestamp'] > CACHE_EXPIRATION):
        fetch_covid_data()
    
    if cache['countries']['data']:
        country_data = None
        for c in cache['countries']['data']:
            if c['country'].lower() == country.lower():
                country_data = c
                break
                
        if country_data:
            return jsonify(country_data)
    
    # Country not found
    return jsonify({"error": "Country not found"}), 404


@app.route('/api/historical/<country>')
def get_historical(country):
    """API endpoint to get historical COVID-19 data for a specific country."""
    current_time = time.time()
    
    # Check if we have this country's historical data cached and it's not expired
    if (country not in cache['historical']['data'] or 
            current_time - cache['historical']['timestamp'] > CACHE_EXPIRATION):
        
        try:
            # Fetch historical data for the country
            days = request.args.get('days', '30')  # Default to 30 days
            response = requests.get(f"{COVID_HISTORICAL_ENDPOINT}/{country}?lastdays={days}")
            
            if response.status_code == 200:
                cache['historical']['data'][country] = response.json()
                cache['historical']['timestamp'] = current_time
                
                # Save to file for backup
                os.makedirs(f"{DATA_DIR}/historical", exist_ok=True)
                with open(f"{DATA_DIR}/historical/{country}_data.json", 'w') as f:
                    json.dump(cache['historical']['data'][country], f)
            else:
                return jsonify({"error": "Historical data not available"}), 404
                
        except Exception as e:
            print(f"Error fetching historical data: {e}")
            
            # Try to load from backup file
            if os.path.exists(f"{DATA_DIR}/historical/{country}_data.json"):
                with open(f"{DATA_DIR}/historical/{country}_data.json", 'r') as f:
                    cache['historical']['data'][country] = json.load(f)
                    cache['historical']['timestamp'] = current_time
            else:
                return jsonify({"error": "Failed to fetch historical data"}), 500
    
    return jsonify(cache['historical']['data'][country])


@app.route('/api/vaccine/<country>')
def get_vaccine(country):
    """API endpoint to get vaccination data for a specific country."""
    current_time = time.time()
    
    # Check if we have this country's vaccine data cached and it's not expired
    if (country not in cache['vaccine']['data'] or 
            current_time - cache['vaccine']['timestamp'] > CACHE_EXPIRATION):
        
        try:
            # Fetch vaccine data for the country
            response = requests.get(f"{COVID_VACCINE_ENDPOINT}/{country}")
            
            if response.status_code == 200:
                cache['vaccine']['data'][country] = response.json()
                cache['vaccine']['timestamp'] = current_time
                
                # Save to file for backup
                os.makedirs(f"{DATA_DIR}/vaccine", exist_ok=True)
                with open(f"{DATA_DIR}/vaccine/{country}_data.json", 'w') as f:
                    json.dump(cache['vaccine']['data'][country], f)
            else:
                return jsonify({"error": "Vaccine data not available"}), 404
                
        except Exception as e:
            print(f"Error fetching vaccine data: {e}")
            
            # Try to load from backup file
            if os.path.exists(f"{DATA_DIR}/vaccine/{country}_data.json"):
                with open(f"{DATA_DIR}/vaccine/{country}_data.json", 'r') as f:
                    cache['vaccine']['data'][country] = json.load(f)
                    cache['vaccine']['timestamp'] = current_time
            else:
                return jsonify({"error": "Failed to fetch vaccine data"}), 500
    
    return jsonify(cache['vaccine']['data'][country])


@app.route('/api/compare')
def compare_countries():
    """API endpoint to compare data from multiple countries."""
    countries = request.args.get('countries')
    if not countries:
        return jsonify({"error": "No countries specified"}), 400
        
    countries_list = countries.split(',')
    current_time = time.time()
    
    # If cache is expired or empty, fetch new data
    if (cache['countries']['data'] is None or 
            current_time - cache['countries']['timestamp'] > CACHE_EXPIRATION):
        fetch_covid_data()
    
    if cache['countries']['data']:
        comparison_data = []
        for country_name in countries_list:
            country_data = None
            for c in cache['countries']['data']:
                if c['country'].lower() == country_name.lower():
                    country_data = {
                        'country': c['country'],
                        'cases': c['cases'],
                        'deaths': c['deaths'],
                        'recovered': c['recovered'],
                        'active': c['active'],
                        'casesPerOneMillion': c['casesPerOneMillion'],
                        'deathsPerOneMillion': c['deathsPerOneMillion'],
                        'tests': c['tests'],
                        'testsPerOneMillion': c['testsPerOneMillion'],
                        'population': c['population']
                    }
                    comparison_data.append(country_data)
                    break
                    
        return jsonify(comparison_data)
    
    return jsonify({"error": "Data not available"}), 500


@app.route('/api/risk-assessment/<country>')
def risk_assessment(country):
    """API endpoint to provide a risk assessment for a country."""
    current_time = time.time()
    
    # If cache is expired or empty, fetch new data
    if (cache['countries']['data'] is None or 
            current_time - cache['countries']['timestamp'] > CACHE_EXPIRATION):
        fetch_covid_data()
    
    if cache['countries']['data']:
        country_data = None
        for c in cache['countries']['data']:
            if c['country'].lower() == country.lower():
                country_data = c
                break
                
        if country_data:
            # Calculate risk score based on various metrics
            # This is a simplified example - you can develop a more sophisticated algorithm
            active_per_million = country_data['active'] / country_data['population'] * 1000000
            case_fatality_rate = country_data['deaths'] / country_data['cases'] * 100 if country_data['cases'] > 0 else 0
            
            risk_score = 0
            
            # Active cases per million contribution to risk
            if active_per_million > 10000:
                risk_score += 5
            elif active_per_million > 5000:
                risk_score += 4
            elif active_per_million > 1000:
                risk_score += 3
            elif active_per_million > 500:
                risk_score += 2
            elif active_per_million > 100:
                risk_score += 1
                
            # Case fatality rate contribution to risk
            if case_fatality_rate > 5:
                risk_score += 5
            elif case_fatality_rate > 3:
                risk_score += 4
            elif case_fatality_rate > 2:
                risk_score += 3
            elif case_fatality_rate > 1:
                risk_score += 2
            elif case_fatality_rate > 0.5:
                risk_score += 1
                
            # Determine risk level
            risk_level = ""
            if risk_score >= 8:
                risk_level = "Very High"
            elif risk_score >= 6:
                risk_level = "High"
            elif risk_score >= 4:
                risk_level = "Moderate"
            elif risk_score >= 2:
                risk_level = "Low"
            else:
                risk_level = "Very Low"
                
            return jsonify({
                "country": country_data['country'],
                "riskScore": risk_score,
                "riskLevel": risk_level,
                "activeCasesPerMillion": active_per_million,
                "caseFatalityRate": case_fatality_rate,
                "timestamp": int(time.time() * 1000)
            })
    
    # Country not found
    return jsonify({"error": "Country not found"}), 404


@app.route('/api/export/csv/<country>')
def export_csv(country):
    """API endpoint to export country data as CSV."""
    current_time = time.time()
    
    # If cache is expired or empty, fetch new data
    if (cache['countries']['data'] is None or 
            current_time - cache['countries']['timestamp'] > CACHE_EXPIRATION):
        fetch_covid_data()
    
    if cache['countries']['data']:
        country_data = None
        for c in cache['countries']['data']:
            if c['country'].lower() == country.lower():
                country_data = c
                break
                
        if country_data:
            # Convert to DataFrame for easy CSV conversion
            df = pd.DataFrame([country_data])
            csv_data = df.to_csv(index=False)
            
            # Return CSV data
            return csv_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename={country}_covid_data.csv'
            }
    
    # Country not found
    return jsonify({"error": "Country not found"}), 404


if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=DEBUG)