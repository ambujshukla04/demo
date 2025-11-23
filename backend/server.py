from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import cv2
import numpy as np
import mediapipe as mp
import base64
from io import BytesIO
from PIL import Image
import json
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'deepfake-detection-secret-key-2024')
ALGORITHM = "HS256"

# MediaPipe setup
mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=10, min_detection_confidence=0.5)

# Define Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    is_admin: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class DetectionResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # 'image', 'webcam', 'video'
    num_faces: int
    faces: List[dict]  # [{bbox, confidence, landmarks, is_deepfake, deepfake_score}]
    processing_time: float
    fps: Optional[float] = None
    image_data: Optional[str] = None  # base64 encoded result image
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[str] = None

class DetectionLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    detection_id: str
    log_type: str  # 'detection_start', 'detection_complete', 'error'
    message: str
    metadata: Optional[dict] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Stats(BaseModel):
    total_detections: int
    total_faces_detected: int
    total_deepfakes_detected: int
    detections_by_type: dict
    recent_detections: List[dict]

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def detect_deepfake(face_image, bbox):
    """Simulate deepfake detection using CNN-based analysis (XceptionNet/MesoNet)"""
    # In production, this would use actual trained models
    # For MVP, we simulate based on image characteristics
    
    height, width = face_image.shape[:2]
    
    # Analyze face region characteristics
    face_region = face_image[int(bbox[1]):int(bbox[3]), int(bbox[0]):int(bbox[2])]
    
    # Calculate various metrics
    blur_score = cv2.Laplacian(face_region, cv2.CV_64F).var()
    
    # Convert to HSV for color analysis
    hsv = cv2.cvtColor(face_region, cv2.COLOR_BGR2HSV)
    color_variance = np.var(hsv)
    
    # Edge detection for frame inconsistencies
    edges = cv2.Canny(face_region, 100, 200)
    edge_density = np.sum(edges) / (face_region.shape[0] * face_region.shape[1])
    
    # Simulate CNN confidence score
    # Lower blur + high color variance + consistent edges = likely real
    # High blur + low color variance + inconsistent edges = potential deepfake
    
    deepfake_score = 0.0
    
    if blur_score < 100:
        deepfake_score += 0.3
    if color_variance < 500:
        deepfake_score += 0.2
    if edge_density < 0.05:
        deepfake_score += 0.2
    
    # Add random variation for realistic simulation
    deepfake_score += np.random.uniform(-0.1, 0.1)
    deepfake_score = max(0.0, min(1.0, deepfake_score))
    
    is_deepfake = deepfake_score > 0.5
    
    return is_deepfake, deepfake_score

def process_image_detection(image_data, draw_landmarks=True):
    """Process image for face detection with landmarks and deepfake analysis"""
    start_time = datetime.now()
    
    # Convert to OpenCV format
    nparr = np.frombuffer(image_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Invalid image data")
    
    height, width, _ = image.shape
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Face detection
    detection_results = face_detection.process(rgb_image)
    
    faces = []
    result_image = image.copy()
    
    if detection_results.detections:
        for detection in detection_results.detections:
            # Get bounding box
            bbox = detection.location_data.relative_bounding_box
            x = int(bbox.xmin * width)
            y = int(bbox.ymin * height)
            w = int(bbox.width * width)
            h = int(bbox.height * height)
            
            abs_bbox = [x, y, x + w, y + h]
            confidence = detection.score[0]
            
            # Deepfake detection
            is_deepfake, deepfake_score = detect_deepfake(image, abs_bbox)
            
            # Draw bounding box
            color = (0, 0, 255) if is_deepfake else (0, 255, 0)
            cv2.rectangle(result_image, (x, y), (x + w, y + h), color, 2)
            
            # Draw confidence and deepfake score
            label = f"Conf: {confidence:.2f} | {'FAKE' if is_deepfake else 'REAL'}: {deepfake_score:.2f}"
            cv2.putText(result_image, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            # Get landmarks
            landmarks = []
            if draw_landmarks:
                face_crop = rgb_image[max(0, y):min(height, y+h), max(0, x):min(width, x+w)]
                if face_crop.size > 0:
                    mesh_results = face_mesh.process(face_crop)
                    if mesh_results.multi_face_landmarks:
                        face_landmarks = mesh_results.multi_face_landmarks[0]
                        # Get key landmarks: eyes, nose, mouth
                        key_indices = [33, 133, 362, 263, 1, 61, 291, 199]  # eyes, nose, mouth corners
                        for idx in key_indices:
                            landmark = face_landmarks.landmark[idx]
                            lx = int(x + landmark.x * w)
                            ly = int(y + landmark.y * h)
                            landmarks.append({"x": lx, "y": ly})
                            cv2.circle(result_image, (lx, ly), 2, (255, 255, 0), -1)
            
            faces.append({
                "bbox": abs_bbox,
                "confidence": float(confidence),
                "is_deepfake": is_deepfake,
                "deepfake_score": float(deepfake_score),
                "landmarks": landmarks
            })
    
    # Convert result image to base64
    _, buffer = cv2.imencode('.jpg', result_image)
    image_base64 = base64.b64encode(buffer).decode('utf-8')
    
    end_time = datetime.now()
    processing_time = (end_time - start_time).total_seconds()
    
    return faces, image_base64, processing_time

# Routes
@api_router.get("/")
async def root():
    return {"message": "Deep Face Detection API", "version": "1.0.0"}

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        is_admin=True
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return {"message": "User created successfully", "user_id": user.id}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user['username']})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "is_admin": user['is_admin']
        }
    }

@api_router.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    """Detect faces in uploaded image"""
    try:
        contents = await file.read()
        
        # Log detection start
        detection_id = str(uuid.uuid4())
        log = DetectionLog(
            detection_id=detection_id,
            log_type="detection_start",
            message=f"Started image detection for {file.filename}"
        )
        log_doc = log.model_dump()
        log_doc['timestamp'] = log_doc['timestamp'].isoformat()
        await db.detection_logs.insert_one(log_doc)
        
        # Process detection
        faces, result_image, processing_time = process_image_detection(contents)
        
        # Save result
        result = DetectionResult(
            id=detection_id,
            type="image",
            num_faces=len(faces),
            faces=faces,
            processing_time=processing_time,
            image_data=result_image
        )
        
        doc = result.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.detection_results.insert_one(doc)
        
        # Log completion
        complete_log = DetectionLog(
            detection_id=detection_id,
            log_type="detection_complete",
            message=f"Completed image detection. Found {len(faces)} faces",
            metadata={"num_faces": len(faces), "processing_time": processing_time}
        )
        complete_log_doc = complete_log.model_dump()
        complete_log_doc['timestamp'] = complete_log_doc['timestamp'].isoformat()
        await db.detection_logs.insert_one(complete_log_doc)
        
        return result
        
    except Exception as e:
        error_log = DetectionLog(
            detection_id=detection_id if 'detection_id' in locals() else str(uuid.uuid4()),
            log_type="error",
            message=f"Error in image detection: {str(e)}"
        )
        error_log_doc = error_log.model_dump()
        error_log_doc['timestamp'] = error_log_doc['timestamp'].isoformat()
        await db.detection_logs.insert_one(error_log_doc)
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/detect/webcam")
async def detect_webcam(data: dict):
    """Detect faces in webcam frame"""
    try:
        # Decode base64 image
        image_data = data.get('image')
        if not image_data:
            raise ValueError("No image data provided")
        
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        
        # Process detection
        faces, result_image, processing_time = process_image_detection(image_bytes, draw_landmarks=True)
        
        fps = 1.0 / processing_time if processing_time > 0 else 0
        
        # Save result (optional for webcam, could be disabled for performance)
        detection_id = str(uuid.uuid4())
        result = DetectionResult(
            id=detection_id,
            type="webcam",
            num_faces=len(faces),
            faces=faces,
            processing_time=processing_time,
            fps=fps,
            image_data=result_image
        )
        
        return {
            "id": detection_id,
            "faces": faces,
            "num_faces": len(faces),
            "processing_time": processing_time,
            "fps": fps,
            "image_data": result_image
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/detections", dependencies=[Depends(get_current_user)])
async def get_detections(skip: int = 0, limit: int = 50):
    """Get all detection results (admin only)"""
    detections = await db.detection_results.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    for detection in detections:
        if isinstance(detection['timestamp'], str):
            detection['timestamp'] = datetime.fromisoformat(detection['timestamp'])
    
    return detections

@api_router.get("/logs", dependencies=[Depends(get_current_user)])
async def get_logs(skip: int = 0, limit: int = 100):
    """Get detection logs (admin only)"""
    logs = await db.detection_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    for log in logs:
        if isinstance(log['timestamp'], str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return logs

@api_router.get("/stats", dependencies=[Depends(get_current_user)])
async def get_stats():
    """Get statistics (admin only)"""
    total_detections = await db.detection_results.count_documents({})
    
    all_detections = await db.detection_results.find({}, {"_id": 0}).to_list(1000)
    
    total_faces = sum(d.get('num_faces', 0) for d in all_detections)
    
    total_deepfakes = 0
    for d in all_detections:
        for face in d.get('faces', []):
            if face.get('is_deepfake'):
                total_deepfakes += 1
    
    detections_by_type = {}
    for d in all_detections:
        dtype = d.get('type', 'unknown')
        detections_by_type[dtype] = detections_by_type.get(dtype, 0) + 1
    
    recent = await db.detection_results.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
    
    return {
        "total_detections": total_detections,
        "total_faces_detected": total_faces,
        "total_deepfakes_detected": total_deepfakes,
        "detections_by_type": detections_by_type,
        "recent_detections": recent
    }

@api_router.delete("/detections/{detection_id}", dependencies=[Depends(get_current_user)])
async def delete_detection(detection_id: str):
    """Delete a detection result (admin only)"""
    result = await db.detection_results.delete_one({"id": detection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Detection not found")
    return {"message": "Detection deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()