// Stream.js - YouTube 24/7 Stream Management (Firebase version)
class YouTubeStream {
    constructor() {
        this.player = null;
        this.isPlayerReady = false;
        this.currentVideo = null;
        this.playlist = [];
        this.syncInterval = null;
        this.db = null;
        
        // Bind methods
        this.onPlayerReady = this.onPlayerReady.bind(this);
        this.onPlayerStateChange = this.onPlayerStateChange.bind(this);
        this.onPlayerError = this.onPlayerError.bind(this);
        
        // Initialize UI first
        this.initUI();
        
        // Initialize Firebase
        this.initFirebase();
    }

    initFirebase() {
        // Firebase Configuration
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
            this.database = firebase.database();
            console.log('Firebase initialized successfully');
            
            // Start listening for stream data
            this.listenForStreamUpdates();
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.showError('Failed to connect to stream service');
        }
    }

    listenForStreamUpdates() {
        if (!this.database) {
            console.error('Database not initialized');
            return;
        }

        // Listen for current video changes
        this.database.ref('stream/current').on('value', async (snapshot) => {
            const data = snapshot.val();
            if (data) {
                await this.handleStreamUpdate(data);
            } else {
                console.log('No current stream data found');
                this.handleNoStreamData();
            }
        }, (error) => {
            console.error('Error listening for stream updates:', error);
            this.showError('Connection to stream lost');
        });

        // Listen for playlist changes
        this.database.ref('stream/playlist').on('value', (snapshot) => {
            const data = snapshot.val();
            this.playlist = data ? data.videos || [] : [];
            console.log('Playlist updated:', this.playlist.length, 'videos');
        }, (error) => {
            console.error('Error listening for playlist updates:', error);
        });
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

        // Check if all elements exist
        const missingElements = [];
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) {
                missingElements.push(key);
            }
        }

        if (missingElements.length > 0) {
            console.error('Missing UI elements:', missingElements);
        }

        // Event listeners (only if elements exist)
        if (this.elements.muteBtn) {
            this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        }
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
            this.elements.volumeSlider.value = 50;
        }
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => this.refreshStream());
        }
        
        // Show loading initially
        this.showLoading();
    }

    async handleStreamUpdate(streamData) {
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
            elapsed: elapsed,
            state: streamData.state || 'playing'
        };

        await this.updateVideoInfo();
        
        // Load/sync video if player is ready
        if (this.isPlayerReady) {
            this.syncVideo();
            
            // Handle pause/play state
            if (streamData.state === 'paused') {
                setTimeout(() => {
                    if (this.player) {
                        this.player.pauseVideo();
                        if (this.elements.statusText) {
                            this.elements.statusText.textContent = 'PAUSED';
                        }
                    }
                }, 1000); // Delay to ensure video is loaded first
            } else {
                if (this.elements.statusText) {
                    this.elements.statusText.textContent = 'LIVE';
                }
            }
        }
        this.hideMessages();
    }

    handleNoStreamData() {
        // Clear current video info
        this.currentVideo = null;
        
        // Update UI to show offline state
        if (this.elements.statusText) {
            this.elements.statusText.textContent = 'OFFLINE';
        }
        
        if (this.elements.videoTitle) {
            this.elements.videoTitle.textContent = 'No Stream Active';
        }
        
        if (this.elements.videoDescription) {
            this.elements.videoDescription.textContent = 'Waiting for admin to start a video...';
        }
        
        if (this.elements.videoThumbnail) {
            this.elements.videoThumbnail.style.display = 'none';
        }
        
        // Pause player if it's playing
        if (this.player && this.isPlayerReady) {
            try {
                this.player.pauseVideo();
            } catch (error) {
                console.log('Error pausing player:', error);
            }
        }
        
        // Show waiting message instead of error
        this.showWaiting('No stream currently active. Waiting for admin to start broadcasting...');
    }

    showWaiting(message) {
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.style.display = 'block';
            this.elements.loadingMessage.textContent = message;
        }
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'none';
        }
    }

    async updateVideoInfo() {
        if (!this.currentVideo) return;

        console.log('updateVideoInfo called with currentVideo:', this.currentVideo);

        // Get real YouTube title using oEmbed API
        let displayTitle = this.currentVideo.title;
        console.log('Initial title:', displayTitle, 'VideoId:', this.currentVideo.videoId);
        
        const needsFetch = !displayTitle || 
                          displayTitle === this.currentVideo.videoId || 
                          displayTitle.length < 3 || 
                          displayTitle.startsWith('Video ');
        
        console.log('Needs fetch?', needsFetch, 'Conditions:', {
            noTitle: !displayTitle,
            titleEqualsId: displayTitle === this.currentVideo.videoId,
            tooShort: displayTitle.length < 3,
            startsWithVideo: displayTitle.startsWith('Video ')
        });
        
        if (needsFetch) {
            console.log('Need to fetch YouTube title for:', this.currentVideo.videoId);
            try {
                const videoUrl = `https://www.youtube.com/watch?v=${this.currentVideo.videoId}`;
                console.log('Fetching from oEmbed API:', videoUrl);
                const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
                console.log('oEmbed response status:', response.status);
                if (response.ok) {
                    const data = await response.json();
                    console.log('oEmbed data received:', data);
                    displayTitle = data.title || this.currentVideo.title || `Video ${this.currentVideo.videoId}`;
                    console.log('New title:', displayTitle);
                } else {
                    console.error('oEmbed API failed with status:', response.status);
                }
            } catch (error) {
                console.error('Failed to fetch YouTube title:', error);
                displayTitle = this.currentVideo.title || `Video ${this.currentVideo.videoId}`;
            }
        }

        if (this.elements.videoTitle) {
            console.log('Setting video title to:', displayTitle);
            this.elements.videoTitle.textContent = displayTitle;
        }
        
        if (this.elements.videoDescription) {
            this.elements.videoDescription.textContent = 'Now playing on Freedom Phoenix 24/7 Stream';
        }
        
        // Set thumbnail
        if (this.elements.videoThumbnail) {
            const thumbnailUrl = `https://img.youtube.com/vi/${this.currentVideo.videoId}/mqdefault.jpg`;
            this.elements.videoThumbnail.src = thumbnailUrl;
            this.elements.videoThumbnail.style.display = 'block';
        }
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
            console.log('Video ended, requesting next video...');
            this.requestNextVideo();
        } else if (state === YT.PlayerState.PLAYING) {
            this.elements.statusText.textContent = 'LIVE';
            this.hideMessages();
        } else if (state === YT.PlayerState.BUFFERING) {
            this.elements.statusText.textContent = 'Buffering...';
        } else if (state === YT.PlayerState.PAUSED) {
            // Auto-resume if paused (for continuous stream)
            setTimeout(() => {
                if (this.player && this.player.getPlayerState() === YT.PlayerState.PAUSED) {
                    this.player.playVideo();
                }
            }, 2000);
        }
    }

    onPlayerError(event) {
        console.error('YouTube player error:', event.data);
        this.showError('Video playback error. Trying next video...');
        
        // Try to load next video after error
        setTimeout(() => this.requestNextVideo(), 2000);
    }

    requestNextVideo() {
        console.log('Requesting next video...');
        
        // Try to auto-advance if we have access to the playlist
        if (this.playlist && this.playlist.length > 0) {
            // Find current video index
            const currentIndex = this.playlist.findIndex(video => 
                video.videoId === this.currentVideo?.videoId
            );
            
            // Get next video (or loop back to start)
            const nextIndex = (currentIndex + 1) % this.playlist.length;
            const nextVideo = this.playlist[nextIndex];
            
            if (nextVideo) {
                console.log('Auto-advancing to next video:', nextVideo.title);
                this.playNextVideo(nextVideo);
                return;
            }
        }
        
        // If we have a current video but no playlist, repeat the same video
        if (this.currentVideo) {
            console.log('No playlist found, repeating current video:', this.currentVideo.title);
            this.playNextVideo(this.currentVideo);
            return;
        }
        
        // Fallback: wait for admin to update the stream
        this.showError('Stream ended. Waiting for next video from admin...');
        if (this.elements.statusText) {
            this.elements.statusText.textContent = 'Waiting for next video...';
        }
    }

    async playNextVideo(video) {
        try {
            // Save next video to Firebase Realtime Database for real-time sync across all viewers
            if (this.database) {
                const streamData = {
                    videoId: video.videoId,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    startTime: Date.now(),
                    lastUpdated: Date.now()
                };

                await this.database.ref('stream/current').set(streamData);
                console.log('Next video saved to Firebase:', video.title);
            }

            // Update current video and force title update
            this.currentVideo = {
                videoId: video.videoId,
                title: video.title || 'Unknown Title',
                startTime: Date.now(),
                elapsed: 0,
                state: 'playing'
            };
            
            // Always call updateVideoInfo to ensure real titles are fetched
            await this.updateVideoInfo();
            
        } catch (error) {
            console.error('Error playing next video:', error);
            this.showError('Error loading next video: ' + error.message);
        }
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
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.style.display = 'block';
        }
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'none';
        }
    }

    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'block';
        }
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.style.display = 'none';
        }
        
        const errorTextElement = document.getElementById('error-text');
        if (errorTextElement) {
            errorTextElement.textContent = message;
        }
        
        if (this.elements.statusText) {
            this.elements.statusText.textContent = 'Offline';
        }
    }

    hideMessages() {
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.style.display = 'none';
        }
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'none';
        }
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
    
    // Create YouTube player without a default video
    player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 0,
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
