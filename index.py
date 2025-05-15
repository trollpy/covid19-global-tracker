from flask import Flask, jsonify, request, render_template
import requests
import json
from datetime import datetime, timedelta
import pandas as pd
from flask_cors import CORS
from werkzeug.contrib.cache import SimpleCache

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
cache = SimpleCache()  # Simple in-memory cache

# Base URL for COVID-19 data API
BASE_URL = "https://disease.sh/v3/covid-19"

# Cache duration in seconds (15 minutes)
CACHE_DURATION = 900

@app.route('/')
def index():
    """Render the main application page"""
    return render_template('index.html')

@app.route('/api/countries')
def get_countries():
    """Get list of all available countries for autocomplete"""
    # Check cache first
    countries = cache.get('countries')
    if countries is None:
        try:
            response = requests.get(f"{BASE_URL}/countries")
            response.raise_for_status()
            data = response.json()
            # Extract relevant country data for autocomplete
            countries = [{"name": country["country"], 
                          "code": country["countryInfo"]["iso2"], 
                          "flag": country["countryInfo"]["flag"]} 
                         for country in data if "countryInfo" in country and "iso2" in country["countryInfo"]]
            # Sort alphabetically
            countries = sorted(countries, key=lambda x: x["name"])
            # Cache the results
            cache.set('countries', countries, timeout=CACHE_DURATION)
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Error fetching countries: {e}")
            return jsonify({"error": "Failed to fetch country data"}), 500
    
    return jsonify(countries)

@app.route('/api/global')
def get_global_stats():
    """Get global COVID-19 statistics"""
    # Check cache first
    global_stats = cache.get('global_stats')
    if global_stats is None:
        try:
            response = requests.get(f"{BASE_URL}/all")
            response.raise_for_status()
            global_stats = response.json()
            # Add calculated metrics
            global_stats["recoveryRate"] = round((global_stats["recovered"] / global_stats["cases"]) * 100, 2) if global_stats["cases"] > 0 else 0
            global_stats["fatalityRate"] = round((global_stats["deaths"] / global_stats["cases"]) * 100, 2) if global_stats["cases"] > 0 else 0
            global_stats["activeCasePercentage"] = round((global_stats["active"] / global_stats["cases"]) * 100, 2) if global_stats["cases"] > 0 else 0
            # Cache the results
            cache.set('global_stats', global_stats, timeout=CACHE_DURATION)
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Error fetching global stats: {e}")
            return jsonify({"error": "Failed to fetch global data"}), 500
    
    return jsonify(global_stats)

@app.route('/api/country/<country>')
def get_country_stats(country):
    """Get COVID-19 statistics for a specific country"""
    # Check cache first
    cache_key = f'country_{country}'
    country_stats = cache.get(cache_key)
    if country_stats is None:
        try:
            response = requests.get(f"{BASE_URL}/countries/{country}")
            response.raise_for_status()
            country_stats = response.json()
            # Add calculated metrics
            country_stats["recoveryRate"] = round((country_stats["recovered"] / country_stats["cases"]) * 100, 2) if country_stats["cases"] > 0 else 0
            country_stats["fatalityRate"] = round((country_stats["deaths"] / country_stats["cases"]) * 100, 2) if country_stats["cases"] > 0 else 0
            country_stats["activeCasePercentage"] = round((country_stats["active"] / country_stats["cases"]) * 100, 2) if country_stats["cases"] > 0 else 0
            # Cache the results
            cache.set(cache_key, country_stats, timeout=CACHE_DURATION)
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Error fetching data for {country}: {e}")
            return jsonify({"error": f"Failed to fetch data for {country}"}), 500
    
    return jsonify(country_stats)

@app.route('/api/historical/<country>')
def get_historical_data(country):
    """Get historical COVID-19 data for a specific country"""
    days = request.args.get('days', 30, type=int)
    cache_key = f'historical_{country}_{days}'
    historical_data = cache.get(cache_key)
    
    if historical_data is None:
        try:
            # Get historical data for the specified country
            response = requests.get(f"{BASE_URL}/historical/{country}?lastdays={days}")
            response.raise_for_status()
            data = response.json()
            
            # Process the data into a format suitable for charts
            timeline = data.get('timeline', {})
            
            historical_data = {
                'dates': list(timeline.get('cases', {}).keys()),
                'cases': list(timeline.get('cases', {}).values()),
                'deaths': list(timeline.get('deaths', {}).values()),
                'recovered': list(timeline.get('recovered', {}).values())
            }
            
            # Calculate daily new cases, deaths, and recoveries
            if len(historical_data['cases']) > 1:
                historical_data['newCases'] = [0] + [
                    historical_data['cases'][i] - historical_data['cases'][i-1] 
                    for i in range(1, len(historical_data['cases']))
                ]
                historical_data['newDeaths'] = [0] + [
                    historical_data['deaths'][i] - historical_data['deaths'][i-1] 
                    for i in range(1, len(historical_data['deaths']))
                ]
                historical_data['newRecovered'] = [0] + [
                    historical_data['recovered'][i] - historical_data['recovered'][i-1] 
                    for i in range(1, len(historical_data['recovered']))
                ]
            
            # Cache the results
            cache.set(cache_key, historical_data, timeout=CACHE_DURATION)
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Error fetching historical data for {country}: {e}")
            return jsonify({"error": f"Failed to fetch historical data for {country}"}), 500
    
    return jsonify(historical_data)

@app.route('/api/vaccine/<country>')
def get_vaccine_data(country):
    """Get vaccination data for a specific country"""
    cache_key = f'vaccine_{country}'
    vaccine_data = cache.get(cache_key)
    
    if vaccine_data is None:
        try:
            # Get vaccine data for the specified country
            response = requests.get(f"{BASE_URL}/vaccine/coverage/countries/{country}?lastdays=all")
            response.raise_for_status()
            data = response.json()
            
            # Process the data
            timeline = data.get('timeline', {})
            
            vaccine_data = {
                'dates': list(timeline.keys()),
                'vaccinations': list(timeline.values())
            }
            
            # Cache the results
            cache.set(cache_key, vaccine_data, timeout=CACHE_DURATION)
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Error fetching vaccine data for {country}: {e}")
            return jsonify({"error": f"Failed to fetch vaccine data for {country}"}), 500
    
    return jsonify(vaccine_data)

@app.route('/api/compare')
def compare_countries():
    """Compare COVID-19 data between multiple countries"""
    countries = request.args.get('countries', '')
    metric = request.args.get('metric', 'cases')  # Default metric is cases
    
    # Split countries by comma
    country_list = [c.strip() for c in countries.split(',') if c.strip()]
    
    if not country_list:
        return jsonify({"error": "No countries specified"}), 400
    
    result = {}
    
    for country in country_list:
        cache_key = f'country_{country}'
        country_stats = cache.get(cache_key)
        
        if country_stats is None:
            try:
                response = requests.get(f"{BASE_URL}/countries/{country}")
                response.raise_for_status()
                country_stats = response.json()
                # Cache the results
                cache.set(cache_key, country_stats, timeout=CACHE_DURATION)
            except requests.exceptions.RequestException as e:
                app.logger.error(f"Error fetching data for {country}: {e}")
                continue
        
        # Add country data to the result
        if metric in country_stats:
            result[country] = {
                'value': country_stats[metric],
                'perMillion': country_stats.get(f"{metric}PerOneMillion", 0),
                'population': country_stats.get('population', 0)
            }
    
    if not result:
        return jsonify({"error": "Failed to fetch data for any of the specified countries"}), 500
    
    return jsonify(result)

@app.route('/api/risk-assessment/<country>')
def get_risk_assessment(country):
    """Calculate risk assessment based on various factors"""
    cache_key = f'risk_{country}'
    risk_assessment = cache.get(cache_key)
    
    if risk_assessment is None:
        try:
            # Get country data
            response = requests.get(f"{BASE_URL}/countries/{country}")
            response.raise_for_status()
            country_data = response.json()
            
            # Calculate risk factors (simplified version)
            active_per_million = country_data.get('activePerOneMillion', 0)
            deaths_per_million = country_data.get('deathsPerOneMillion', 0)
            critical_per_million = country_data.get('criticalPerOneMillion', 0)
            tests_per_million = country_data.get('testsPerOneMillion', 0)
            
            # Risk scoring logic (simplified)
            active_risk = min(active_per_million / 500, 100) * 0.4  # Weight of 40%
            death_risk = min(deaths_per_million / 250, 100) * 0.3   # Weight of 30%
            critical_risk = min(critical_per_million / 25, 100) * 0.2  # Weight of 20%
            
            # Testing factor (more tests = lower risk)
            testing_factor = max(0, min(1 - (tests_per_million / 500000), 1)) * 0.1  # Weight of 10%
            
            # Calculate total risk (0-100 scale)
            total_risk = active_risk + death_risk + critical_risk + testing_factor
            
            # Risk category
            risk_category = "Low"
            if total_risk > 70:
                risk_category = "Very High"
            elif total_risk > 50:
                risk_category = "High"
            elif total_risk > 30:
                risk_category = "Moderate"
            elif total_risk > 10:
                risk_category = "Low"
            else:
                risk_category = "Very Low"
            
            risk_assessment = {
                'score': round(total_risk, 2),
                'category': risk_category,
                'factors': {
                    'activeCases': active_per_million,
                    'deathRate': deaths_per_million,
                    'criticalCases': critical_per_million,
                    'testingRate': tests_per_million
                }
            }
            
            # Cache the results
            cache.set(cache_key, risk_assessment, timeout=CACHE_DURATION)
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Error calculating risk assessment for {country}: {e}")
            return jsonify({"error": f"Failed to calculate risk assessment for {country}"}), 500
    
    return jsonify(risk_assessment)

@app.route('/api/export/<country>')
def export_data(country):
    """Prepare data for export (CSV format)"""
    format_type = request.args.get('format', 'json')
    
    try:
        # Get country data
        country_response = requests.get(f"{BASE_URL}/countries/{country}")
        country_response.raise_for_status()
        country_data = country_response.json()
        
        # Get historical data
        historical_response = requests.get(f"{BASE_URL}/historical/{country}?lastdays=30")
        historical_response.raise_for_status()
        historical_data = historical_response.json()
        
        # Prepare export data
        export_data = {
            'country': country,
            'updated': datetime.fromtimestamp(country_data.get('updated', 0)/1000).strftime('%Y-%m-%d %H:%M:%S'),
            'totalCases': country_data.get('cases', 0),
            'activeCases': country_data.get('active', 0),
            'recovered': country_data.get('recovered', 0),
            'deaths': country_data.get('deaths', 0),
            'tests': country_data.get('tests', 0),
            'population': country_data.get('population', 0),
            'casesPerOneMillion': country_data.get('casesPerOneMillion', 0),
            'deathsPerOneMillion': country_data.get('deathsPerOneMillion', 0),
            'historical': historical_data.get('timeline', {})
        }
        
        if format_type.lower() == 'csv':
            # Convert to CSV format
            df = pd.DataFrame({
                'Date': list(export_data['historical'].get('cases', {}).keys()),
                'Total Cases': list(export_data['historical'].get('cases', {}).values()),
                'Deaths': list(export_data['historical'].get('deaths', {}).values()),
                'Recovered': list(export_data['historical'].get('recovered', {}).values())
            })
            
            # Add summary data as first row
            summary_df = pd.DataFrame({
                'Date': ['Summary'],
                'Total Cases': [export_data['totalCases']],
                'Deaths': [export_data['deaths']],
                'Recovered': [export_data['recovered']]
            })
            
            df = pd.concat([summary_df, df])
            
            return df.to_csv(index=False)
        else:
            return jsonify(export_data)
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error exporting data for {country}: {e}")
        return jsonify({"error": f"Failed to export data for {country}"}), 500

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)