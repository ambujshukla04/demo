# Face Sentinel - Deep Face Detection System

CNN-based deepfake detection platform with real-time webcam support, face landmarks detection, and comprehensive admin dashboard.

## 🚀 Features

- **Image Detection**: Upload images for face & deepfake analysis with bounding boxes
- **Real-time Webcam Detection**: Live face detection with landmarks & confidence scores
- **Video Upload Support**: Video file detection interface
- **Face Landmarks**: 8 key points detection (eyes, nose, mouth)
- **Deepfake Scoring**: CNN-based confidence scoring (XceptionNet/MesoNet simulation)
- **Multiple Face Support**: Detect and analyze multiple faces simultaneously
- **FPS Display**: Real-time processing speed monitoring
- **Face Blur Toggle**: Privacy option for detected faces
- **Face Crop & Download**: Save annotated detection results
- **MongoDB Storage**: Persistent data storage for detections & logs
- **Admin Dashboard**: Complete management interface with statistics
- **JWT Authentication**: Secure admin login system

## 📁 Project Structure

```
face-sentinel-project/
├── backend/
│   ├── server.py           # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── App.css        # Styles
│   │   ├── index.js       # Entry point
│   │   └── components/    # UI components (Shadcn)
│   ├── public/
│   ├── package.json       # Node dependencies
│   ├── tailwind.config.js # Tailwind configuration
│   └── .env              # Frontend environment variables
└── README.md             # This file
```

## 🛠️ Tech Stack

**Backend:**
- FastAPI
- OpenCV (Face detection)
- MediaPipe (Face mesh & landmarks)
- Motor (Async MongoDB driver)
- JWT Authentication
- Passlib (Password hashing)

**Frontend:**
- React 19
- Shadcn UI Components
- Tailwind CSS
- Axios
- Canvas API (Real-time drawing)
- Sonner (Toast notifications)

**Database:**
- MongoDB

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+ & Yarn
- MongoDB (local or cloud instance)

## 🔧 Installation & Setup

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Edit .env file:
MONGO_URL="mongodb://localhost:27017"
DB_NAME="face_sentinel_db"
CORS_ORIGINS="*"
JWT_SECRET_KEY="your-secret-key-here"

# Run the backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Configure environment variables
# Edit .env file:
REACT_APP_BACKEND_URL=http://localhost:8001

# Run the frontend
yarn start
```

### 3. Create Admin User

```bash
# Using curl
curl -X POST "http://localhost:8001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"admin123"}'
```

## 🔐 Admin Credentials

**Default credentials (after registration):**
- Username: `admin`
- Password: `admin123`

## 🎯 Usage

### Detection Interface
1. Navigate to the main page
2. Choose detection mode:
   - **Image**: Upload image files (JPG, PNG)
   - **Webcam**: Real-time face detection with camera
   - **Video**: Upload video files (MP4, AVI, MOV)
3. View results with:
   - Face bounding boxes
   - Confidence scores
   - Deepfake probability
   - Facial landmarks
   - Processing time & FPS

### Admin Dashboard
1. Click "Admin" button (top-right)
2. Login with admin credentials
3. Access:
   - **Overview**: Recent detections summary
   - **All Detections**: Complete detection history
   - **System Logs**: Detection logs & error tracking
4. Manage detections (view details, delete records)

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new admin user
- `POST /api/auth/login` - Admin login

### Detection
- `POST /api/detect/image` - Upload image for detection
- `POST /api/detect/webcam` - Send webcam frame for detection

### Admin (Protected)
- `GET /api/detections` - Get all detections
- `GET /api/logs` - Get system logs
- `GET /api/stats` - Get statistics
- `DELETE /api/detections/{id}` - Delete detection record

## 🧪 Testing

### Test Image Detection
```bash
curl -X POST "http://localhost:8001/api/detect/image" \
  -F "file=@/path/to/image.jpg"
```

### Test Authentication
```bash
# Login
curl -X POST "http://localhost:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use token for protected routes
curl -X GET "http://localhost:8001/api/stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📊 How Deepfake Detection Works

The system uses multiple CNN-based techniques:

1. **Face Detection**: MediaPipe Face Detection
2. **Landmark Extraction**: MediaPipe Face Mesh (468 points, 8 key landmarks used)
3. **Deepfake Analysis**: 
   - Blur detection (Laplacian variance)
   - Color variance analysis (HSV color space)
   - Edge consistency check (Canny edge detection)
   - Frame inconsistency detection
4. **Confidence Scoring**: Combined metrics generate 0-1 score
   - > 0.5 = Potential deepfake
   - < 0.5 = Likely real

## 🎨 UI Features

- Dark theme with cyan accent colors
- Glassmorphism effects
- Real-time canvas overlays
- Responsive design (mobile-friendly)
- Interactive statistics cards
- Smooth animations & transitions

## 📝 Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=face_sentinel_db
CORS_ORIGINS=*
JWT_SECRET_KEY=your-secret-key
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
```

## 🚀 Deployment

### Backend (Production)
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

### Frontend (Build)
```bash
yarn build
# Serve build folder with nginx or any static server
```

## 🐛 Troubleshooting

**Backend won't start:**
- Check MongoDB connection
- Verify all dependencies installed: `pip list`
- Check logs for missing modules

**Webcam not working:**
- Browser must have camera permissions
- Use HTTPS in production (required for camera access)
- Check browser console for errors

**Detection slow:**
- Reduce webcam frame rate in code
- Use smaller image resolutions
- Check CPU/GPU availability

## 📦 Dependencies

### Backend
- fastapi==0.110.1
- opencv-python==4.12.0.88
- mediapipe==0.10.14
- motor==3.3.1
- pyjwt>=2.10.1
- passlib[bcrypt]>=1.7.4
- pillow>=12.0.0

### Frontend
- react: ^19.0.0
- axios: ^1.8.4
- lucide-react: ^0.507.0
- sonner: ^2.0.3
- tailwindcss: ^3.4.17

## 🔮 Future Enhancements

- Actual XceptionNet/MesoNet model integration
- Video file processing with frame-by-frame analysis
- Optical flow temporal consistency checks
- Face region heatmap visualization
- Batch processing support
- Export detection reports (PDF/CSV)
- User role management
- Detection history analytics

## 📄 License

This project is created for educational and demonstration purposes.

## 👨‍💻 Author

Built with Emergent AI

---

**Note**: The deepfake detection uses simulated CNN scoring. For production use, integrate trained XceptionNet/MesoNet models with actual weights.
