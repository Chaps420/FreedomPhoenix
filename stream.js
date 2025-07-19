// Stream.js - YouTube 24/7 Stream Management
class YouTubeStream {
    constructor() {
        this.player = null;
        this.isPlayerReady = false;
        this.currentVideo = null;
        this.playlist = [];
        this.syncInterval = null;
        this.firebase = null;
        this.db = null;
        
        // Initialize Firebase (you'll need to add your config)
        this.initFirebase();
        
        // Bind methods
        this.onPlayerReady = this.onPlayerReady.bind(this);
        this.onPlayerStateChange = this.onPlayerStateChange.bind(this);
        this.onPlayerError = this.onPlayerError.bind(this);
        
        // Initialize UI
        this.initUI();
    }

    initFirebase() {
        // Firebase Configuration - matches admin panel
        const firebaseConfig = {
            apiKey: "AIzaSyBiwWy-J_C83MWeD88ZODIw2H6r2suUPTY",
            authDomain: "fpt-radio.firebaseapp.com",
            databaseURL: "https://fpt-radio-default-rtdb.firebaseio.com",
            projectId: "fpt-radio",
            storageBucket: "fpt-radio.firebasestorage.app",
            messagingSenderId: "121288710296",
            appId: "1:121288710296:web:041addd1c3a91f2c8f58ed"
        };

        try {
            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            console.log('Firebase initialized successfully');
            
            // Start listening for stream data
            this.listenForStreamUpdates();
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.showError('Failed to connect to stream service');
        }
    }

    initUI() {
        // UI Elements
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

    listenForStreamUpdates() {
        if (!this.db) {
            console.error('Database not initialized');
            return;
        }

        // Listen for current video changes
        this.db.collection('stream').doc('current').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                this.handleStreamUpdate(data);
            } else {
                console.log('No current stream data found');
                this.showError('No stream currently active');
            }
        }, (error) => {
            console.error('Error listening for stream updates:', error);
            this.showError('Connection to stream lost');
        });

        // Listen for playlist changes
        this.db.collection('stream').doc('playlist').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                this.playlist = data.videos || [];
                console.log('Playlist updated:', this.playlist.length, 'videos');
            }
        });
    }

    handleStreamUpdate(streamData) {
        console.log('Stream update received:', streamData);
        
        if (!streamData.videoId) {
            this.showError('No video currently playing');
            return;
        }

        // Calculate sync position
        const now = Date.now();
        const startTime = streamData.startTime || now;
        const elapsed = (now - startTime) / 1000; // Convert to seconds
        
        // Update current video info
        this.currentVideo = {
            videoId: streamData.videoId,
            title: streamData.title || 'Unknown Title',
            startTime: startTime,
            elapsed: elapsed
        };

        // Update UI
        this.updateVideoInfo();
        
        // Load/sync video if player is ready
        if (this.isPlayerReady) {
            this.syncVideo();
        }

        this.elements.statusText.textContent = 'LIVE';
        this.hideMessages();
    }

    updateVideoInfo() {
        if (!this.currentVideo) return;

        this.elements.videoTitle.textContent = this.currentVideo.title;
        this.elements.videoDescription.textContent = 'Now playing on Freedom Phoenix 24/7 Stream';
        
        // Set thumbnail
        const thumbnailUrl = `https://img.youtube.com/vi/${this.currentVideo.videoId}/mqdefault.jpg`;
        this.elements.videoThumbnail.src = thumbnailUrl;
        this.elements.videoThumbnail.style.display = 'block';
    }

    syncVideo() {
        if (!this.player || !this.currentVideo) return;

        const currentVideoId = this.player.getVideoData()?.video_id;
        
        // If different video, load it
        if (currentVideoId !== this.currentVideo.videoId) {
            console.log('Loading new video:', this.currentVideo.videoId);
            this.player.loadVideoById({
                videoId: this.currentVideo.videoId,
                startSeconds: this.currentVideo.elapsed
            });
        } else {
            // Same video, just sync the time
            const playerTime = this.player.getCurrentTime();
            const expectedTime = this.currentVideo.elapsed;
            const timeDiff = Math.abs(playerTime - expectedTime);
            
            // Only sync if difference is significant (more than 3 seconds)
            if (timeDiff > 3) {
                console.log('Syncing video time:', expectedTime);
                this.player.seekTo(expectedTime, true);
            }
        }
    }

    // YouTube Player API Callbacks
    onPlayerReady(event) {
        console.log('YouTube player ready');
        this.isPlayerReady = true;
        
        // Set initial volume
        this.player.setVolume(50);
        
        // Sync current video if available
        if (this.currentVideo) {
            this.syncVideo();
        }

        // Start sync interval (check every 30 seconds)
        this.syncInterval = setInterval(() => {
            if (this.currentVideo) {
                // Update elapsed time
                const now = Date.now();
                this.currentVideo.elapsed = (now - this.currentVideo.startTime) / 1000;
                this.syncVideo();
            }
        }, 30000);
    }

    onPlayerStateChange(event) {
        const state = event.data;
        console.log('Player state changed:', state);
        
        if (state === YT.PlayerState.ENDED) {
            // Video ended, should automatically move to next
            this.requestNextVideo();
        } else if (state === YT.PlayerState.PLAYING) {
            this.elements.statusText.textContent = 'LIVE';
        } else if (state === YT.PlayerState.BUFFERING) {
            this.elements.statusText.textContent = 'Buffering...';
        }
    }

    onPlayerError(event) {
        console.error('YouTube player error:', event.data);
        this.showError('Video playback error. Trying next video...');
        
        // Try to load next video after error
        setTimeout(() => this.requestNextVideo(), 2000);
    }

    requestNextVideo() {
        // This would typically be handled by admin, but we can request it
        console.log('Requesting next video...');
        
        // In a real implementation, you might notify the admin or auto-advance
        // For now, we'll wait for admin to update the stream
    }

    // Control Methods
    toggleMute() {
        if (!this.player) return;
        
        if (this.player.isMuted()) {
            this.player.unMute();
            this.elements.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i> Mute';
        } else {
            this.player.mute();
            this.elements.muteBtn.innerHTML = '<i class="fas fa-volume-off"></i> Unmute';
        }
    }

    setVolume(volume) {
        if (!this.player) return;
        this.player.setVolume(volume);
    }

    refreshStream() {
        this.elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        
        // Reload current video data
        if (this.currentVideo) {
            const now = Date.now();
            this.currentVideo.elapsed = (now - this.currentVideo.startTime) / 1000;
            this.syncVideo();
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

    // Cleanup
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.player) {
            this.player.destroy();
        }
    }
}

// Global variables for YouTube API
let streamManager;
let player;

// YouTube API ready callback
function onYouTubeIframeAPIReady() {
    console.log('YouTube API ready');
    
    // Create YouTube player
    player = new YT.Player('youtube-player', {
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
                streamManager.player = player;
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
    streamManager = new YouTubeStream();
    
    // Show loading initially
    streamManager.showLoading();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (streamManager) {
        streamManager.destroy();
    }
});
