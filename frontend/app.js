// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});

// DOM Elements
const urlInput = document.getElementById('urlInput');
const pasteIndicator = document.getElementById('pasteIndicator');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const videoCard = document.getElementById('videoCard');
const qualityCard = document.getElementById('qualityCard');
const downloadCard = document.getElementById('downloadCard');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoTitle = document.getElementById('videoTitle');
const videoUploader = document.getElementById('videoUploader');
const durationBadge = document.getElementById('durationBadge');
const qualityTags = document.getElementById('qualityTags');
const downloadBtn = document.getElementById('downloadBtn');
const downloadStatus = document.getElementById('downloadStatus');

// State
let currentVideoData = null;
let selectedFormat = null;
let isAnalyzing = false;

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Format duration
function formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
}

// Validate URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// Hide all states
function hideAllStates() {
    emptyState.classList.add('hidden');
    loadingState.classList.add('hidden');
    videoCard.classList.add('hidden');
    qualityCard.classList.add('hidden');
    downloadCard.classList.add('hidden');
}

// Show loading state
function showLoading() {
    hideAllStates();
    loadingState.classList.remove('hidden');
    lucide.createIcons();
}

// Show video info
function showVideoInfo(data) {
    hideAllStates();
    
    currentVideoData = data;
    
    // Update video info
    videoThumbnail.src = data.thumbnail || '';
    videoTitle.textContent = data.title || 'Unknown Title';
    videoUploader.textContent = data.uploader || '';
    
    // Update duration
    if (data.duration) {
        durationBadge.textContent = formatDuration(data.duration);
        durationBadge.classList.remove('hidden');
    } else {
        durationBadge.classList.add('hidden');
    }
    
    videoCard.classList.remove('hidden');
    
    // Render quality tags
    renderQualityTags(data.formats);
    qualityCard.classList.remove('hidden');
    
    // Show download button
    downloadCard.classList.remove('hidden');
    
    lucide.createIcons();
}

// Render quality tags
function renderQualityTags(formats) {
    qualityTags.innerHTML = '';
    
    if (!formats || formats.length === 0) {
        qualityTags.innerHTML = '<span class="text-slate-500 text-sm">Нет доступных форматов</span>';
        return;
    }
    
    // Select first format by default
    selectedFormat = formats[0];
    
    formats.forEach((format, index) => {
        const tag = document.createElement('button');
        const isSelected = index === 0;
        const sizeText = format.filesize ? ` • ${format.filesize}` : '';
        
        tag.className = `quality-tag px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            isSelected 
                ? 'selected text-white' 
                : 'bg-midnight-800/50 border-slate-700 text-slate-400 hover:border-violet-500/50 hover:text-violet-300'
        }`;
        
        tag.innerHTML = `
            <span class="flex items-center gap-2">
                <i data-lucide="${format.type === 'audio' ? 'music' : 'video'}" class="w-4 h-4"></i>
                ${format.quality}${sizeText}
            </span>
        `;
        
        tag.addEventListener('click', () => {
            // Update selected state
            document.querySelectorAll('.quality-tag').forEach(t => {
                t.className = 'quality-tag px-4 py-2 rounded-xl text-sm font-medium border transition-all bg-midnight-800/50 border-slate-700 text-slate-400 hover:border-violet-500/50 hover:text-violet-300';
            });
            tag.className = 'quality-tag px-4 py-2 rounded-xl text-sm font-medium border transition-all selected text-white';
            
            selectedFormat = format;
            lucide.createIcons();
        });
        
        qualityTags.appendChild(tag);
    });
}

// Analyze video
async function analyzeVideo(url) {
    if (isAnalyzing) return;
    
    isAnalyzing = true;
    showLoading();
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
            throw new Error('Failed to analyze video');
        }
        
        const data = await response.json();
        showVideoInfo(data);
        
    } catch (error) {
        console.error('Analysis error:', error);
        hideAllStates();
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
            <div class="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-500/10 flex items-center justify-center">
                <i data-lucide="alert-circle" class="w-10 h-10 text-red-400"></i>
            </div>
            <p class="text-red-400 text-lg">Ошибка анализа</p>
            <p class="text-slate-500 text-sm mt-2">${error.message}</p>
        `;
        lucide.createIcons();
    } finally {
        isAnalyzing = false;
    }
}

// Download video
async function downloadVideo() {
    if (!currentVideoData || !selectedFormat) return;
    
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `
        <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
        <span>Подготовка...</span>
    `;
    downloadStatus.textContent = 'Загрузка начнется автоматически';
    downloadStatus.classList.remove('text-red-400');
    downloadStatus.classList.add('text-slate-400');
    downloadStatus.classList.remove('hidden');
    lucide.createIcons();
    
    try {
        const params = new URLSearchParams({
            url: currentVideoData.original_url,
            format_id: selectedFormat.format_id,
            type: selectedFormat.type
        });
        
        const downloadUrl = `${CONFIG.API_URL}/download?${params}`;
        
        // Use fetch to download and create blob
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'video.mp4';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="([^"]+)"/);
            if (match) filename = match[1];
        }
        
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
        
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
            <i data-lucide="download" class="w-5 h-5"></i>
            <span>Скачать</span>
        `;
        downloadStatus.textContent = 'Загрузка завершена!';
        lucide.createIcons();
        
        setTimeout(() => {
            downloadStatus.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('Download error:', error);
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
            <i data-lucide="download" class="w-5 h-5"></i>
            <span>Скачать</span>
        `;
        downloadStatus.textContent = 'Ошибка загрузки. Попробуйте снова.';
        downloadStatus.classList.remove('text-slate-400');
        downloadStatus.classList.add('text-red-400');
        lucide.createIcons();
    }
}

// Event listeners
const debouncedAnalyze = debounce((url) => {
    if (isValidUrl(url)) {
        analyzeVideo(url);
    }
}, 800);

urlInput.addEventListener('paste', (e) => {
    pasteIndicator.classList.remove('hidden');
    setTimeout(() => {
        pasteIndicator.classList.add('hidden');
    }, 500);
    
    const pastedText = e.clipboardData.getData('text');
    if (isValidUrl(pastedText)) {
        debouncedAnalyze(pastedText);
    }
});

urlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (isValidUrl(url)) {
        debouncedAnalyze(url);
    } else if (url === '') {
        hideAllStates();
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
            <div class="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <i data-lucide="film" class="w-10 h-10 text-slate-600"></i>
            </div>
            <p class="text-slate-500 text-lg">Вставьте ссылку, чтобы начать магию</p>
            <p class="text-slate-600 text-sm mt-2">Поддерживаются YouTube и многие другие сервисы</p>
        `;
        lucide.createIcons();
    }
});

downloadBtn.addEventListener('click', downloadVideo);

// Health check on load
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${CONFIG.API_URL}/health`, { 
            method: 'GET',
            mode: 'cors'
        });
        if (response.ok) {
            console.log('Backend is ready');
        }
    } catch (error) {
        console.log('Backend may be starting up...');
    }
});
