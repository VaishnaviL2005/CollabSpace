import React, { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
interface IncomingCallModalProps {
  callData: any;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({ callData, onAccept, onDecline }: IncomingCallModalProps) {
  useEffect(() => {
    const audio = new Audio('/ringtone.mp3');
    let beepInterval: ReturnType<typeof setInterval> | undefined;
    let audioContext: AudioContext | undefined;

    const playFallbackBeep = () => {
      if (beepInterval) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      audioContext = new AudioContextClass();
      const beep = () => {
        const oscillator = audioContext?.createOscillator();
        const gain = audioContext?.createGain();
        if (!oscillator || !gain || !audioContext) return;

        oscillator.frequency.value = 880;
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.18);
      };

      beep();
      beepInterval = setInterval(beep, 1500);
    };

    audio.loop = true;
    audio.play().catch(e => {
      console.warn("Incoming call ringtone could not autoplay", e);
      playFallbackBeep();
    });

    const timer = setTimeout(() => {
      onDecline();
    }, 30000);
    
    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (beepInterval) clearInterval(beepInterval);
      audioContext?.close();
      clearTimeout(timer);
    };
  }, [onDecline]);

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-[min(calc(100vw-2rem),22rem)] animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="rounded-lg border bg-card p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12 border-2 border-background shadow-lg">
              <AvatarImage src={callData.caller_avatar} />
              <AvatarFallback>{callData.caller_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background animate-ping opacity-20" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {callData.caller_name}
            </h2>
            <p className="text-xs text-muted-foreground">
              Incoming video call
            </p>
            {callData.is_group && (
              <p className="truncate text-xs text-muted-foreground/80">
                in {callData.chat_name}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-9 w-9 rounded-full p-0"
            onClick={onDecline}
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="h-9 w-9 rounded-full bg-green-500 p-0 hover:bg-green-600"
            onClick={onAccept}
          >
            <Phone className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </div>
    </div>
  );
}
