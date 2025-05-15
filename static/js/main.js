/**
 * Main JavaScript file for COVID-19 Tracker
 * Handles common functionality used across the app
 */

// Global variables
const API_BASE_URL = window.location.origin;
let countriesData = [];
let globalData = null;
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// DOM Elements
const themeSwitchBtn = document.getElementById('theme-switch');
const lastUpdatedElement = document.getElementById('last-updated-time');
const navButtons = document.querySelectorAll('.nav-btn');
const contentSections = document.querySelectorAll('.content-section');

// Format large numbers with commas
function formatNumber(num) {
    if (num === null || num === undefined) {
        return 'N/A';
    }
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Calculate percentage
function calculatePercentage(part, total) {
    if (!part || !total) return 'N/A';
    return ((part / total) * 100).toFixed(2) + '%';
}

// Fetch global data
async function fetchGlobalData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/global`);
        if (!response.ok) {
            throw new Error('Failed to fetch global data');
        }
        
        globalData = await response.json();
        updateGlobalStats(globalData);
        return globalData;
    } catch (error) {
        console.error('Error fetching global data:', error);
        showErrorMessage('Failed to load global data. Please try again later.');
    }
}

// Fetch all countries data
async function fetchCountriesData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/countries`);
        if (!response.ok) {
            throw new Error('Failed to fetch countries data');
        }
        
        countriesData = await response.json();
        return countriesData;
    } catch (error) {
        console.error('Error fetching countries data:', error);
        showErrorMessage('Failed to load countries data. Please try again later.');
    }
}

// Update global stats on the page
function updateGlobalStats(data) {
    if (!data) return;
    
    document.getElementById('global-cases').textContent = formatNumber(data.cases);
    document.getElementById('global-deaths').textContent = formatNumber(data.deaths);
    document.getElementById('global-recovered').textContent = formatNumber(data.recovered);
    document.getElementById('global-active').textContent = formatNumber(data.active);
    
    // Calculate and display rates
    document.getElementById('global-fatality-rate').textContent = 
        calculatePercentage(data.deaths, data.cases);
    document.getElementById('global-recovery-rate').textContent = 
        calculatePercentage(data.recovered, data.cases);
    document.getElementById('global-active-percent').textContent = 
        calculatePercentage(data.active, data.cases);
    
    // Update last updated time
    const lastUpdatedDate = new Date(data.updated);
    document.getElementById('global-date').textContent = `Last updated: ${formatDate(data.updated)}`;
    lastUpdatedElement.textContent = formatDate(data.updated);
}

// Show error message
function showErrorMessage(message) {
    // Could be enhanced with a proper error notification system
    console.error(message);
    // Create a simple error notification
    const notification = document.createElement('div');
    notification.classList.add('error-notification');
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Toggle between light and dark mode
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
}

// Navigate between sections
function navigateToSection(sectionId) {
    // Hide all sections
    contentSections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update active nav button
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
}

// Get a country's data by name
function getCountryByName(name) {
    if (!name || !countriesData.length) return null;
    return countriesData.find(country => 
        country.country.toLowerCase() === name.toLowerCase());
}

// Initialize the application
async function initApp() {
    // Set theme based on user preference
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    // Fetch initial data
    await Promise.all([fetchGlobalData(), fetchCountriesData()]);
    
    // Initialize section modules
    if (typeof initDashboard === 'function') initDashboard();
    if (typeof initSearch === 'function') initSearch();
    if (typeof initCompare === 'function') initCompare();
    if (typeof initVaccination === 'function') initVaccination();
    if (typeof initRisk === 'function') initRisk();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the app
    initApp();
    
    // Theme switch
    themeSwitchBtn.addEventListener('click', toggleTheme);
    
    // Navigation
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            navigateToSection(section);
        });
    });
});

// Export utility functions for other modules
window.appUtils = {
    formatNumber,
    formatDate,
    calculatePercentage,
    getCountryByName,
    showErrorMessage,
    API_BASE_URL
};