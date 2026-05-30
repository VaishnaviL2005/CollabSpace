import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  Users,
  MessageSquare,
  Settings,
  Maximize2,
  Circle,
  Hand,
  MoreHorizontal,
  Grid3X3,
} from 'lucide-react';
import { toast } from 'sonner';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isSpeaking: boolean;
  isHost: boolean;
}

const mockParticipants: Participant[] = [
  { id: '1', name: 'Alice Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice', isMuted: false, isVideoOn: true, isSpeaking: true, isHost: true },
  { id: '2', name: 'Bob Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob', isMuted: true, isVideoOn: true, isSpeaking: false, isHost: false },
  { id: '3', name: 'Carol White', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carol', isMuted: false, isVideoOn: false, isSpeaking: false, isHost: false },
  { id: '4', name: 'David Brown', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david', isMuted: true, isVideoOn: true, isSpeaking: false, isHost: false },
];

function ParticipantTile({ participant, isLarge = false }: { participant: Participant; isLarge?: boolean }) {
  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden bg-secondary transition-all duration-300",
      isLarge ? "aspect-video" : "aspect-video",
      participant.isSpeaking && "ring-2 ring-primary ring-offset-2 ring-offset-background"
    )}>
      {participant.isVideoOn ? (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Avatar className={cn(isLarge ? "w-24 h-24" : "w-16 h-16")}>
            <AvatarImage src={participant.avatar} />
            <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      ) : (
        <div className="absolute inset-0 bg-secondary flex items-center justify-center">
          <Avatar className={cn(isLarge ? "w-24 h-24" : "w-16 h-16")}>
            <AvatarImage src={participant.avatar} />
            <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* Name and status */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-foreground/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-primary-foreground text-sm font-medium truncate">
              {participant.name}
            </span>
            {participant.isHost && (
              <Badge variant="secondary" className="text-xs h-5">Host</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {participant.isMuted && (
              <div className="w-6 h-6 rounded-full bg-destructive/80 flex items-center justify-center">
                <MicOff className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Speaking indicator */}
      {participant.isSpeaking && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-primary rounded-full">
          <span className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
          <span className="text-xs text-primary-foreground font-medium">Speaking</span>
        </div>
      )}
    </div>
  );
}

export default function VideoMeeting() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [viewMode, setViewMode] = useState<'speaker' | 'grid'>('speaker');

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
  };

  const handleToggleVideo = () => {
    setIsVideoOn(!isVideoOn);
    toast.info(isVideoOn ? 'Camera off' : 'Camera on');
  };

  const handleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    toast.info(isScreenSharing ? 'Screen sharing stopped' : 'Screen sharing started');
  };

  const handleRecording = () => {
    setIsRecording(!isRecording);
    toast.info(isRecording ? 'Recording stopped' : 'Recording started');
  };

  return (
    <div className="h-full flex flex-col bg-background p-4">
      {/* Meeting header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Team Standup</h2>
          <p className="text-sm text-muted-foreground">
            {mockParticipants.length} participants • 00:45:32
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              <Circle className="w-2 h-2 mr-1 fill-current" />
              Recording
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === 'speaker' ? 'grid' : 'speaker')}
          >
            <Grid3X3 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Maximize2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Video grid */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1">
          {viewMode === 'speaker' ? (
            <div className="h-full flex flex-col gap-4">
              {/* Main speaker */}
              <div className="flex-1">
                <ParticipantTile participant={mockParticipants[0]} isLarge />
              </div>
              
              {/* Other participants */}
              <div className="h-32 flex gap-2 overflow-x-auto pb-2">
                {mockParticipants.slice(1).map(participant => (
                  <div key={participant.id} className="w-48 flex-shrink-0">
                    <ParticipantTile participant={participant} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full grid grid-cols-2 gap-2">
              {mockParticipants.map(participant => (
                <ParticipantTile key={participant.id} participant={participant} />
              ))}
            </div>
          )}
        </div>
        
        {/* Participants panel */}
        {showParticipants && (
          <Card className="w-72 flex-shrink-0 animate-slide-in-right">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Participants ({mockParticipants.length})</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {mockParticipants.map(participant => (
                  <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.avatar} />
                      <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{participant.name}</p>
                      {participant.isHost && (
                        <p className="text-xs text-muted-foreground">Host</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {participant.isMuted ? (
                        <MicOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Mic className="w-4 h-4 text-success" />
                      )}
                      {participant.isVideoOn ? (
                        <Video className="w-4 h-4 text-success" />
                      ) : (
                        <VideoOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Controls bar */}
      <div className="mt-4 flex items-center justify-center">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-card shadow-lg border border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={handleToggleMute}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoOn ? "secondary" : "destructive"}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={handleToggleVideo}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isVideoOn ? 'Turn off camera' : 'Turn on camera'}</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="icon"
                className={cn("rounded-full h-12 w-12", isScreenSharing && "gradient-bg")}
                onClick={handleScreenShare}
              >
                <MonitorUp className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Screen share</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? "destructive" : "secondary"}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={handleRecording}
              >
                <Circle className={cn("w-5 h-5", isRecording && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isRecording ? 'Stop recording' : 'Start recording'}</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-8 bg-border mx-2" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => setShowParticipants(!showParticipants)}
              >
                <Users className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Participants</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full h-12 w-12">
                <MessageSquare className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chat</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full h-12 w-12">
                <Hand className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Raise hand</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-8 bg-border mx-2" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" size="icon" className="rounded-full h-12 w-12">
                <Phone className="w-5 h-5 rotate-[135deg]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leave meeting</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
