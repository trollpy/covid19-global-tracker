"""
Configuration settings for the COVID-19 tracker application.
"""

# API endpoints for COVID-19 data
COVID_API_BASE_URL = "https://disease.sh/v3/covid-19"
COVID_COUNTRIES_ENDPOINT = f"{COVID_API_BASE_URL}/countries"
COVID_HISTORICAL_ENDPOINT = f"{COVID_API_BASE_URL}/historical"
COVID_VACCINE_ENDPOINT = f"{COVID_API_BASE_URL}/vaccine/coverage/countries"

# Cache configuration
CACHE_EXPIRATION = 3600  # Cache expiration time in seconds (1 hour)

# Application settings
DEBUG = True
HOST = "0.0.0.0"
PORT = 5000

# Data directory
DATA_DIR = "data"