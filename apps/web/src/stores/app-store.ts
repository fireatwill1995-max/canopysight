"use client";

import { create } from "zustand";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  location?: string;
  createdAt: string | Date;
  memberCount?: number;
  detectionCount?: number;
}

interface Mission {
  id: string;
  name: string;
  projectId: string;
  drone?: string;
  status: "planned" | "active" | "completed" | "failed";
  startTime?: string | Date;
  endTime?: string | Date;
  detectionCount?: number;
}

interface MapView {
  center: [number, number];
  zoom: number;
}

interface AppState {
  currentProject: Project | null;
  currentMission: Mission | null;
  sidebarOpen: boolean;
  aiChatOpen: boolean;
  mapView: MapView;
  theme: "dark" | "light";

  setProject: (project: Project | null) => void;
  setMission: (mission: Mission | null) => void;
  toggleSidebar: () => void;
  toggleAiChat: () => void;
  setMapView: (view: Partial<MapView>) => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentProject: null,
  currentMission: null,
  sidebarOpen: true,
  aiChatOpen: false,
  mapView: { center: [0, 0], zoom: 13 },
  theme: "dark",

  setProject: (project) => set({ currentProject: project }),
  setMission: (mission) => set({ currentMission: mission }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleAiChat: () => set((s) => ({ aiChatOpen: !s.aiChatOpen })),
  setMapView: (view) =>
    set((s) => ({ mapView: { ...s.mapView, ...view } })),
  setTheme: (theme) => set({ theme }),
}));
