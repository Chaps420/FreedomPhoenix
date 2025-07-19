// Simple Stream Manager - No Firebase Required for Testing
class SimpleStreamManager {
    constructor() {
        this.currentVideo = null;
        this.playlist = [];
        this.storageKey = 'freedom_phoenix_stream';
        this.playlistKey = 'freedom_phoenix_playlist';
        
        this.loadFromStorage();
        this.initUI();
        
        // Simulate real-time updates by checking for changes every 2 seconds
        this.updateInterval = setInterval(() => {
            this.checkForUpdates();
        }, 2000);
    }

    initUI() {
        this.elements = {
            statusText: document.getElementById('stream-status-text'),
            videoTitle: document.getElementById('video-title'),
            videoDescription: document.getElementById('video-description'),
            videoThumbnail: document.getElementById('video-thumbnail'),
            muteBtn: document.getElementById('mute-btn'),
            volumeSlider: document.getElementById('volume-slider'),
            refreshBtn: document.getElementById('refresh-btn'),
            loadingMessage: document.getElementById('loading-message'),
            errorMessage: document.getElementById('error-message')
        };

        // Event listeners
        this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.elements.refreshBtn.addEventListener('click', () => this.refreshStream());

        // Set initial volume
        this.elements.volumeSlider.value = 50;
    }

    loadFromStorage() {
        // Load current video
        const savedVideo = localStorage.getItem(this.storageKey);
        if (savedVideo) {
            this.currentVideo = JSON.parse(savedVideo);
            console.log('Loaded current video:', this.currentVideo);
        }

        // Load playlist
        const savedPlaylist = localStorage.getItem(this.playlistKey);
        if (savedPlaylist) {
            this.playlist = JSON.parse(savedPlaylist);
            console.log('Loaded playlist:', this.playlist.length, 'videos');
        }

        // Start playing if we have a current video
        if (this.currentVideo) {
            this.updateVideoInfo();
            this.elements.statusText.textContent = 'LIVE';
            this.hideMessages();
        } else {
            this.showError('No stream currently active. Admin needs to start a video.');
        }
    }

    checkForUpdates() {
        // Check if localStorage has changed (simulates real-time updates)
        const newVideo = localStorage.getItem(this.storageKey);
        const newPlaylist = localStorage.getItem(this.playlistKey);
        
        let updated = false;
        
        if (newVideo !== JSON.stringify(this.currentVideo)) {
            if (newVideo) {
                this.currentVideo = JSON.parse(newVideo);
                console.log('Stream updated:', this.currentVideo);
                this.syncVideo();
                updated = true;
            }
        }
        
        if (newPlaylist !== JSON.stringify(this.playlist)) {
            if (newPlaylist) {
                this.playlist = JSON.parse(newPlaylist);
                console.log('Playlist updated:', this.playlist.length, 'videos');
                updated = true;
            }
        }
        
        if (updated) {
            this.updateVideoInfo();
            this.elements.statusText.textContent = 'LIVE';
            this.hideMessages();
        }
    }

    syncVideo() {
        if (!window.player || !this.currentVideo) return;

        const currentVideoId = window.player.getVideoData()?.video_id;
        
        // Calculate current position
        const now = Date.now();
        const elapsed = Math.floor((now - this.currentVideo.startTime) / 1000);
        
        // If different video, load it
        if (currentVideoId !== this.currentVideo.videoId) {
            console.log('Loading new video:', this.currentVideo.videoId);
            window.player.loadVideoById({
                videoId: this.currentVideo.videoId,
                startSeconds: elapsed
            });
        } else {
            // Same video, just sync the time
            const playerTime = window.player.getCurrentTime();
            const timeDiff = Math.abs(playerTime - elapsed);
            
            // Only sync if difference is significant (more than 3 seconds)
            if (timeDiff > 3) {
                console.log('Syncing video time:', elapsed);
                window.player.seekTo(elapsed, true);
            }
        }
    }

    updateVideoInfo() {
        if (!this.currentVideo) {
            this.elements.videoTitle.textContent = 'Loading stream...';
            this.elements.videoDescription.textContent = 'Waiting for stream to start...';
            this.elements.videoThumbnail.style.display = 'none';
            return;
        }

        this.elements.videoTitle.textContent = this.currentVideo.title;
        this.elements.videoDescription.textContent = 'Now playing on Freedom Phoenix 24/7 Stream';
        
        // Set thumbnail
        const thumbnailUrl = `https://img.youtube.com/vi/${this.currentVideo.videoId}/mqdefault.jpg`;
        this.elements.videoThumbnail.src = thumbnailUrl;
        this.elements.videoThumbnail.style.display = 'block';
    }

    onPlayerReady(event) {
        console.log('YouTube player ready');
        this.isPlayerReady = true;
        
        // Set initial volume
        window.player.setVolume(50);
        
        // Sync current video if available
        if (this.currentVideo) {
            this.syncVideo();
        }
    }

    onPlayerStateChange(event) {
        const state = event.data;
        console.log('Player state changed:', state);
        
        if (state === YT.PlayerState.ENDED) {
            console.log('Video ended, trying next video...');
            this.playNextVideo();
        } else if (state === YT.PlayerState.PLAYING) {
            this.elements.statusText.textContent = 'LIVE';
            this.hideMessages();
        } else if (state === YT.PlayerState.BUFFERING) {
            this.elements.statusText.textContent = 'Buffering...';
        } else if (state === YT.PlayerState.PAUSED) {
            // Auto-resume if paused (for continuous stream)
            setTimeout(() => {
                if (window.player && window.player.getPlayerState() === YT.PlayerState.PAUSED) {
                    window.player.playVideo();
                }
            }, 2000);
        }
    }

    onPlayerError(event) {
        console.error('YouTube player error:', event.data);
        this.showError('Video playback error. Trying next video...');
        setTimeout(() => this.playNextVideo(), 3000);
    }

    playNextVideo() {
        if (!this.playlist || this.playlist.length === 0) {
            this.showError('No more videos in playlist. Admin needs to add more videos.');
            return;
        }

        // Find current video index
        let currentIndex = -1;
        if (this.currentVideo) {
            currentIndex = this.playlist.findIndex(video => 
                video.videoId === this.currentVideo.videoId
            );
        }
        
        // Get next video (or start from beginning)
        const nextIndex = (currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        
        if (nextVideo) {
            // Update current video
            this.currentVideo = {
                videoId: nextVideo.videoId,
                title: nextVideo.title,
                startTime: Date.now()
            };
            
            // Save to localStorage (this will be picked up by admin and other viewers)
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentVideo));
            
            console.log('Auto-advancing to:', nextVideo.title);
            this.updateVideoInfo();
            this.syncVideo();
        }
    }

    // Control Methods
    toggleMute() {
        if (!window.player) return;
        
        if (window.player.isMuted()) {
            window.player.unMute();
            this.elements.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i> Mute';
        } else {
            window.player.mute();
            this.elements.muteBtn.innerHTML = '<i class="fas fa-volume-off"></i> Unmute';
        }
    }

    setVolume(volume) {
        if (!window.player) return;
        window.player.setVolume(volume);
    }

    refreshStream() {
        this.elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        
        // Force reload from localStorage
        this.loadFromStorage();
        
        if (this.currentVideo && window.player) {
            const now = Date.now();
            const elapsed = Math.floor((now - this.currentVideo.startTime) / 1000);
            window.player.seekTo(elapsed, true);
        }
        
        setTimeout(() => {
            this.elements.refreshBtn.innerHTML = '<i class="fas fa-refresh"></i> Refresh';
        }, 1000);
    }

    // Utility Methods
    showLoading() {
        this.elements.loadingMessage.style.display = 'block';
        this.elements.errorMessage.style.display = 'none';
    }

    showError(message) {
        this.elements.errorMessage.style.display = 'block';
        this.elements.loadingMessage.style.display = 'none';
        document.getElementById('error-text').textContent = message;
        this.elements.statusText.textContent = 'Offline';
    }

    hideMessages() {
        this.elements.loadingMessage.style.display = 'none';
        this.elements.errorMessage.style.display = 'none';
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (window.player) {
            window.player.destroy();
        }
    }
}

// Global variables for YouTube API
let streamManager;

// YouTube API ready callback
function onYouTubeIframeAPIReady() {
    console.log('YouTube API ready');
    
    // Create YouTube player
    window.player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'disablekb': 1,
            'fs': 1,
            'modestbranding': 1,
            'rel': 0,
            'showinfo': 0
        },
        events: {
            'onReady': function(event) {
                streamManager.onPlayerReady(event);
            },
            'onStateChange': function(event) {
                streamManager.onPlayerStateChange(event);
            },
            'onError': function(event) {
                streamManager.onPlayerError(event);
            }
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    streamManager = new SimpleStreamManager();
    streamManager.showLoading();
    
    // Show initial message
    setTimeout(() => {
        if (!streamManager.currentVideo) {
            streamManager.showError('Waiting for admin to start the stream...');
        }
    }, 3000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (streamManager) {
        streamManager.destroy();
    }
});
