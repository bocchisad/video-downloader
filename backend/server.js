const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow GitHub Pages and local development
const allowedOrigins = [
  'https://*.github.io',
  'http://localhost:*',
  'http://127.0.0.1:*'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });
    
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Analyze video endpoint
app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Get video info using yt-dlp with anti-bot options for YouTube
    const command = `yt-dlp --dump-single-json --no-warnings --extractor-args "youtube:player_client=web" --geo-bypass --referer "https://www.youtube.com/" --add-header "Accept-Language:en-US,en;q=0.9" "${url}"`;
    const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 1024 * 1024 * 5 }); // 5MB buffer
    
    if (stderr) {
      console.log('yt-dlp stderr:', stderr);
    }
    
    if (!stdout) {
      throw new Error('Empty response from yt-dlp');
    }
    
    // Trim any whitespace and find the first { to handle any garbage at start
    const jsonStart = stdout.indexOf('{');
    const jsonEnd = stdout.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('Invalid JSON response:', stdout.substring(0, 500));
      throw new Error('No valid JSON found in response');
    }
    
    const jsonString = stdout.substring(jsonStart, jsonEnd + 1);
    
    let videoInfo;
    try {
      videoInfo = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      console.error('JSON start:', jsonString.substring(0, 200));
      console.error('JSON end:', jsonString.substring(jsonString.length - 200));
      throw new Error('Failed to parse video info');
    }
    
    // Extract available formats
    const formats = [];
    const seenQualities = new Set();
    
    if (videoInfo.formats) {
      videoInfo.formats.forEach(format => {
        // Video formats (mp4)
        if (format.ext === 'mp4' && format.vcodec !== 'none') {
          const height = format.height || 0;
          let quality = '';
          if (height >= 1080) quality = '1080p';
          else if (height >= 720) quality = '720p';
          else if (height >= 480) quality = '480p';
          else quality = '360p';
          
          if (!seenQualities.has(`video-${quality}`)) {
            seenQualities.add(`video-${quality}`);
            formats.push({
              type: 'video',
              quality: quality,
              format_id: format.format_id,
              ext: 'mp4',
              filesize: format.filesize || format.filesize_approx || null
            });
          }
        }
        
        // Audio formats (mp3)
        if (format.acodec !== 'none' && format.vcodec === 'none') {
          if (!seenQualities.has('audio')) {
            seenQualities.add('audio');
            formats.push({
              type: 'audio',
              quality: 'Audio Only',
              format_id: format.format_id,
              ext: 'mp3',
              filesize: format.filesize || format.filesize_approx || null
            });
          }
        }
      });
    }
    
    // Sort formats: best video first, then audio
    formats.sort((a, b) => {
      if (a.type === 'audio' && b.type !== 'audio') return 1;
      if (a.type !== 'audio' && b.type === 'audio') return -1;
      const qualityOrder = { '1080p': 4, '720p': 3, '480p': 2, '360p': 1 };
      return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
    });
    
    // Calculate total file size warning
    const MAX_SIZE_MB = 200;
    const totalSizeMB = formats.reduce((sum, f) => sum + (f.filesize || 0), 0) / (1024 * 1024);
    const warning = totalSizeMB > MAX_SIZE_MB ? 
      `Файл слишком большой (${Math.round(totalSizeMB)}MB). Бесплатный план Render ограничен ~100 сек. Попробуйте Audio Only или качество 360p.` : null;
    
    res.json({
      title: videoInfo.title || 'Unknown Title',
      thumbnail: videoInfo.thumbnail || null,
      duration: videoInfo.duration || null,
      uploader: videoInfo.uploader || null,
      formats: formats,
      original_url: url,
      warning: warning
    });
    
  } catch (error) {
    console.error('Analyze error:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze video', 
      details: error.message 
    });
  }
});

// Download endpoint - streams video to user
app.get('/download', async (req, res) => {
  const { url, format_id, type } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Get video title only (safer than parsing full JSON)
    let safeTitle = 'video';
    try {
      const titleCommand = `yt-dlp --no-warnings --print title --extractor-args "youtube:player_client=web" --geo-bypass --referer "https://www.youtube.com/" "${url}"`;
      const { stdout: titleStdout, stderr: titleStderr } = await execAsync(titleCommand, { timeout: 15000 });
      if (titleStderr) {
        console.log('Title fetch stderr:', titleStderr);
      }
      const videoTitle = titleStdout?.trim();
      if (videoTitle) {
        safeTitle = videoTitle.replace(/[^a-zA-Z0-9\u0400-\u04FF\s-]/g, '').substring(0, 50);
      }
    } catch (titleErr) {
      console.log('Could not fetch title, using default:', titleErr.message);
    }
    const extension = type === 'audio' ? 'mp3' : 'mp4';
    const filename = `${safeTitle}.${extension}`;
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Build yt-dlp args for streaming with anti-bot options
    const baseArgs = [
      '--no-cache-dir',
      '--concurrent-fragments', '5',
      '--no-resize-buffer',
      '--buffer-size', '8K',
      '--no-check-certificate',
      '--quiet',
      '--no-progress',
      '--extractor-args', 'youtube:player_client=web',
      '--geo-bypass',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9'
    ];
    
    let args;
    if (type === 'audio') {
      args = [...baseArgs, '-f', 'bestaudio', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '2', '-o', '-', url];
    } else if (format_id) {
      args = [...baseArgs, '-f', `${format_id}+bestaudio[ext=m4a]/best`, '--merge-output-format', 'mp4', '-o', '-', url];
    } else {
      args = [...baseArgs, '-f', 'best[ext=mp4]/best', '-o', '-', url];
    }
    
    // Spawn yt-dlp for streaming
    const ytDlp = spawn('yt-dlp', args);
    
    ytDlp.stdout.pipe(res);
    
    ytDlp.stderr.on('data', (data) => {
      console.log('yt-dlp stderr:', data.toString());
    });
    
    ytDlp.on('error', (error) => {
      console.error('yt-dlp error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream video' });
      }
    });
    
    ytDlp.on('close', (code) => {
      if (code !== 0) {
        console.error(`yt-dlp exited with code ${code}`);
      }
    });
    
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ 
      error: 'Failed to download video', 
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
