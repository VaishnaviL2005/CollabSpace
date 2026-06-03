import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';
import AppSidebar from '@/components/AppSidebar';
import AppHeader from '@/components/AppHeader';
import CallOverlay from '@/components/CallOverlay';

const pageTitles: { [key: string]: string } = {
  '/app': 'Messages',
  '/app/saved': 'Saved Messages',
  '/app/tasks': 'Personal Tasks',
  '/app/meetings': 'Video Meetings',
  '/app/whiteboard': 'Whiteboard',
  '/app/analytics': 'Analytics',
};

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const title = pageTitles[location.pathname] || 'CollabSpace';
  const isChatPage = location.pathname === '/app' || location.pathname === '/app/';

  return (
    <ChatProvider currentUserId={user?.id || ''}>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <AppHeader title={title} />
          <main className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </main>
        </div>
        <CallOverlay />
      </div>
    </ChatProvider>
  );
}
