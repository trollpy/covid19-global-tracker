/**
 * risk.js - Handles the risk assessment functionality for COVID-19 Tracker
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const riskCountrySearch = document.getElementById('risk-country-search');
    const riskSearchSuggestions = document.getElementById('risk-search-suggestions');
    const riskAssessmentContainer = document.getElementById('risk-assessment-container');
    const riskDetail = document.getElementById('risk-detail');
    const riskCountryName = document.getElementById('risk-country-name');
    const riskCountryFlagImg = document.getElementById('risk-country-flag-img');
    const riskLevelText = document.getElementById('risk-level-text');
    const riskPointer = document.getElementById('risk-pointer');
    const activePerMillion = document.getElementById('active-per-million');
    const activePerMillionBar = document.getElementById('active-per-million-bar');
    const fatalityRate = document.getElementById('fatality-rate');
    const fatalityRateBar = document.getElementById('fatality-rate-bar');
    const testingRate = document.getElementById('testing-rate');
    const testingRateBar = document.getElementById('testing-rate-bar');
    const vaccinationCoverage = document.getElementById('vaccination-coverage');
    const vaccinationCoverageBar = document.getElementById('vaccination-coverage-bar');
    const recommendationsContainer = document.getElementById('recommendations-container');

    // Countries data cache
    let countriesCache = [];

    // Initialize the risk assessment section
    function initRiskAssessment() {
        // Fetch countries for search
        fetchCountries();

        // Set up event listeners
        riskCountrySearch.addEventListener('input', handleCountrySearch);
        riskSearchSuggestions.addEventListener('click', handleSuggestionClick);
    }

    // Fetch countries for search suggestions
    async function fetchCountries() {
        try {
            const response = await fetch('/api/countries');
            if (response.ok) {
                const data = await response.json();
                countriesCache = data.map(country => ({
                    name: country.country,
                    flag: country.countryInfo?.flag || ''
                }));
            } else {
                console.error('Failed to fetch countries data');
            }
        } catch (error) {
            console.error('Error fetching countries:', error);
        }
    }

    // Handle country search input
    function handleCountrySearch() {
        const searchTerm = riskCountrySearch.value.trim().toLowerCase();
        
        // Clear suggestions
        riskSearchSuggestions.innerHTML = '';
        
        if (searchTerm.length < 2) {
            riskSearchSuggestions.classList.remove('active');
            return;
        }
        
        // Filter countries based on search term
        const filteredCountries = countriesCache.filter(country => 
            country.name.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Limit to 5 suggestions
        
        if (filteredCountries.length > 0) {
            filteredCountries.forEach(country => {
                const suggestion = document.createElement('div');
                suggestion.className = 'search-suggestion';
                suggestion.setAttribute('data-country', country.name);
                
                const flag = country.flag ? 
                    `<img src="${country.flag}" alt="${country.name} flag" class="suggestion-flag">` : '';
                
                suggestion.innerHTML = `
                    ${flag}
                    <span>${country.name}</span>
                `;
                
                riskSearchSuggestions.appendChild(suggestion);
            });
            
            riskSearchSuggestions.classList.add('active');
        } else {
            riskSearchSuggestions.classList.remove('active');
        }
    }

    // Handle suggestion click
    function handleSuggestionClick(event) {
        const suggestion = event.target.closest('.search-suggestion');
        if (suggestion) {
            const country = suggestion.getAttribute('data-country');
            riskCountrySearch.value = country;
            riskSearchSuggestions.classList.remove('active');
            
            // Fetch risk assessment for selected country
            fetchRiskAssessment(country);
        }
    }

    // Fetch risk assessment data for a country
    async function fetchRiskAssessment(country) {
        try {
            // Show loading state
            riskAssessmentContainer.innerHTML = '<div class="loading-spinner"></div>';
            riskDetail.classList.add('hidden');
            
            // Fetch risk assessment data
            const riskResponse = await fetch(`/api/risk-assessment/${encodeURIComponent(country)}`);
            
            if (!riskResponse.ok) {
                throw new Error('Failed to fetch risk assessment data');
            }
            
            const riskData = await riskResponse.json();
            
            // Fetch country data for additional information
            const countryResponse = await fetch(`/api/country/${encodeURIComponent(country)}`);
            
            if (!countryResponse.ok) {
                throw new Error('Failed to fetch country data');
            }
            
            const countryData = await countryResponse.json();
            
            // Update UI with risk assessment data
            updateRiskUI(riskData, countryData);
            
        } catch (error) {
            console.error('Error fetching risk assessment:', error);
            riskAssessmentContainer.innerHTML = `
                <div class="error-state">
                    <p>Failed to load risk assessment data. Please try again.</p>
                    <button class="retry-btn">Retry</button>
                </div>
            `;
            
            // Add retry event listener
            document.querySelector('.retry-btn').addEventListener('click', () => {
                fetchRiskAssessment(country);
            });
        }
    }

    // Update UI with risk assessment data
    function updateRiskUI(riskData, countryData) {
        // Update country info
        riskCountryName.textContent = riskData.country;
        
        if (countryData.countryInfo?.flag) {
            riskCountryFlagImg.src = countryData.countryInfo.flag;
            riskCountryFlagImg.alt = `${riskData.country} flag`;
        }
        
        // Update risk level
        riskLevelText.textContent = riskData.riskLevel;
        riskLevelText.className = `risk-level ${getRiskLevelClass(riskData.riskLevel)}`;
        
        // Update risk pointer position (0-100% scale)
        const pointerPosition = calculateRiskPointerPosition(riskData.riskScore);
        riskPointer.style.transform = `rotate(${pointerPosition}deg)`;
        
        // Update risk factors
        updateRiskFactors(riskData, countryData);
        
        // Update recommendations
        updateRecommendations(riskData);
        
        // Show risk detail and hide loading state
        riskDetail.classList.remove('hidden');
        riskAssessmentContainer.innerHTML = '';
    }

    // Calculate risk pointer position based on score
    function calculateRiskPointerPosition(riskScore) {
        // Convert risk score (0-10) to degrees (-90 to 90)
        // -90 degrees is the leftmost position (Very Low)
        // 90 degrees is the rightmost position (Very High)
        return -90 + (riskScore / 10) * 180;
    }

    // Get CSS class based on risk level
    function getRiskLevelClass(riskLevel) {
        switch (riskLevel) {
            case 'Very Low':
                return 'risk-very-low';
            case 'Low':
                return 'risk-low';
            case 'Moderate':
                return 'risk-moderate';
            case 'High':
                return 'risk-high';
            case 'Very High':
                return 'risk-very-high';
            default:
                return '';
        }
    }

    // Update risk factors display
    function updateRiskFactors(riskData, countryData) {
        // Active cases per million
        activePerMillion.textContent = formatNumber(riskData.activeCasesPerMillion);
        const activePerMillionPercentage = calculateFactorPercentage(riskData.activeCasesPerMillion, 10000);
        activePerMillionBar.style.width = `${activePerMillionPercentage}%`;
        activePerMillionBar.className = `factor-bar ${getFactorBarClass(activePerMillionPercentage)}`;
        
        // Case fatality rate
        fatalityRate.textContent = `${riskData.caseFatalityRate.toFixed(2)}%`;
        const fatalityRatePercentage = calculateFactorPercentage(riskData.caseFatalityRate, 5);
        fatalityRateBar.style.width = `${fatalityRatePercentage}%`;
        fatalityRateBar.className = `factor-bar ${getFactorBarClass(fatalityRatePercentage)}`;
        
        // Testing rate - using data from countryData
        const testsPerMillion = countryData.testsPerOneMillion || 0;
        testingRate.textContent = formatNumber(testsPerMillion);
        
        // Higher testing is better, so we invert the percentage
        const testingRatePercentage = 100 - calculateFactorPercentage(testsPerMillion, 500000, true);
        testingRateBar.style.width = `${testingRatePercentage}%`;
        testingRateBar.className = `factor-bar ${getFactorBarClass(testingRatePercentage, true)}`;
        
        // Vaccination coverage - we'll use a placeholder value if not available
        // In a real app, this would be fetched from the vaccination API
        // For now, we'll use a random value between 0-100%
        const vaccinationPercentage = Math.floor(Math.random() * 100);
        vaccinationCoverage.textContent = `${vaccinationPercentage}%`;
        
        // Higher vaccination is better, so we invert the percentage
        const vaccinationBarPercentage = 100 - vaccinationPercentage;
        vaccinationCoverageBar.style.width = `${vaccinationBarPercentage}%`;
        vaccinationCoverageBar.className = `factor-bar ${getFactorBarClass(vaccinationBarPercentage, true)}`;
    }

    // Calculate percentage for risk factor bars
    function calculateFactorPercentage(value, maxValue, capped = false) {
        if (capped) {
            // For capped values, we ensure the percentage is between 0-100%
            return Math.min(100, Math.max(0, (value / maxValue) * 100));
        } else {
            // For uncapped values, we allow percentage to exceed 100%
            // but limit it to 100% for display purposes
            return Math.min(100, (value / maxValue) * 100);
        }
    }

    // Get CSS class for factor bar based on percentage
    function getFactorBarClass(percentage, inverted = false) {
        // For inverted scales (where lower percentage is better)
        if (inverted) {
            percentage = 100 - percentage;
        }
        
        if (percentage < 20) {
            return 'factor-very-low';
        } else if (percentage < 40) {
            return 'factor-low';
        } else if (percentage < 60) {
            return 'factor-moderate';
        } else if (percentage < 80) {
            return 'factor-high';
        } else {
            return 'factor-very-high';
        }
    }

    // Update recommendations based on risk level
    function updateRecommendations(riskData) {
        // Clear previous recommendations
        recommendationsContainer.innerHTML = '';
        
        // Define recommendations based on risk level
        const recommendations = getRiskRecommendations(riskData.riskLevel);
        
        // Add recommendations to container
        recommendations.forEach(recommendation => {
            const recommendationEl = document.createElement('div');
            recommendationEl.className = 'recommendation';
            recommendationEl.innerHTML = `
                <div class="recommendation-icon ${recommendation.icon}"></div>
                <div class="recommendation-content">
                    <h5>${recommendation.title}</h5>
                    <p>${recommendation.description}</p>
                </div>
            `;
            recommendationsContainer.appendChild(recommendationEl);
        });
    }

    // Get recommendations based on risk level
    function getRiskRecommendations(riskLevel) {
        switch (riskLevel) {
            case 'Very Low':
                return [
                    {
                        icon: 'icon-mask',
                        title: 'Masks Optional',
                        description: 'Wearing masks is optional in most settings. Follow local guidelines.'
                    },
                    {
                        icon: 'icon-distance',
                        title: 'Standard Precautions',
                        description: 'Maintain regular hand hygiene and be mindful of symptoms.'
                    },
                    {
                        icon: 'icon-vaccine',
                        title: 'Stay Updated',
                        description: 'Ensure your vaccinations are up-to-date.'
                    }
                ];
            case 'Low':
                return [
                    {
                        icon: 'icon-mask',
                        title: 'Consider Masks',
                        description: 'Consider wearing masks in crowded indoor settings.'
                    },
                    {
                        icon: 'icon-distance',
                        title: 'Maintain Distance',
                        description: 'Try to maintain distance in crowded places.'
                    },
                    {
                        icon: 'icon-hygiene',
                        title: 'Hand Hygiene',
                        description: 'Regular handwashing and use of sanitizers is recommended.'
                    }
                ];
            case 'Moderate':
                return [
                    {
                        icon: 'icon-mask',
                        title: 'Wear Masks Indoors',
                        description: 'Wearing masks is recommended in all indoor public settings.'
                    },
                    {
                        icon: 'icon-distance',
                        title: 'Physical Distancing',
                        description: 'Maintain physical distancing of at least 1 meter in public.'
                    },
                    {
                        icon: 'icon-gathering',
                        title: 'Limit Gatherings',
                        description: 'Consider limiting large indoor gatherings.'
                    },
                    {
                        icon: 'icon-test',
                        title: 'Testing',
                        description: 'Get tested if you have symptoms or after exposure.'
                    }
                ];
            case 'High':
                return [
                    {
                        icon: 'icon-mask',
                        title: 'Mask Required',
                        description: 'High-quality masks (N95/KN95) recommended in all public settings.'
                    },
                    {
                        icon: 'icon-distance',
                        title: 'Strict Distancing',
                        description: 'Maintain strict physical distancing of at least 2 meters.'
                    },
                    {
                        icon: 'icon-gathering',
                        title: 'Avoid Gatherings',
                        description: 'Avoid non-essential gatherings, especially indoors.'
                    },
                    {
                        icon: 'icon-test',
                        title: 'Regular Testing',
                        description: 'Regular testing is recommended, especially after potential exposure.'
                    }
                ];
            case 'Very High':
                return [
                    {
                        icon: 'icon-stay-home',
                        title: 'Stay Home',
                        description: 'Avoid all non-essential outings and work from home if possible.'
                    },
                    {
                        icon: 'icon-mask',
                        title: 'Essential Masking',
                        description: 'Wear high-quality masks (N95/KN95) whenever outside your home.'
                    },
                    {
                        icon: 'icon-distance',
                        title: 'Maximum Protection',
                        description: 'Maintain maximum distance from others and avoid indoor spaces with others.'
                    },
                    {
                        icon: 'icon-test',
                        title: 'Testing Protocol',
                        description: 'Follow strict testing protocols and isolate if exposed or symptomatic.'
                    },
                    {
                        icon: 'icon-medical',
                        title: 'Medical Attention',
                        description: 'Seek medical attention promptly if you develop symptoms.'
                    }
                ];
            default:
                return [];
        }
    }

    // Helper function to format numbers
    function formatNumber(number) {
        if (number === undefined || number === null) return '0';
        
        if (number >= 1000000) {
            return (number / 1000000).toFixed(2) + 'M';
        } else if (number >= 1000) {
            return (number / 1000).toFixed(2) + 'K';
        } else {
            return number.toFixed(2);
        }
    }

    // Initialize risk assessment when this script loads
    initRiskAssessment();
});