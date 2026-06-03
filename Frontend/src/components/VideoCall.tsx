import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { fetchWithAuth } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoCallProps {
  chatId: string;
  onDisconnect: () => void;
}

export default function VideoCall({ chatId, onDisconnect }: VideoCallProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getToken() {
      try {
        const response = await fetchWithAuth(`/chats/${chatId}/livekit-token`);
        setToken(response.token);
        setServerUrl(response.url);
      } catch (e) {
        console.error("Failed to get token", e);
        setError("Failed to join the call.");
      }
    }
    getToken();
  }, [chatId]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-xl border border-border p-8 h-full">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={onDisconnect}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card rounded-xl border border-border h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-xl overflow-hidden border border-border bg-background flex flex-col h-full min-h-[400px]">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        onDisconnected={onDisconnect}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
