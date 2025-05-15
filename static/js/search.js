/**
 * search.js - Handles country search functionality for COVID-19 Tracker
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const countrySearchInput = document.getElementById('country-search');
    const searchSuggestions = document.getElementById('search-suggestions');
    const countryData = document.getElementById('country-data');
    const countryDetail = document.getElementById('country-detail');
    
    // Country data cache
    let countriesCache = [];
    
    // Fetch all countries for search suggestions
    fetchCountries();
    
    // Event listeners
    countrySearchInput.addEventListener('input', handleSearch);
    searchSuggestions.addEventListener('click', handleSuggestionClick);
    
    // Export buttons
    document.getElementById('export-csv').addEventListener('click', exportCountryDataCSV);
    document.getElementById('export-pdf').addEventListener('click', exportCountryDataPDF);
    
    /**
     * Fetch all countries data for search functionality
     */
    function fetchCountries() {
        fetch('/api/countries')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                countriesCache = data.sort((a, b) => a.country.localeCompare(b.country));
            })
            .catch(error => {
                console.error('Error fetching countries:', error);
            });
    }
    
    /**
     * Handle search input
     */
    function handleSearch() {
        const searchTerm = countrySearchInput.value.trim().toLowerCase();
        
        // Clear suggestions if search term is empty
        if (searchTerm.length === 0) {
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.remove('active');
            return;
        }
        
        // Filter countries based on search term
        const filteredCountries = countriesCache
            .filter(country => country.country.toLowerCase().includes(searchTerm))
            .slice(0, 7); // Limit to 7 suggestions
        
        // Display suggestions
        if (filteredCountries.length > 0) {
            displaySuggestions(filteredCountries);
        } else {
            searchSuggestions.innerHTML = '<div class="suggestion-item no-results">No countries found</div>';
            searchSuggestions.classList.add('active');
        }
    }
    
    /**
     * Display search suggestions
     * @param {Array} countries - Filtered countries list
     */
    function displaySuggestions(countries) {
        searchSuggestions.innerHTML = '';
        
        countries.forEach(country => {
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add('suggestion-item');
            suggestionItem.dataset.country = country.country;
            
            // Create suggestion content with flag and country name
            suggestionItem.innerHTML = `
                <img src="${country.countryInfo.flag}" alt="${country.country} flag" class="suggestion-flag">
                <span>${country.country}</span>
            `;
            
            searchSuggestions.appendChild(suggestionItem);
        });
        
        searchSuggestions.classList.add('active');
    }
    
    /**
     * Handle suggestion click
     * @param {Event} event - Click event
     */
    function handleSuggestionClick(event) {
        const suggestionItem = event.target.closest('.suggestion-item');
        
        if (suggestionItem && !suggestionItem.classList.contains('no-results')) {
            const countryName = suggestionItem.dataset.country;
            countrySearchInput.value = countryName;
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.remove('active');
            
            // Fetch and display the selected country data
            fetchCountryData(countryName);
        }
    }
    
    /**
     * Fetch country data
     * @param {string} countryName - Selected country name
     */
    function fetchCountryData(countryName) {
        // Show loading state
        countryData.innerHTML = '<div class="loading">Loading country data...</div>';
        countryDetail.classList.add('hidden');
        
        // Fetch country data
        fetch(`/api/country/${encodeURIComponent(countryName)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Country data not found');
                }
                return response.json();
            })
            .then(data => {
                // Also fetch historical data for charts
                fetch(`/api/historical/${encodeURIComponent(countryName)}`)
                    .then(response => response.json())
                    .then(historicalData => {
                        // Also fetch risk assessment data
                        fetch(`/api/risk-assessment/${encodeURIComponent(countryName)}`)
                            .then(response => response.json())
                            .then(riskData => {
                                displayCountryData(data, historicalData, riskData);
                            })
                            .catch(error => {
                                console.error('Error fetching risk data:', error);
                                displayCountryData(data, historicalData, null);
                            });
                    })
                    .catch(error => {
                        console.error('Error fetching historical data:', error);
                        displayCountryData(data, null, null);
                    });
            })
            .catch(error => {
                console.error('Error fetching country data:', error);
                countryData.innerHTML = `
                    <div class="error-state">
                        <p>Error loading data for ${countryName}</p>
                        <button id="retry-fetch" class="retry-btn">Retry</button>
                    </div>
                `;
                
                document.getElementById('retry-fetch').addEventListener('click', () => {
                    fetchCountryData(countryName);
                });
            });
    }
    
    /**
     * Display country data
     * @param {Object} countryData - Current country data
     * @param {Object} historicalData - Historical data for charts
     * @param {Object} riskData - Risk assessment data
     */
    function displayCountryData(countryData, historicalData, riskData) {
        // Show country detail section
        document.getElementById('country-detail').classList.remove('hidden');
        document.getElementById('country-data').innerHTML = '';
        
        // Set country basic info
        document.getElementById('country-name').textContent = countryData.country;
        document.getElementById('country-flag-img').src = countryData.countryInfo.flag;
        document.getElementById('country-flag-img').alt = `${countryData.country} flag`;
        document.getElementById('country-population').textContent = `Population: ${formatNumber(countryData.population)}`;
        
        // Set country stats
        document.getElementById('country-cases').textContent = formatNumber(countryData.cases);
        document.getElementById('country-deaths').textContent = formatNumber(countryData.deaths);
        document.getElementById('country-recovered').textContent = formatNumber(countryData.recovered);
        document.getElementById('country-active').textContent = formatNumber(countryData.active);
        document.getElementById('country-tests').textContent = formatNumber(countryData.tests);
        
        // Set per million stats
        document.getElementById('country-cases-per-million').textContent = formatNumber(countryData.casesPerOneMillion);
        document.getElementById('country-deaths-per-million').textContent = formatNumber(countryData.deathsPerOneMillion);
        document.getElementById('country-tests-per-million').textContent = formatNumber(countryData.testsPerOneMillion);
        
        // Calculate and set rates
        const recoveryRate = ((countryData.recovered / countryData.cases) * 100).toFixed(2);
        const activePercent = ((countryData.active / countryData.cases) * 100).toFixed(2);
        
        document.getElementById('country-recovery-rate').textContent = `${recoveryRate}%`;
        document.getElementById('country-active-percent').textContent = `${activePercent}%`;
        
        // Set risk data if available
        if (riskData) {
            document.getElementById('country-risk-level').textContent = riskData.riskLevel;
            document.getElementById('country-risk-score').textContent = riskData.riskScore + '/10';
            
            // Add risk level class for styling
            const riskElement = document.getElementById('country-risk-level');
            riskElement.className = ''; // Clear existing classes
            riskElement.classList.add(riskData.riskLevel.toLowerCase().replace(' ', '-'));
        } else {
            document.getElementById('country-risk-level').textContent = 'N/A';
            document.getElementById('country-risk-score').textContent = 'N/A';
        }
        
        // Create charts if historical data is available
        if (historicalData && historicalData.timeline) {
            createHistoricalCharts(countryData.country, historicalData.timeline);
        } else {
            document.getElementById('country-trends-chart').getContext('2d').clearRect(0, 0, 
                document.getElementById('country-trends-chart').width, 
                document.getElementById('country-trends-chart').height);
            document.getElementById('country-daily-chart').getContext('2d').clearRect(0, 0, 
                document.getElementById('country-daily-chart').width, 
                document.getElementById('country-daily-chart').height);
        }
    }
    
    /**
     * Create historical data charts
     * @param {string} countryName - Country name
     * @param {Object} timeline - Historical timeline data
     */
    function createHistoricalCharts(countryName, timeline) {
        // Extract data for charts
        const dates = Object.keys(timeline.cases);
        const casesData = Object.values(timeline.cases);
        const deathsData = Object.values(timeline.deaths);
        const recoveredData = timeline.recovered ? Object.values(timeline.recovered) : [];
        
        // Calculate daily new cases
        const dailyNewCases = [0];
        for (let i = 1; i < casesData.length; i++) {
            dailyNewCases.push(Math.max(0, casesData[i] - casesData[i-1]));
        }
        
        // Format dates for display
        const formattedDates = dates.map(date => {
            const [month, day, year] = date.split('/');
            return `${month}/${day}`;
        });
        
        // Destroy existing charts if they exist
        if (window.countryTrendsChart) {
            window.countryTrendsChart.destroy();
        }
        if (window.countryDailyChart) {
            window.countryDailyChart.destroy();
        }
        
        // Create cumulative trends chart
        const trendsCtx = document.getElementById('country-trends-chart').getContext('2d');
        window.countryTrendsChart = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [
                    {
                        label: 'Total Cases',
                        data: casesData,
                        borderColor: '#FF6384',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Total Deaths',
                        data: deathsData,
                        borderColor: '#36A2EB',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        fill: true,
                        tension: 0.1
                    },
                    ...(recoveredData.length > 0 ? [{
                        label: 'Total Recovered',
                        data: recoveredData,
                        borderColor: '#4BC0C0',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        fill: true,
                        tension: 0.1
                    }] : [])
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `COVID-19 Trends: ${countryName}`
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cumulative Cases'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
        
        // Create daily new cases chart
        const dailyCtx = document.getElementById('country-daily-chart').getContext('2d');
        window.countryDailyChart = new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: formattedDates,
                datasets: [{
                    label: 'Daily New Cases',
                    data: dailyNewCases,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgb(153, 102, 255)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Daily New Cases: ${countryName}`
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'New Cases'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    /**
     * Export country data as CSV
     */
    function exportCountryDataCSV() {
        const countryName = document.getElementById('country-name').textContent;
        
        // Check if country name exists
        if (!countryName) {
            alert('Please select a country first.');
            return;
        }
        
        // Trigger CSV download from API
        window.location.href = `/api/export/csv/${encodeURIComponent(countryName)}`;
    }
    
    /**
     * Export country data as PDF (client-side implementation)
     */
    function exportCountryDataPDF() {
        const countryName = document.getElementById('country-name').textContent;
        
        // Check if country name exists
        if (!countryName) {
            alert('Please select a country first.');
            return;
        }
        
        alert('PDF export functionality will be implemented in a future update.');
        // Note: Actual PDF export would typically use a library like jsPDF or be handled on the server
    }
    
    /**
     * Format numbers with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    function formatNumber(num) {
        return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
    }
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#country-search') && !event.target.closest('#search-suggestions')) {
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.remove('active');
        }
    });
});