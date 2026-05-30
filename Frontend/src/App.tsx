import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import AuthPage from "./pages/AuthPage";
import AppLayout from "./components/AppLayout";
import ChatArea from "./components/ChatArea";
import SavedMessages from "./components/SavedMessages";
import KanbanBoard from "./components/KanbanBoard";
import VideoMeeting from "./components/VideoMeeting";
import Whiteboard from "./components/Whiteboard";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AuthPage />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<ChatArea />} />
                <Route path="saved" element={<SavedMessages />} />
                <Route path="tasks" element={<KanbanBoard />} />
                <Route path="meetings" element={<VideoMeeting />} />
                <Route path="whiteboard" element={<Whiteboard />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
              <Route path="profile" element={<ProfileSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
