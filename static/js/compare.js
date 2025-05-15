/**
 * compare.js - Handles country comparison functionality for COVID-19 Tracker
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const countrySelect1 = document.getElementById('country-select-1');
    const countrySelect2 = document.getElementById('country-select-2');
    const addCountryBtn = document.getElementById('add-country');
    const selectedCountriesContainer = document.getElementById('selected-countries');
    const comparisonMetric = document.getElementById('comparison-metric');
    const comparisonTable = document.getElementById('comparison-table').querySelector('tbody');
    
    // Store selected countries
    let selectedCountries = [];
    // Store countries data cache
    let countriesCache = [];
    // Store comparison data
    let comparisonData = [];
    // Chart instance
    let comparisonChart = null;
    
    // Fetch countries for dropdowns
    fetchCountries();
    
    // Event listeners
    addCountryBtn.addEventListener('click', addCountryToComparison);
    selectedCountriesContainer.addEventListener('click', handleSelectedCountryClick);
    comparisonMetric.addEventListener('change', updateComparisonChart);
    
    /**
     * Fetch all countries data
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
                populateCountryDropdowns();
            })
            .catch(error => {
                console.error('Error fetching countries:', error);
            });
    }
    
    /**
     * Populate country dropdown selects
     */
    function populateCountryDropdowns() {
        // Clear existing options except the first one
        countrySelect1.innerHTML = '<option value="">Select country</option>';
        countrySelect2.innerHTML = '<option value="">Select country</option>';
        
        // Add countries to dropdowns
        countriesCache.forEach(country => {
            const option1 = document.createElement('option');
            option1.value = country.country;
            option1.textContent = country.country;
            countrySelect1.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = country.country;
            option2.textContent = country.country;
            countrySelect2.appendChild(option2);
        });
    }
    
    /**
     * Add country to comparison
     */
    function addCountryToComparison() {
        const country1 = countrySelect1.value;
        const country2 = countrySelect2.value;
        
        // Add countries if selected
        if (country1 && !selectedCountries.includes(country1)) {
            addCountry(country1);
        }
        
        if (country2 && !selectedCountries.includes(country2)) {
            addCountry(country2);
        }
        
        // Reset dropdowns
        countrySelect1.value = '';
        countrySelect2.value = '';
        
        // Update comparison
        if (selectedCountries.length > 0) {
            fetchComparisonData();
        }
    }
    
    /**
     * Add a country to the selected countries
     * @param {string} countryName - Country name to add
     */
    function addCountry(countryName) {
        // Limit to 5 countries
        if (selectedCountries.length >= 5) {
            alert('You can compare up to 5 countries at a time.');
            return;
        }
        
        // Add to selected countries array
        selectedCountries.push(countryName);
        
        // Create country pill
        const countryPill = document.createElement('div');
        countryPill.classList.add('country-pill');
        countryPill.dataset.country = countryName;
        
        // Find country flag
        const countryData = countriesCache.find(c => c.country === countryName);
        const flagUrl = countryData ? countryData.countryInfo.flag : '';
        
        // Create pill content
        countryPill.innerHTML = `
            <img src="${flagUrl}" alt="${countryName} flag" class="pill-flag">
            <span>${countryName}</span>
            <button class="remove-country" title="Remove ${countryName}">×</button>
        `;
        
        selectedCountriesContainer.appendChild(countryPill);
    }
    
    /**
     * Handle click on selected country pills (for removal)
     * @param {Event} event - Click event
     */
    function handleSelectedCountryClick(event) {
        // Check if the remove button was clicked
        if (event.target.classList.contains('remove-country')) {
            const pill = event.target.closest('.country-pill');
            const countryName = pill.dataset.country;
            
            // Remove from array
            selectedCountries = selectedCountries.filter(c => c !== countryName);
            
            // Remove from UI
            pill.remove();
            
            // Update comparison
            if (selectedCountries.length > 0) {
                fetchComparisonData();
            } else {
                // Clear comparison if no countries left
                clearComparison();
            }
        }
    }
    
    /**
     * Fetch comparison data for selected countries
     */
    function fetchComparisonData() {
        // Show loading state
        comparisonTable.innerHTML = '<tr><td colspan="7" class="loading-message">Loading comparison data...</td></tr>';
        
        // Fetch data from API
        fetch(`/api/compare?countries=${selectedCountries.join(',')}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error fetching comparison data');
                }
                return response.json();
            })
            .then(data => {
                comparisonData = data;
                displayComparisonData();
                updateComparisonChart();
            })
            .catch(error => {
                console.error('Error:', error);
                comparisonTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="error-message">
                            Failed to load comparison data. 
                            <button id="retry-comparison" class="retry-btn">Retry</button>
                        </td>
                    </tr>
                `;
                
                document.getElementById('retry-comparison').addEventListener('click', fetchComparisonData);
            });
    }
    
    /**
     * Display comparison data in table
     */
    function displayComparisonData() {
        // Clear existing table content
        comparisonTable.innerHTML = '';
        
        // Add row for each country
        comparisonData.forEach(country => {
            const row = document.createElement('tr');
            
            // Find country flag
            const countryData = countriesCache.find(c => c.country === country.country);
            const flagUrl = countryData ? countryData.countryInfo.flag : '';
            
            row.innerHTML = `
                <td>
                    <div class="country-cell">
                        <img src="${flagUrl}" alt="${country.country} flag" class="country-flag">
                        <span>${country.country}</span>
                    </div>
                </td>
                <td>${formatNumber(country.cases)}</td>
                <td>${formatNumber(country.casesPerOneMillion)}</td>
                <td>${formatNumber(country.deaths)}</td>
                <td>${formatNumber(country.deathsPerOneMillion)}</td>
                <td>${formatNumber(country.recovered)}</td>
                <td>${formatNumber(country.active)}</td>
            `;
            
            comparisonTable.appendChild(row);
        });
    }
    
    /**
     * Update comparison chart based on selected metric
     */
    function updateComparisonChart() {
        if (!comparisonData || comparisonData.length === 0) {
            return;
        }
        
        const metric = comparisonMetric.value;
        const chartCanvas = document.getElementById('comparison-chart');
        
        // Get labels and values for the selected metric
        const labels = comparisonData.map(country => country.country);
        const values = comparisonData.map(country => country[metric]);
        
        // Get metric display name
        const metricNames = {
            'cases': 'Total Cases',
            'deaths': 'Total Deaths',
            'recovered': 'Recovered',
            'active': 'Active Cases',
            'casesPerOneMillion': 'Cases per Million',
            'deathsPerOneMillion': 'Deaths per Million',
            'testsPerOneMillion': 'Tests per Million'
        };
        
        const metricName = metricNames[metric] || metric;
        
        // Generate colors based on countries
        const colors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
        ];
        
        // Destroy existing chart if it exists
        if (comparisonChart) {
            comparisonChart.destroy();
        }
        
        // Create new chart
        comparisonChart = new Chart(chartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: metricName,
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: colors.slice(0, labels.length).map(color => color.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `COVID-19 ${metricName} Comparison`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += formatNumber(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: metricName
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Clear comparison data
     */
    function clearComparison() {
        // Clear table
        comparisonTable.innerHTML = '<tr><td colspan="7" class="loading-message">Select countries to compare</td></tr>';
        
        // Destroy chart
        if (comparisonChart) {
            comparisonChart.destroy();
            comparisonChart = null;
        }
        
        // Clear data
        comparisonData = [];
    }
    
    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    function formatNumber(num) {
        return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
    }
});