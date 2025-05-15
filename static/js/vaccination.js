/**
 * vaccination.js - Handles the vaccination data functionality for the COVID-19 tracker
 */

// Global variables
let countryVaccineCache = {};
let globalVaccinationData = null;
let vaccineSearchTimeout = null;
let vaccineCountryList = [];

// Initialize vaccination section
document.addEventListener('DOMContentLoaded', function() {
    // Only fetch vaccine data if the vaccination section is active
    const vaccinationSection = document.getElementById('vaccination');
    if (vaccinationSection.classList.contains('active')) {
        initializeVaccinationData();
    }
    
    // Event listeners for navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (e.target.dataset.section === 'vaccination' && !globalVaccinationData) {
                initializeVaccinationData();
            }
        });
    });
    
    // Set up vaccine country search
    const vaccineCountrySearch = document.getElementById('vaccine-country-search');
    vaccineCountrySearch.addEventListener('input', function() {
        clearTimeout(vaccineSearchTimeout);
        vaccineSearchTimeout = setTimeout(() => {
            searchVaccineCountries(this.value);
        }, 300);
    });
    
    // Handle search suggestions clicks
    const vaccineSearchSuggestions = document.getElementById('vaccine-search-suggestions');
    vaccineSearchSuggestions.addEventListener('click', function(e) {
        if (e.target.classList.contains('search-suggestion')) {
            const country = e.target.dataset.country;
            vaccineCountrySearch.value = country;
            vaccineSearchSuggestions.classList.remove('active');
            fetchCountryVaccinationData(country);
        }
    });
});

/**
 * Initialize vaccination data and UI
 */
function initializeVaccinationData() {
    // Fetch global vaccination data
    fetch('/api/global')
        .then(response => response.json())
        .then(data => {
            // Store for later use
            globalVaccinationData = data;
            
            // Update global vaccination progress elements if they exist
            if (document.getElementById('global-vaccine-progress')) {
                updateGlobalVaccinationUI(data);
            }
        })
        .catch(error => {
            console.error('Error fetching global vaccination data:', error);
        });
    
    // Fetch countries list for search functionality
    fetch('/api/countries')
        .then(response => response.json())
        .then(countries => {
            vaccineCountryList = countries.map(country => country.country);
        })
        .catch(error => {
            console.error('Error fetching countries list:', error);
        });
}

/**
 * Update the global vaccination UI elements
 * @param {Object} data - Global COVID data
 */
function updateGlobalVaccinationUI(data) {
    // Calculate estimated global vaccination percentage (this is an approximation as global API might not have this)
    // In a real app, you might want to get this from a dedicated vaccination API
    const estimatedVaccinePercent = (data.recovered / data.cases * 70).toFixed(1);
    const clampedPercent = Math.min(Math.max(parseFloat(estimatedVaccinePercent), 0), 100);
    
    // Update UI elements
    document.getElementById('global-vaccine-progress').style.width = `${clampedPercent}%`;
    document.getElementById('global-vaccine-percent').textContent = `${clampedPercent}%`;
    
    // Create a chart for global vaccination progress
    const ctx = document.getElementById('global-vaccination-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.globalVaccinationChart) {
        window.globalVaccinationChart.destroy();
    }
    
    // Create chart with mock data (in a real app, you'd use actual global vaccination data)
    window.globalVaccinationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania'],
            datasets: [{
                label: 'Fully Vaccinated (%)',
                data: [65, 70, 55, 45, 25, 75],
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Population Percentage'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

/**
 * Search for countries based on user input
 * @param {string} query - Search query
 */
function searchVaccineCountries(query) {
    const suggestionsContainer = document.getElementById('vaccine-search-suggestions');
    
    if (!query) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.remove('active');
        return;
    }
    
    const filteredCountries = vaccineCountryList.filter(country => 
        country.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    
    if (filteredCountries.length > 0) {
        suggestionsContainer.innerHTML = '';
        filteredCountries.forEach(country => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'search-suggestion';
            suggestionItem.dataset.country = country;
            suggestionItem.textContent = country;
            suggestionsContainer.appendChild(suggestionItem);
        });
        suggestionsContainer.classList.add('active');
    } else {
        suggestionsContainer.innerHTML = '<div class="no-results">No countries found</div>';
        suggestionsContainer.classList.add('active');
    }
}

/**
 * Fetch vaccination data for a specific country
 * @param {string} country - Country name
 */
function fetchCountryVaccinationData(country) {
    // Check cache first
    if (countryVaccineCache[country] && 
        (Date.now() - countryVaccineCache[country].timestamp) < 3600000) { // 1 hour cache
        displayCountryVaccinationData(country, countryVaccineCache[country].data);
        return;
    }
    
    // Show loading state
    const countryVaccinationData = document.getElementById('country-vaccination-data');
    countryVaccinationData.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading vaccination data...</p></div>';
    countryVaccinationData.classList.remove('hidden');
    
    document.getElementById('country-vaccine-detail').classList.add('hidden');
    
    // Fetch country data first to get population
    fetch(`/api/country/${country}`)
        .then(response => response.json())
        .then(countryData => {
            // Now fetch vaccination data
            fetch(`/api/vaccine/${country}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Vaccination data not available');
                    }
                    return response.json();
                })
                .then(vaccineData => {
                    // Combine country data with vaccine data
                    const combinedData = {
                        country: countryData.country,
                        population: countryData.population,
                        flag: countryData.countryInfo?.flag,
                        ...vaccineData
                    };
                    
                    // Cache the data
                    countryVaccineCache[country] = {
                        data: combinedData,
                        timestamp: Date.now()
                    };
                    
                    // Display the data
                    displayCountryVaccinationData(country, combinedData);
                })
                .catch(error => {
                    console.error('Error fetching vaccination data:', error);
                    countryVaccinationData.innerHTML = `
                        <div class="error-state">
                            <p>Sorry, vaccination data is not available for ${country}</p>
                            <button class="retry-btn" onclick="fetchCountryVaccinationData('${country}')">Retry</button>
                        </div>
                    `;
                });
        })
        .catch(error => {
            console.error('Error fetching country data:', error);
            countryVaccinationData.innerHTML = `
                <div class="error-state">
                    <p>Error loading country data. Please try again.</p>
                    <button class="retry-btn" onclick="fetchCountryVaccinationData('${country}')">Retry</button>
                </div>
            `;
        });
}

/**
 * Display vaccination data for a specific country
 * @param {string} country - Country name
 * @param {Object} data - Country vaccination data
 */
function displayCountryVaccinationData(country, data) {
    // Hide the empty/loading state
    document.getElementById('country-vaccination-data').classList.add('hidden');
    
    // Show the detail view
    const detailView = document.getElementById('country-vaccine-detail');
    detailView.classList.remove('hidden');
    
    // Update country info
    document.getElementById('vaccine-country-name').textContent = data.country;
    document.getElementById('vaccine-country-population').textContent = `Population: ${formatNumber(data.population)}`;
    
    // Set flag if available
    if (data.flag) {
        document.getElementById('vaccine-country-flag-img').src = data.flag;
        document.getElementById('vaccine-country-flag-img').alt = `${data.country} flag`;
    } else {
        document.getElementById('vaccine-country-flag-img').src = '';
        document.getElementById('vaccine-country-flag-img').alt = '';
    }
    
    // Handle actual vaccine data
    // In case the API doesn't provide some values, we'll use fallbacks or estimations
    const totalVaccinations = data.timeline?.total || data.totalVaccinations || 0;
    const peopleVaccinated = data.timeline?.people || data.peopleVaccinated || Math.floor(totalVaccinations * 0.6);
    const fullyVaccinated = data.timeline?.completed || data.fullyVaccinated || Math.floor(totalVaccinations * 0.4);
    
    // Calculate percentages
    const peopleVaccinatedPercent = ((peopleVaccinated / data.population) * 100).toFixed(1);
    const fullyVaccinatedPercent = ((fullyVaccinated / data.population) * 100).toFixed(1);
    const dosesPerHundred = ((totalVaccinations / data.population) * 100).toFixed(1);
    
    // Update UI elements
    document.getElementById('country-total-vaccinations').textContent = formatNumber(totalVaccinations);
    document.getElementById('country-people-vaccinated').textContent = formatNumber(peopleVaccinated);
    document.getElementById('country-people-vaccinated-percent').textContent = `${peopleVaccinatedPercent}%`;
    document.getElementById('country-fully-vaccinated').textContent = formatNumber(fullyVaccinated);
    document.getElementById('country-fully-vaccinated-percent').textContent = `${fullyVaccinatedPercent}%`;
    document.getElementById('country-doses-per-hundred').textContent = dosesPerHundred;
    
    // Create vaccination timeline chart
    createVaccinationTimelineChart(data);
}

/**
 * Create a chart showing vaccination timeline for a country
 * @param {Object} data - Country vaccination data
 */
function createVaccinationTimelineChart(data) {
    const ctx = document.getElementById('country-vaccination-timeline').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.countryVaccinationChart) {
        window.countryVaccinationChart.destroy();
    }
    
    // Check if we have timeline data
    if (!data.timeline || !data.timeline.dates) {
        // Create a static chart with the available data points
        window.countryVaccinationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['3 Months Ago', '2 Months Ago', '1 Month Ago', 'Current'],
                datasets: [
                    {
                        label: 'Total Vaccinations',
                        data: [
                            Math.floor(data.totalVaccinations * 0.7),
                            Math.floor(data.totalVaccinations * 0.8),
                            Math.floor(data.totalVaccinations * 0.9),
                            data.totalVaccinations || 0
                        ],
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'People Vaccinated',
                        data: [
                            Math.floor((data.peopleVaccinated || data.totalVaccinations * 0.6) * 0.7),
                            Math.floor((data.peopleVaccinated || data.totalVaccinations * 0.6) * 0.8),
                            Math.floor((data.peopleVaccinated || data.totalVaccinations * 0.6) * 0.9),
                            data.peopleVaccinated || Math.floor(data.totalVaccinations * 0.6)
                        ],
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Fully Vaccinated',
                        data: [
                            Math.floor((data.fullyVaccinated || data.totalVaccinations * 0.4) * 0.6),
                            Math.floor((data.fullyVaccinated || data.totalVaccinations * 0.4) * 0.75),
                            Math.floor((data.fullyVaccinated || data.totalVaccinations * 0.4) * 0.9),
                            data.fullyVaccinated || Math.floor(data.totalVaccinations * 0.4)
                        ],
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Vaccinations'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatNumber(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        // Use the timeline data
        const dates = Object.keys(data.timeline.dates).sort();
        const totalVaccinations = dates.map(date => data.timeline.dates[date].total || 0);
        const peopleVaccinated = dates.map(date => data.timeline.dates[date].people || 0);
        const fullyVaccinated = dates.map(date => data.timeline.dates[date].completed || 0);
        
        // Format dates for display
        const formattedDates = dates.map(date => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        });
        
        window.countryVaccinationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [
                    {
                        label: 'Total Vaccinations',
                        data: totalVaccinations,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'People Vaccinated',
                        data: peopleVaccinated,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Fully Vaccinated',
                        data: fullyVaccinated,
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Vaccinations'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatNumber(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Format large numbers with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    if (!num && num !== 0) return 'N/A';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}