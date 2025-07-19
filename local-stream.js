// Simple Stream Manager using localStorage
class LocalStreamManager {
    constructor() {
        this.storageKeys = {
            currentVideo: 'phoenixStream_currentVideo',
            playlist: 'phoenixStream_playlist',
            settings: 'phoenixStream_settings'
        };
        
        this.defaultPlaylist = [
            { 
                videoId: 'dQw4w9WgXcQ', 
                title: 'Rick Astley - Never Gonna Give You Up',
                duration: '3:33',
                addedBy: 'System'
            },
            { 
                videoId: 'fJ9rUzIMcZQ', 
                title: 'Queen - Bohemian Rhapsody',
                duration: '5:55',
                addedBy: 'System'
            },
            { 
                videoId: 'L_jWHffIx5E', 
                title: 'Smash Mouth - All Star',
                duration: '3:21',
                addedBy: 'System'
            }
        ];
        
        this.initializeStorage();
    }

    initializeStorage() {
        // Initialize with default playlist if empty
        if (!localStorage.getItem(this.storageKeys.playlist)) {
            this.savePlaylist(this.defaultPlaylist);
        }
        
        if (!localStorage.getItem(this.storageKeys.settings)) {
            this.saveSettings({
                autoPlay: true,
                shuffle: false,
                volume: 50
            });
        }
    }

    // Current Video Management
    getCurrentVideo() {
        const data = localStorage.getItem(this.storageKeys.currentVideo);
        return data ? JSON.parse(data) : null;
    }

    setCurrentVideo(videoData) {
        if (!videoData) {
            // Clear current video
            localStorage.removeItem(this.storageKeys.currentVideo);
            window.dispatchEvent(new CustomEvent('streamUpdate', { 
                detail: { type: 'currentVideo', data: null } 
            }));
            return null;
        }

        const currentVideo = {
            ...videoData,
            startTime: Date.now()
        };
        localStorage.setItem(this.storageKeys.currentVideo, JSON.stringify(currentVideo));
        
        // Trigger storage event for sync across tabs
        window.dispatchEvent(new CustomEvent('streamUpdate', { 
            detail: { type: 'currentVideo', data: currentVideo } 
        }));
        
        return currentVideo;
    }

    // Playlist Management
    getPlaylist() {
        const data = localStorage.getItem(this.storageKeys.playlist);
        return data ? JSON.parse(data) : [];
    }

    savePlaylist(playlist) {
        localStorage.setItem(this.storageKeys.playlist, JSON.stringify(playlist));
        
        // Trigger storage event
        window.dispatchEvent(new CustomEvent('streamUpdate', { 
            detail: { type: 'playlist', data: playlist } 
        }));
    }

    addToPlaylist(videoData) {
        const playlist = this.getPlaylist();
        playlist.push({
            ...videoData,
            addedAt: Date.now(),
            addedBy: 'Admin'
        });
        this.savePlaylist(playlist);
        return playlist;
    }

    removeFromPlaylist(index) {
        const playlist = this.getPlaylist();
        if (index >= 0 && index < playlist.length) {
            playlist.splice(index, 1);
            this.savePlaylist(playlist);
        }
        return playlist;
    }

    shufflePlaylist() {
        const playlist = this.getPlaylist();
        for (let i = playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
        }
        this.savePlaylist(playlist);
        return playlist;
    }

    // Auto-advance to next video
    getNextVideo() {
        const playlist = this.getPlaylist();
        const currentVideo = this.getCurrentVideo();
        
        if (!playlist.length) return null;
        
        if (!currentVideo) {
            return playlist[0];
        }
        
        // Find current video index
        const currentIndex = playlist.findIndex(video => 
            video.videoId === currentVideo.videoId
        );
        
        // Get next video (or loop to start)
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % playlist.length;
        return playlist[nextIndex];
    }

    playNextVideo() {
        const nextVideo = this.getNextVideo();
        if (nextVideo) {
            return this.setCurrentVideo(nextVideo);
        }
        return null;
    }

    // Settings Management
    getSettings() {
        const data = localStorage.getItem(this.storageKeys.settings);
        return data ? JSON.parse(data) : { autoPlay: true, shuffle: false, volume: 50 };
    }

    saveSettings(settings) {
        localStorage.setItem(this.storageKeys.settings, JSON.stringify(settings));
        
        // Trigger storage event
        window.dispatchEvent(new CustomEvent('streamUpdate', { 
            detail: { type: 'settings', data: settings } 
        }));
    }

    // Utility Methods
    extractVideoId(url) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : url.trim();
    }

    async getVideoInfo(videoId) {
        // For now, return basic info. In a real implementation, you'd call YouTube API
        return {
            videoId: videoId,
            title: `Video ${videoId}`,
            duration: 'Unknown',
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        };
    }

    // Clear all data (admin function)
    clearAllData() {
        localStorage.removeItem(this.storageKeys.currentVideo);
        localStorage.removeItem(this.storageKeys.playlist);
        localStorage.removeItem(this.storageKeys.settings);
        this.initializeStorage();
    }

    // Export data for backup
    exportData() {
        return {
            currentVideo: this.getCurrentVideo(),
            playlist: this.getPlaylist(),
            settings: this.getSettings(),
            exportedAt: Date.now()
        };
    }

    // Import data from backup
    importData(data) {
        if (data.playlist) this.savePlaylist(data.playlist);
        if (data.settings) this.saveSettings(data.settings);
        if (data.currentVideo) this.setCurrentVideo(data.currentVideo);
    }
}

// Initialize global stream manager
window.streamManager = new LocalStreamManager();
