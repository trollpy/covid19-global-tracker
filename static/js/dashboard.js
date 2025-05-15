/**
 * Dashboard module for COVID-19 Tracker
 * Handles the main dashboard view with global statistics, map, and charts
 */

// Global variables for dashboard
let worldMap = null;
let globalTrendsChart = null;
let vaccinationChart = null;
let historicalData = null;

// Initialize the dashboard
function initDashboard() {
    // Initialize the world map
    initWorldMap();
    
    // Initialize charts
    initGlobalTrendsChart();
    initVaccinationChart();
    
    // Load top countries table
    loadTopCountriesTable();
    
    // Set up date range selector
    document.getElementById('date-range-selector').addEventListener('change', (e) => {
        updateHistoricalCharts(e.target.value);
    });
}

// Initialize the world map using Leaflet
function initWorldMap() {
    // Create map centered on the world
    worldMap = L.map('map-container', {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 8,
        zoomControl: true
    });
    
    // Add tile layer (base map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(worldMap);
    
    // Add COVID data to map when countries data is available
    if (countriesData && countriesData.length) {
        addCountriesToMap();
    } else {
        // Wait for countriesData to be loaded
        const checkInterval = setInterval(() => {
            if (countriesData && countriesData.length) {
                addCountriesToMap();
                clearInterval(checkInterval);
            }
        }, 500);
    }
}

// Add countries COVID data to the map
function addCountriesToMap() {
    countriesData.forEach(country => {
        if (!country.countryInfo || !country.countryInfo.lat || !country.countryInfo.long) {
            return; // Skip countries without coordinates
        }
        
        // Determine circle color based on cases
        const color = getCountryColor(country.cases);
        
        // Create circle marker
        const radius = Math.sqrt(country.cases) / 500;
        
        const marker = L.circle([country.countryInfo.lat, country.countryInfo.long], {
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            radius: Math.max(radius * 50000, 50000) // Ensure minimum visibility
        }).addTo(worldMap);
        
        // Add popup with country information
        marker.bindPopup(`
            <div class="map-popup">
                <div class="popup-header">
                    <img src="${country.countryInfo.flag}" alt="${country.country} flag" class="popup-flag">
                    <h4>${country.country}</h4>
                </div>
                <div class="popup-content">
                    <p><strong>Cases:</strong> ${appUtils.formatNumber(country.cases)}</p>
                    <p><strong>Deaths:</strong> ${appUtils.formatNumber(country.deaths)}</p>
                    <p><strong>Recovered:</strong> ${appUtils.formatNumber(country.recovered)}</p>
                    <p><strong>Active:</strong> ${appUtils.formatNumber(country.active)}</p>
                </div>
                <div class="popup-footer">
                    <button class="popup-view-details" data-country="${country.country}">View Details</button>
                </div>
            </div>
        `);
        
        // Add click event for "View Details" button
        marker.on('popupopen', () => {
            setTimeout(() => {
                const btn = document.querySelector('.popup-view-details');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        const countryName = e.target.dataset.country;
                        navigateToSection('search');
                        searchCountry(countryName);
                    });
                }
            }, 100);
        });
    });
}

// Get color based on number of cases
function getCountryColor(cases) {
    if (cases > 1000000) return '#FF0000';
    if (cases > 500000) return '#FF7777';
    if (cases > 100000) return '#FFAAAA';
    if (cases > 10000) return '#FFD4D4';
    return '#FFEEEE';
}

// Initialize the global trends chart
function initGlobalTrendsChart() {
    const ctx = document.getElementById('global-trends-chart').getContext('2d');
    
    // Get historical data for the world
    fetchHistoricalData('all', 30).then(data => {
        historicalData = data;
        
        if (!data || !data.timeline) {
            console.error('Invalid historical data format');
            return;
        }
        
        const { cases, deaths, recovered } = data.timeline;
        const labels = Object.keys(cases);
        
        // Format dates
        const formattedLabels = labels.map(date => {
            const [month, day, year] = date.split('/');
            return `${month}/${day}`;
        });
        
        globalTrendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: [
                    {
                        label: 'Cases',
                        data: Object.values(cases),
                        borderColor: '#3e95cd',
                        backgroundColor: 'rgba(62, 149, 205, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Deaths',
                        data: Object.values(deaths),
                        borderColor: '#ff6384',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Recovered',
                        data: Object.values(recovered),
                        borderColor: '#4bc0c0',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += appUtils.formatNumber(context.raw);
                                return label;
                            }
                        }
                    },
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Number of people'
                        },
                        ticks: {
                            callback: function(value) {
                                return appUtils.formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    }).catch(err => {
        console.error('Error loading historical data:', err);
        appUtils.showErrorMessage('Failed to load historical data');
    });
}

// Initialize the vaccination chart
function initVaccinationChart() {
    const ctx = document.getElementById('vaccination-chart').getContext('2d');
    
    // Placeholder data until we implement actual vaccination data
    const topCountries = countriesData
        .filter(country => country.population > 10000000)
        .sort((a, b) => {
            const aVaccinated = a.vaccinated || 0;
            const bVaccinated = b.vaccinated || 0;
            return (bVaccinated / b.population) - (aVaccinated / a.population);
        })
        .slice(0, 10);
    
    const labels = topCountries.map(country => country.country);
    const vaccineData = topCountries.map(country => {
        // Placeholder values
        return Math.floor(Math.random() * 80) + 10;
    });
    
    vaccinationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vaccination Rate (%)',
                data: vaccineData,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Vaccination Rate (%)'
                    }
                }
            }
        }
    });
}

// Load top affected countries table
function loadTopCountriesTable() {
    const tableBody = document.querySelector('#top-countries-table tbody');
    
    if (!countriesData || !countriesData.length) {
        tableBody.innerHTML = '<tr><td colspan="4" class="error-message">No data available</td></tr>';
        return;
    }
    
    // Sort countries by cases (descending)
    const sortedCountries = [...countriesData].sort((a, b) => b.cases - a.cases).slice(0, 10);
    
    // Clear loading message
    tableBody.innerHTML = '';
    
    // Add table rows
    sortedCountries.forEach(country => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="country-cell">
                    <img src="${country.countryInfo?.flag}" alt="${country.country} flag" class="country-flag-small">
                    <span>${country.country}</span>
                </div>
            </td>
            <td>${appUtils.formatNumber(country.cases)}</td>
            <td>${appUtils.formatNumber(country.deaths)}</td>
            <td>${appUtils.formatNumber(country.recovered)}</td>
        `;
        
        // Add click event to view country details
        row.addEventListener('click', () => {
            navigateToSection('search');
            searchCountry(country.country);
        });
        
        tableBody.appendChild(row);
    });
}

// Fetch historical data for a country
async function fetchHistoricalData(country, days = 30) {
    try {
        const response = await fetch(`${appUtils.API_BASE_URL}/api/historical/${country}?days=${days}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch historical data for ${country}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching historical data for ${country}:`, error);
        throw error;
    }
}

// Update historical charts based on selected date range
function updateHistoricalCharts(days) {
    // Update global trends chart
    fetchHistoricalData('all', days).then(data => {
        historicalData = data;
        
        if (!data || !data.timeline) {
            console.error('Invalid historical data format');
            return;
        }
        
        const { cases, deaths, recovered } = data.timeline;
        const labels = Object.keys(cases);
        
        // Format dates
        const formattedLabels = labels.map(date => {
            const [month, day, year] = date.split('/');
            return `${month}/${day}`;
        });
        
        // Update chart data
        globalTrendsChart.data.labels = formattedLabels;
        globalTrendsChart.data.datasets[0].data = Object.values(cases);
        globalTrendsChart.data.datasets[1].data = Object.values(deaths);
        globalTrendsChart.data.datasets[2].data = Object.values(recovered);
        
        globalTrendsChart.update();
    }).catch(err => {
        console.error('Error updating historical data:', err);
    });
}

// Make search function available globally for map integration
window.searchCountry = function(countryName) {
    // This function will be implemented in search.js
    if (typeof performSearch === 'function') {
        performSearch(countryName);
    }
};