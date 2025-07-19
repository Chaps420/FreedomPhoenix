# Jungle Radio Song Request System Setup

## Installation Instructions

### 1. Install Node.js Dependencies
```powershell
npm install
```

### 2. Start the Server
```powershell
npm start
```

### 3. For Development (auto-restart on changes)
```powershell
npm run dev
```

## Access Points

- **Main Website**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin

## Default Admin Login
- **Username**: admin
- **Password**: phoenix2025

## API Endpoints

### Public Endpoints
- `GET /api/queue` - Get current song queue
- `POST /api/request` - Submit a song request

### Admin Endpoints (require authentication)
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/status` - Check auth status
- `GET /api/admin/requests` - Get all requests (including played/deleted)
- `PUT /api/admin/requests/:id/played` - Mark request as played
- `DELETE /api/admin/requests/:id` - Delete a request

## Features

### For Users:
- Submit YouTube song requests with their name
- View current queue (top 10 songs)
- Real-time queue updates every 30 seconds
- YouTube URL validation

### For Admins:
- View all requests (pending, played, deleted)
- Mark songs as played
- Delete inappropriate requests
- Queue statistics
- Secure login system

## Database

The system uses SQLite database (`radio_requests.db`) which is created automatically.

### Tables:
- `song_requests` - Stores all song requests
- `admin_users` - Stores admin user accounts

## Security Features

- Password hashing with bcrypt
- Session-based authentication
- Input validation and sanitization
- SQL injection protection
- XSS protection through HTML escaping

## Customization

### Change Admin Password:
1. Access the admin panel
2. Or modify the default password in `server.js` line 35

### Add YouTube API Integration:
1. Get a YouTube API key
2. Update the `getYouTubeTitle()` function in `server.js`
3. Install: `npm install googleapis`

### Database Backup:
The SQLite database file `radio_requests.db` contains all your data. Back it up regularly.

## Troubleshooting

### Common Issues:

1. **Port already in use**: Change PORT in server.js or set environment variable
2. **Database errors**: Delete `radio_requests.db` to reset (will lose all data)
3. **CORS errors**: Check the CORS configuration in server.js
4. **Session issues**: Clear browser cookies or restart server

### Development Mode:
- Install nodemon: `npm install -g nodemon`
- Run: `nodemon server.js`

## Production Deployment

### Environment Variables:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to 'production'

### Security for Production:
1. Change the session secret in server.js
2. Use HTTPS
3. Set secure cookie options
4. Use environment variables for sensitive data
5. Enable rate limiting

## Support

For issues or questions, refer to the code comments in:
- `server.js` - Backend API
- `script.js` - Frontend JavaScript
- `admin.html` - Admin interface
