// Backend API URL configuration
// Change this to your Render backend URL after deployment
const CONFIG = {
    // For local development:
    // API_URL: 'http://localhost:3000'
    
    // For production (replace with your actual Render URL):
    API_URL: 'https://your-backend-name.onrender.com'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
