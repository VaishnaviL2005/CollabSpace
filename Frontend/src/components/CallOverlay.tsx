import React, { useCallback } from 'react';
import { useChat } from '@/contexts/ChatContext';
import IncomingCallModal from './IncomingCallModal';
import { useNavigate } from 'react-router-dom';

export default function CallOverlay() {
  const { incomingCall, acceptIncomingCall, declineIncomingCall } = useChat();
  const navigate = useNavigate();

  const handleAccept = useCallback(() => {
    navigate('/app');
    acceptIncomingCall();
  }, [acceptIncomingCall, navigate]);

  const handleDecline = useCallback(() => {
    declineIncomingCall();
  }, [declineIncomingCall]);

  if (!incomingCall) return null;

  return (
    <IncomingCallModal 
      callData={incomingCall} 
      onAccept={handleAccept} 
      onDecline={handleDecline} 
    />
  );
}
