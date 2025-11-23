# Face Sentinel - Quick Setup Guide

## 🚀 5-Minute Setup

### Step 1: MongoDB Setup

**Option A: Local MongoDB**
```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt-get install mongodb

# Start MongoDB service
sudo systemctl start mongodb
```

**Option B: MongoDB Atlas (Cloud - Free)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up and create free cluster
3. Get connection string
4. Update backend/.env with your connection string

### Step 2: Backend Setup (Terminal 1)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Start backend server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Backend will start at:** http://localhost:8001

### Step 3: Frontend Setup (Terminal 2)

```bash
cd frontend

# Install dependencies
yarn install

# Start frontend
yarn start
```

**Frontend will open at:** http://localhost:3000

### Step 4: Create Admin User

Open a new terminal:

```bash
curl -X POST "http://localhost:8001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"admin123"}'
```

### Step 5: Test the Application

1. Open browser: http://localhost:3000
2. Click "Detection" to test face detection
3. Click "Admin" and login with:
   - Username: `admin`
   - Password: `admin123`

## ✅ Verification Checklist

- [ ] MongoDB running
- [ ] Backend server running on port 8001
- [ ] Frontend running on port 3000
- [ ] Admin user created
- [ ] Can access http://localhost:3000
- [ ] Can login to admin panel

## 🐛 Common Issues

### Issue: "Module not found: cv2"
**Solution:**
```bash
pip install opencv-python
```

### Issue: "Cannot connect to MongoDB"
**Solution:**
- Check MongoDB is running: `sudo systemctl status mongodb`
- Verify MONGO_URL in backend/.env

### Issue: "Webcam not working"
**Solution:**
- Use HTTPS in production (HTTP works on localhost)
- Check browser camera permissions
- Try different browser (Chrome recommended)

### Issue: "Port already in use"
**Solution:**
```bash
# Kill process on port 8001
lsof -ti:8001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## 📝 Environment Configuration

### backend/.env
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=face_sentinel_db
CORS_ORIGINS=*
JWT_SECRET_KEY=your-super-secret-key-change-this
```

### frontend/.env
```env
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
```

## 🎯 Next Steps

1. **Test Image Detection:**
   - Upload a photo with faces
   - Check detection results

2. **Test Webcam Detection:**
   - Click "Webcam" tab
   - Allow camera permissions
   - Watch real-time detection

3. **Explore Admin Dashboard:**
   - View detection statistics
   - Browse detection logs
   - Manage detection records

## 🔧 Development Tips

**Backend Hot Reload:**
- Backend auto-reloads on file changes
- No need to restart after code edits

**Frontend Hot Reload:**
- Frontend auto-reloads on file changes
- Changes reflect immediately in browser

**Debugging:**
- Backend logs: Check terminal running uvicorn
- Frontend logs: Check browser console (F12)
- API testing: Use curl or Postman

## 📚 Additional Resources

- FastAPI Docs: http://localhost:8001/docs (Interactive API docs)
- MongoDB Compass: GUI tool for MongoDB
- React DevTools: Browser extension for React debugging

---

Need help? Check README.md for detailed documentation.
