import { useState, useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { Camera, Upload, Video, Shield, Activity, Database, LogOut, Eye, EyeOff } from "lucide-react";
import { Switch } from "./components/ui/switch";
import { Progress } from "./components/ui/progress";
import { ScrollArea } from "./components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DetectionInterface = () => {
  const [activeTab, setActiveTab] = useState("image");
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [faceBlur, setFaceBlur] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setWebcamActive(true);
        processWebcamFrame();
      }
    } catch (error) {
      toast.error("Could not access webcam");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setWebcamActive(false);
    setResult(null);
  };

  const processWebcamFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !webcamActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    // Capture frame and send to backend
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = reader.result;
          const response = await axios.post(`${API}/detect/webcam`, {
            image: base64data
          });

          setResult(response.data);

          // Draw results on canvas
          drawDetectionResults(ctx, response.data);
        } catch (error) {
          console.error("Detection error:", error);
        }
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.8);

    if (webcamActive) {
      animationRef.current = setTimeout(() => processWebcamFrame(), 200);
    }
  };

  const drawDetectionResults = (ctx, data) => {
    if (!data || !data.faces) return;

    data.faces.forEach(face => {
      const [x, y, x2, y2] = face.bbox;
      const color = face.is_deepfake ? '#ef4444' : '#22c55e';

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, x2 - x, y2 - y);

      // Draw label background
      const label = `${face.is_deepfake ? 'FAKE' : 'REAL'}: ${(face.deepfake_score * 100).toFixed(1)}%`;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 30, 200, 30);

      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter';
      ctx.fillText(label, x + 5, y - 8);

      // Draw landmarks
      if (face.landmarks) {
        face.landmarks.forEach(landmark => {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(landmark.x, landmark.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      }

      // Apply blur if enabled
      if (faceBlur) {
        ctx.filter = 'blur(20px)';
        ctx.drawImage(ctx.canvas, x, y, x2 - x, y2 - y, x, y, x2 - x, y2 - y);
        ctx.filter = 'none';
      }
    });

    // Display FPS and face count
    if (data.fps) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 200, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Inter';
      ctx.fillText(`FPS: ${data.fps.toFixed(1)}`, 20, 30);
      ctx.fillText(`Faces: ${data.num_faces}`, 20, 55);
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  useEffect(() => {
    if (webcamActive) {
      processWebcamFrame();
    }
  }, [faceBlur]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setDetecting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/detect/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
      toast.success(`Detected ${response.data.num_faces} face(s)`);
    } catch (error) {
      toast.error("Detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    toast.info("Video processing coming soon - use webcam for real-time detection");
  };

  const downloadFaceCrop = () => {
    if (!result || !result.image_data) return;
    
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${result.image_data}`;
    link.download = `detection_${Date.now()}.jpg`;
    link.click();
    toast.success("Image downloaded");
  };

  return (
    <div className="min-h-screen p-6">
      <Toaster />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-cyan-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Face Sentinel
            </h1>
          </div>
          <p className="text-lg text-slate-300">Deep Face Detection Using CNN - XceptionNet & MesoNet</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm" data-testid="detection-interface-card">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Detection Interface</CardTitle>
            <CardDescription className="text-slate-400">Choose detection mode and analyze faces for deepfake indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                <TabsTrigger value="image" className="data-[state=active]:bg-cyan-500" data-testid="tab-image">
                  <Upload className="w-4 h-4 mr-2" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="webcam" className="data-[state=active]:bg-cyan-500" data-testid="tab-webcam">
                  <Camera className="w-4 h-4 mr-2" />
                  Webcam
                </TabsTrigger>
                <TabsTrigger value="video" className="data-[state=active]:bg-cyan-500" data-testid="tab-video">
                  <Video className="w-4 h-4 mr-2" />
                  Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="space-y-4" data-testid="image-upload-content">
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center hover:border-cyan-400 transition-colors">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    data-testid="image-upload-input"
                  />
                  <Label htmlFor="image-upload" className="cursor-pointer" data-testid="image-upload-label">
                    <Upload className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
                    <p className="text-lg text-white mb-2">Click to upload image</p>
                    <p className="text-sm text-slate-400">Support for JPG, PNG formats</p>
                  </Label>
                </div>
                {detecting && <Progress value={50} className="w-full" data-testid="detection-progress" />}
              </TabsContent>

              <TabsContent value="webcam" className="space-y-4" data-testid="webcam-content">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button 
                      onClick={webcamActive ? stopWebcam : startWebcam}
                      className={webcamActive ? "bg-red-500 hover:bg-red-600" : "bg-cyan-500 hover:bg-cyan-600"}
                      data-testid="webcam-toggle-button"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {webcamActive ? "Stop Webcam" : "Start Webcam"}
                    </Button>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={faceBlur} 
                          onCheckedChange={setFaceBlur}
                          disabled={!webcamActive}
                          data-testid="face-blur-switch"
                        />
                        <Label className="text-white">Face Blur</Label>
                        {faceBlur ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4 text-cyan-400" />}
                      </div>
                    </div>
                  </div>
                  <div className="relative bg-slate-800 rounded-lg overflow-hidden" style={{ minHeight: '480px' }}>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline
                      className="w-full h-auto"
                      style={{ display: webcamActive ? 'block' : 'none' }}
                      data-testid="webcam-video"
                    />
                    <canvas 
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                      style={{ display: webcamActive ? 'block' : 'none' }}
                      data-testid="webcam-canvas"
                    />
                    {!webcamActive && (
                      <div className="flex items-center justify-center h-96" data-testid="webcam-placeholder">
                        <p className="text-slate-400">Webcam feed will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="video" className="space-y-4" data-testid="video-upload-content">
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center hover:border-cyan-400 transition-colors">
                  <Input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                    data-testid="video-upload-input"
                  />
                  <Label htmlFor="video-upload" className="cursor-pointer" data-testid="video-upload-label">
                    <Video className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
                    <p className="text-lg text-white mb-2">Click to upload video</p>
                    <p className="text-sm text-slate-400">Support for MP4, AVI, MOV formats</p>
                  </Label>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {result && activeTab === "image" && (
          <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm" data-testid="detection-result-card">
            <CardHeader>
              <CardTitle className="text-white">Detection Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-800 rounded-lg" data-testid="result-faces-detected">
                  <p className="text-sm text-slate-400">Faces Detected</p>
                  <p className="text-2xl font-bold text-white">{result.num_faces}</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg" data-testid="result-processing-time">
                  <p className="text-sm text-slate-400">Processing Time</p>
                  <p className="text-2xl font-bold text-white">{result.processing_time?.toFixed(2)}s</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg" data-testid="result-deepfakes">
                  <p className="text-sm text-slate-400">Deepfakes Found</p>
                  <p className="text-2xl font-bold text-red-400">
                    {result.faces?.filter(f => f.is_deepfake).length || 0}
                  </p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg" data-testid="result-real-faces">
                  <p className="text-sm text-slate-400">Real Faces</p>
                  <p className="text-2xl font-bold text-green-400">
                    {result.faces?.filter(f => !f.is_deepfake).length || 0}
                  </p>
                </div>
              </div>

              {result.image_data && (
                <div className="space-y-4">
                  <img 
                    src={`data:image/jpeg;base64,${result.image_data}`} 
                    alt="Detection result"
                    className="w-full rounded-lg border-2 border-slate-700"
                    data-testid="result-image"
                  />
                  <Button onClick={downloadFaceCrop} className="w-full bg-cyan-500 hover:bg-cyan-600" data-testid="download-result-button">
                    Download Result Image
                  </Button>
                </div>
              )}

              {result.faces && result.faces.length > 0 && (
                <div className="space-y-3" data-testid="face-details-list">
                  <h3 className="text-lg font-semibold text-white">Face Details</h3>
                  {result.faces.map((face, idx) => (
                    <Card key={idx} className="bg-slate-800 border-slate-700" data-testid={`face-detail-${idx}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">Face {idx + 1}</span>
                          <Badge variant={face.is_deepfake ? "destructive" : "default"} className={face.is_deepfake ? "bg-red-500" : "bg-green-500"} data-testid={`face-badge-${idx}`}>
                            {face.is_deepfake ? "DEEPFAKE" : "REAL"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm text-slate-400">Confidence Score</p>
                            <Progress value={face.confidence * 100} className="mt-1" data-testid={`face-confidence-${idx}`} />
                            <p className="text-xs text-slate-300 mt-1">{(face.confidence * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Deepfake Score</p>
                            <Progress value={face.deepfake_score * 100} className="mt-1" data-testid={`face-deepfake-score-${idx}`} />
                            <p className="text-xs text-slate-300 mt-1">{(face.deepfake_score * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Landmarks Detected: {face.landmarks?.length || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ onLogout }) => {
  const [stats, setStats] = useState(null);
  const [detections, setDetections] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeView, setActiveView] = useState("overview");
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchDetections();
    fetchLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      toast.error("Failed to fetch statistics");
    }
  };

  const fetchDetections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/detections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetections(response.data);
    } catch (error) {
      toast.error("Failed to fetch detections");
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
    } catch (error) {
      toast.error("Failed to fetch logs");
    }
  };

  const handleDeleteDetection = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/detections/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Detection deleted");
      fetchDetections();
      fetchStats();
    } catch (error) {
      toast.error("Failed to delete detection");
    }
  };

  const viewDetectionDetails = (detection) => {
    setSelectedDetection(detection);
    setShowDetailDialog(true);
  };

  return (
    <div className="min-h-screen p-6">
      <Toaster />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-10 h-10 text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400">Monitor and manage detection system</p>
            </div>
          </div>
          <Button onClick={onLogout} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white" data-testid="admin-logout-button">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50" data-testid="stat-total-detections">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Total Detections</p>
                  <p className="text-3xl font-bold text-white">{stats?.total_detections || 0}</p>
                </div>
                <Database className="w-12 h-12 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50" data-testid="stat-faces-detected">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Faces Detected</p>
                  <p className="text-3xl font-bold text-white">{stats?.total_faces_detected || 0}</p>
                </div>
                <Activity className="w-12 h-12 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/20 to-pink-500/20 border-red-500/50" data-testid="stat-deepfakes-detected">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Deepfakes Found</p>
                  <p className="text-3xl font-bold text-white">{stats?.total_deepfakes_detected || 0}</p>
                </div>
                <Shield className="w-12 h-12 text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/50" data-testid="stat-detection-types">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-slate-300 mb-2">By Type</p>
                <div className="space-y-1">
                  {stats?.detections_by_type && Object.entries(stats.detections_by_type).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="text-slate-400 capitalize">{type}:</span>
                      <span className="text-white font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/50 border-slate-700" data-testid="admin-main-card">
          <CardHeader>
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="overview" data-testid="admin-tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="detections" data-testid="admin-tab-detections">All Detections</TabsTrigger>
                <TabsTrigger value="logs" data-testid="admin-tab-logs">System Logs</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {activeView === "overview" && (
              <div className="space-y-4" data-testid="overview-content">
                <h3 className="text-lg font-semibold text-white">Recent Detections</h3>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {stats?.recent_detections?.map((detection, idx) => (
                      <Card key={idx} className="bg-slate-800 border-slate-700" data-testid={`recent-detection-${idx}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{detection.type.toUpperCase()} Detection</p>
                              <p className="text-sm text-slate-400">Faces: {detection.num_faces} | Time: {detection.processing_time?.toFixed(2)}s</p>
                            </div>
                            <Badge variant={detection.faces?.some(f => f.is_deepfake) ? "destructive" : "default"}>
                              {detection.faces?.some(f => f.is_deepfake) ? "Deepfake Found" : "All Real"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {activeView === "detections" && (
              <div className="space-y-4" data-testid="detections-content">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">All Detection Records</h3>
                  <Button onClick={fetchDetections} variant="outline" size="sm" data-testid="refresh-detections-button">
                    Refresh
                  </Button>
                </div>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {detections.map((detection, idx) => (
                      <Card key={idx} className="bg-slate-800 border-slate-700 hover:border-cyan-500 transition-colors" data-testid={`detection-item-${idx}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge className="bg-cyan-500">{detection.type}</Badge>
                                <span className="text-sm text-slate-400">{new Date(detection.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-slate-400">Faces:</p>
                                  <p className="text-white font-semibold">{detection.num_faces}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Processing:</p>
                                  <p className="text-white font-semibold">{detection.processing_time?.toFixed(2)}s</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Deepfakes:</p>
                                  <p className="text-red-400 font-semibold">{detection.faces?.filter(f => f.is_deepfake).length || 0}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Real:</p>
                                  <p className="text-green-400 font-semibold">{detection.faces?.filter(f => !f.is_deepfake).length || 0}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => viewDetectionDetails(detection)} data-testid={`view-detail-button-${idx}`}>
                                View
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteDetection(detection.id)} data-testid={`delete-detection-button-${idx}`}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {activeView === "logs" && (
              <div className="space-y-4" data-testid="logs-content">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">System Logs</h3>
                  <Button onClick={fetchLogs} variant="outline" size="sm" data-testid="refresh-logs-button">
                    Refresh
                  </Button>
                </div>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {logs.map((log, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded border border-slate-700 text-sm" data-testid={`log-item-${idx}`}>
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant={log.log_type === 'error' ? 'destructive' : 'default'} className="text-xs">
                            {log.log_type}
                          </Badge>
                          <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-300">{log.message}</p>
                        {log.metadata && (
                          <pre className="text-xs text-slate-400 mt-2 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl bg-slate-900 border-slate-700 max-h-[80vh] overflow-y-auto" data-testid="detection-detail-dialog">
          <DialogHeader>
            <DialogTitle className="text-white">Detection Details</DialogTitle>
            <DialogDescription className="text-slate-400">Complete information about this detection</DialogDescription>
          </DialogHeader>
          {selectedDetection && (
            <div className="space-y-4">
              {selectedDetection.image_data && (
                <img src={`data:image/jpeg;base64,${selectedDetection.image_data}`} alt="Detection" className="w-full rounded-lg" data-testid="detail-image" />
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800 rounded">
                  <p className="text-sm text-slate-400">Type</p>
                  <p className="text-white font-semibold">{selectedDetection.type}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded">
                  <p className="text-sm text-slate-400">Timestamp</p>
                  <p className="text-white font-semibold">{new Date(selectedDetection.timestamp).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded">
                  <p className="text-sm text-slate-400">Faces Detected</p>
                  <p className="text-white font-semibold">{selectedDetection.num_faces}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded">
                  <p className="text-sm text-slate-400">Processing Time</p>
                  <p className="text-white font-semibold">{selectedDetection.processing_time?.toFixed(3)}s</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-white font-semibold">Face Analysis</h4>
                {selectedDetection.faces?.map((face, idx) => (
                  <Card key={idx} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium">Face {idx + 1}</span>
                        <Badge variant={face.is_deepfake ? "destructive" : "default"}>
                          {face.is_deepfake ? "DEEPFAKE" : "REAL"}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-slate-400">Detection Confidence: {(face.confidence * 100).toFixed(1)}%</p>
                          <Progress value={face.confidence * 100} className="mt-1" />
                        </div>
                        <div>
                          <p className="text-slate-400">Deepfake Score: {(face.deepfake_score * 100).toFixed(1)}%</p>
                          <Progress value={face.deepfake_score * 100} className="mt-1" />
                        </div>
                        <div>
                          <p className="text-slate-400">Bounding Box: [{face.bbox.join(', ')}]</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Landmarks: {face.landmarks?.length || 0} points detected</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success("Login successful");
      onLogin(response.data.user);
    } catch (error) {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Toaster />
      <Card className="w-full max-w-md bg-slate-900/90 border-slate-700 backdrop-blur-sm" data-testid="login-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-cyan-400" />
          </div>
          <CardTitle className="text-3xl text-white">Admin Login</CardTitle>
          <CardDescription className="text-slate-400">Access the detection management dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">Username</Label>
              <Input 
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="bg-slate-800 border-slate-600 text-white"
                data-testid="login-username-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input 
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="bg-slate-800 border-slate-600 text-white"
                data-testid="login-password-input"
              />
            </div>
            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600" disabled={loading} data-testid="login-submit-button">
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="mt-4 p-3 bg-slate-800 rounded text-sm text-slate-300">
            <p className="font-semibold mb-2">Demo Credentials:</p>
            <p>Username: <code className="text-cyan-400">admin</code></p>
            <p>Password: <code className="text-cyan-400">admin123</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState("detection");

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView("detection");
    toast.success("Logged out successfully");
  };

  return (
    <div className="App min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <BrowserRouter>
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <Button 
            onClick={() => setCurrentView("detection")} 
            variant={currentView === "detection" ? "default" : "outline"}
            className={currentView === "detection" ? "bg-cyan-500 hover:bg-cyan-600" : "border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white"}
            data-testid="nav-detection-button"
          >
            <Camera className="w-4 h-4 mr-2" />
            Detection
          </Button>
          <Button 
            onClick={() => setCurrentView("admin")} 
            variant={currentView === "admin" ? "default" : "outline"}
            className={currentView === "admin" ? "bg-cyan-500 hover:bg-cyan-600" : "border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white"}
            data-testid="nav-admin-button"
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin
          </Button>
        </div>
        
        <Routes>
          <Route path="/" element={
            currentView === "admin" ? (
              user ? <AdminPanel onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />
            ) : (
              <DetectionInterface />
            )
          } />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;