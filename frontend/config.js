// Backend API URL configuration
// Change this to your Render backend URL after deployment
const CONFIG = {
    // For local development:
    // API_URL: 'http://localhost:3000'
    
    // For production (your Render backend):
    API_URL: 'https://video-downloader-wkuz.onrender.com'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
