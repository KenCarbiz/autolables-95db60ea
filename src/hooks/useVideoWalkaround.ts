import { useState, useEffect } from "react";

export interface VideoWalkaround {
  id: string;
  vehicleFileId: string;
  vin: string;
  videoUrl: string;         // blob URL (local) or CDN URL (production)
  thumbnailUrl: string;
  duration: number;          // seconds
  recordedBy: string;        // user ID
  recordedAt: string;
  notes: string;
  status: "recording" | "processing" | "ready" | "failed";
}

const STORAGE_KEY = "video_walkarounds";

export const useVideoWalkaround = () => {
  const [videos, setVideos] = useState<VideoWalkaround[]>([]);

  useEffect(() => {
    try { setVideos(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { /* */ }
  }, []);

  const getAll = (): VideoWalkaround[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const persist = (items: VideoWalkaround[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setVideos(items);
  };

  const addVideo = (data: {
    vehicleFileId: string;
    vin: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration?: number;
    recordedBy: string;
    notes?: string;
  }): VideoWalkaround => {
    const video: VideoWalkaround = {
      id: crypto.randomUUID(),
      vehicleFileId: data.vehicleFileId,
      vin: data.vin,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl || "",
      duration: data.duration || 0,
      recordedBy: data.recordedBy,
      recordedAt: new Date().toISOString(),
      notes: data.notes || "",
      status: "ready",
    };
    persist([...getAll(), video]);
    return video;
  };

  const getByVin = (vin: string): VideoWalkaround[] =>
    videos.filter(v => v.vin === vin && v.status === "ready");

  const deleteVideo = (id: string) => {
    persist(getAll().filter(v => v.id !== id));
  };

  return { videos, addVideo, getByVin, deleteVideo };
};
