const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: true,
    credentials: true
}));

// Session middleware
app.use(session({
    secret: 'freedom-phoenix-radio-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(__dirname));

// Database setup
const db = new sqlite3.Database('radio_requests.db');

// Initialize database tables
db.serialize(() => {
    // Song requests table
    db.run(`CREATE TABLE IF NOT EXISTS song_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youtube_url TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        song_title TEXT,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        played_at DATETIME NULL
    )`);

    // Admin users table
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create default admin user (username: admin, password: phoenix2025)
    const defaultPassword = bcrypt.hashSync('phoenix2025', 10);
    db.run(`INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES (?, ?)`,
        ['admin', defaultPassword]);
});

// Helper function to extract YouTube video ID
function getYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Helper function to validate YouTube URL
function isValidYouTubeUrl(url) {
    return getYouTubeVideoId(url) !== null;
}

// Helper function to get YouTube video title (simplified)
async function getYouTubeTitle(videoId) {
    // In a real implementation, you'd use YouTube API
    // For now, return a placeholder
    return `YouTube Video ${videoId}`;
}

// Middleware to check admin authentication
function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

// API Routes

// Get all pending song requests
app.get('/api/queue', (req, res) => {
    db.all(
        `SELECT id, youtube_url, requester_name, song_title, requested_at, status 
         FROM song_requests 
         WHERE status = 'pending' 
         ORDER BY requested_at ASC`,
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: 'Database error' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Submit a song request
app.post('/api/request', async (req, res) => {
    const { youtubeUrl, requesterName } = req.body;

    // Validate inputs
    if (!youtubeUrl || !requesterName) {
        return res.status(400).json({ error: 'YouTube URL and name are required' });
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!videoId) {
        return res.status(400).json({ error: 'Could not extract video ID from URL' });
    }

    // Check if this video is already in the queue
    db.get(
        `SELECT id FROM song_requests WHERE youtube_url = ? AND status = 'pending'`,
        [youtubeUrl],
        async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (row) {
                return res.status(400).json({ error: 'This song is already in the queue' });
            }

            // Get song title
            const songTitle = await getYouTubeTitle(videoId);

            // Insert the request
            db.run(
                `INSERT INTO song_requests (youtube_url, requester_name, song_title) VALUES (?, ?, ?)`,
                [youtubeUrl, requesterName.trim(), songTitle],
                function(err) {
                    if (err) {
                        res.status(500).json({ error: 'Failed to add request' });
                    } else {
                        res.json({
                            success: true,
                            message: 'Song request added to queue!',
                            requestId: this.lastID
                        });
                    }
                }
            );
        }
    );
});

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get(
        `SELECT id, username, password_hash FROM admin_users WHERE username = ?`,
        [username],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            req.session.adminId = user.id;
            req.session.username = user.username;
            res.json({ success: true, message: 'Login successful' });
        }
    );
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// Check admin auth status
app.get('/api/admin/status', (req, res) => {
    if (req.session && req.session.adminId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// Get all requests for admin (including played ones)
app.get('/api/admin/requests', requireAuth, (req, res) => {
    db.all(
        `SELECT id, youtube_url, requester_name, song_title, requested_at, status, played_at 
         FROM song_requests 
         ORDER BY 
            CASE status 
                WHEN 'pending' THEN 1 
                WHEN 'played' THEN 2 
                WHEN 'deleted' THEN 3 
            END,
            requested_at ASC`,
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: 'Database error' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Delete a request (admin only)
app.delete('/api/admin/requests/:id', requireAuth, (req, res) => {
    const requestId = req.params.id;

    db.run(
        `UPDATE song_requests SET status = 'deleted' WHERE id = ?`,
        [requestId],
        function(err) {
            if (err) {
                res.status(500).json({ error: 'Database error' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Request not found' });
            } else {
                res.json({ success: true, message: 'Request deleted' });
            }
        }
    );
});

// Mark a request as played (admin only)
app.put('/api/admin/requests/:id/played', requireAuth, (req, res) => {
    const requestId = req.params.id;

    db.run(
        `UPDATE song_requests SET status = 'played', played_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [requestId],
        function(err) {
            if (err) {
                res.status(500).json({ error: 'Database error' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Request not found' });
            } else {
                res.json({ success: true, message: 'Request marked as played' });
            }
        }
    );
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Jungle Radio Request Server running on port ${PORT}`);
    console.log(`🌐 Main site: http://localhost:${PORT}`);
    console.log(`⚙️  Admin panel: http://localhost:${PORT}/admin`);
    console.log(`🔑 Default admin login: username=admin, password=phoenix2025`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('📦 Database connection closed.');
        }
        process.exit(0);
    });
});
