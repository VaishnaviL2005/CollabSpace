import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { Message, User } from '@/types';
import { fetchWithAuth, WS_BASE_URL } from '@/lib/api';
import { useAuth } from './AuthContext';

export type ConversationType = 'dm' | 'group';

export interface Conversation {
  id: string; // The chat_id string from backend
  type: ConversationType;
  name: string;
  avatar?: string;
  participants: User[];
  messages: Message[];
  unreadCount: number;
  lastMessage?: Message;
}

interface NewUserData {
  id: string;
  username: string;
  avatar: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
}

interface ChatContextType {
  messages: Message[];
  savedMessages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  toggleSaveMessage: (messageId: string) => void;
  typingUsers: string[];
  setTyping: (userId: string, isTyping: boolean) => void;
  otherUser: User | null;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  setActiveConversation: (id: string) => void;
  highlightedMessageId: string | null;
  scrollToMessage: (messageId: string) => void;
  clearHighlight: () => void;
  addNewDMConversation: (user: NewUserData) => void;
  globalPresence: Record<string, string>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children, currentUserId }: { children: ReactNode; currentUserId?: string }) {
  const { user: authUser } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [globalPresence, setGlobalPresence] = useState<Record<string, string>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const presenceWsRef = useRef<WebSocket | null>(null);

  const loadConversations = useCallback(async () => {
    if (!authUser) return;
    try {
      const dbDMs = await fetchWithAuth('/chats/direct') || [];
      const dbGroups = await fetchWithAuth('/chats/groups') || [];

      let allConvs: Conversation[] = [];

      allConvs = allConvs.concat(dbDMs.map((dm: any) => ({
        id: dm.chat_id.toString(),
        type: 'dm',
        name: dm.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.username}`,
        participants: [{
          id: dm.user_id.toString(),
          username: dm.username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.username}`,
          status: 'offline', // Default to offline until presence event fires
        }],
        messages: [],
        unreadCount: 0,
      })));

      allConvs = allConvs.concat(dbGroups.map((grp: any) => ({
        id: grp.chat_id.toString(),
        type: 'group',
        name: grp.name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${grp.name}`,
        participants: [],
        messages: [],
        unreadCount: 0,
      })));

      setConversations(allConvs);
      if (allConvs.length > 0 && !activeConversationId) {
        setActiveConversationId(allConvs[0].id);
      }
    } catch (e) {
      console.error("Failed fetching conversations", e);
    }
  }, [authUser]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessagesForActiveConversation = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await fetchWithAuth(`/messages/${activeConversationId}`);
      if (res && res.messages) {
        const mapped: Message[] = res.messages.map((m: any) => ({
          id: m.id.toString(),
          senderId: m.sender_id.toString(),
          content: m.content || '',
          timestamp: new Date(m.created_at || Date.now()),
          status: 'sent',
          messageType: m.message_type,
          fileUrl: m.file_url,
        })).reverse();
        
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: mapped, lastMessage: mapped[mapped.length - 1] } : c));
      }
    } catch (e) {
      console.error("Failed fetching messages", e);
    }
  }, [activeConversationId]);

  useEffect(() => {
    loadMessagesForActiveConversation();
  }, [loadMessagesForActiveConversation]);

  useEffect(() => {
    if (!authUser) return;

    // Connect Global Presence WebSocket
    const token = localStorage.getItem('collab-token');
    const pWs = new WebSocket(`${WS_BASE_URL}/ws/presence?token=${token}`);
    
    pWs.onopen = () => console.log('Connected to global presence WS');
    
    pWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'global_presence') {
          setGlobalPresence(prev => ({
            ...prev,
            [data.user_id]: data.status
          }));
        } else if (data.type === 'ping') {
          pWs.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {}
    };

    presenceWsRef.current = pWs;

    return () => {
      pWs.close();
    };
  }, [authUser]);

  useEffect(() => {
    if (!activeConversationId || !authUser) return;

    // Connect WebSocket
    const token = localStorage.getItem('collab-token');
    const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/${activeConversationId}?token=${token}`);
    
    ws.onopen = () => {
      console.log('WS Connected to chat', activeConversationId);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        const newMessage: Message = {
          id: data.id.toString(),
          senderId: data.user_id.toString(),
          content: data.message || '',
          timestamp: new Date(data.created_at || Date.now()),
          status: 'delivered',
          messageType: data.message_type,
          fileUrl: data.file_url,
        };

        setConversations(prev => prev.map(c => 
          c.id === data.chat_id?.toString()
            ? { ...c, messages: [...c.messages, newMessage], lastMessage: newMessage }
            : c
        ));
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [activeConversationId, authUser]);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  const messages = activeConversation?.messages || [];
  const savedMessages = conversations.flatMap(c => c.messages.filter(m => m.isSaved));
  
  // Logic for the demoOtherUsers to present the other user's info in DMs
  const otherUser = activeConversation?.type === 'dm' && activeConversation.participants[0] 
    ? activeConversation.participants[0] 
    : null;

  const setActiveConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, unreadCount: 0 } : c
    ));
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const conversation = conversations.find(c => c.messages.some(m => m.id === messageId));
    if (conversation) {
      setActiveConversationId(conversation.id);
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, [conversations]);

  const clearHighlight = useCallback(() => {
    setHighlightedMessageId(null);
  }, []);

  const addMessage = async (messageData: Omit<Message, 'id' | 'timestamp'>) => {
    if (!activeConversationId || !authUser) return;
    
    // First save the message optimistic behavior in UI, then post to API
    const optimisticMsg: Message = {
      ...messageData,
      id: `temp-${Date.now()}`,
      timestamp: new Date(),
      status: 'sending'
    };

    setConversations(prev => prev.map(c => 
      c.id === activeConversationId
        ? { ...c, messages: [...c.messages, optimisticMsg], lastMessage: optimisticMsg }
        : c
    ));

    try {
      await fetchWithAuth('/messages', {
        method: 'POST',
        body: JSON.stringify({
          chat_id: parseInt(activeConversationId),
          content: messageData.content
        })
      });
      // WebSockets will echo it back to us, so the optimistic message might double.
      // Usually you filter duplicates by comparing something or replacing the temp id.
      // For simplicity, we just let the WS do the final update.
    } catch(e) {
      console.error("Failed sending message", e);
    }
  };

  const toggleSaveMessage = (messageId: string) => {
    setConversations(prev => prev.map(c => ({
      ...c,
      messages: c.messages.map(msg => 
        msg.id === messageId ? { ...msg, isSaved: !msg.isSaved } : msg
      )
    })));
  };

  const setTyping = (userId: string, isTyping: boolean) => {
    if (isTyping) {
      setTypingUsers(prev => [...prev.filter(id => id !== userId), userId]);
    } else {
      setTypingUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const addNewDMConversation = useCallback(async (newUser: NewUserData) => {
    // API request to create direct chat
    try {
      const res = await fetchWithAuth('/chats/direct', {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(newUser.id) })
      });
      if (res && res.chat_id) {
        await loadConversations();
        setActiveConversationId(res.chat_id.toString());
      }
    } catch (e) {
      console.error("Failed starting DM", e);
    }
  }, [loadConversations]);

  return (
    <ChatContext.Provider value={{ 
      messages, 
      savedMessages, 
      addMessage, 
      toggleSaveMessage, 
      typingUsers, 
      setTyping,
      otherUser,
      conversations,
      activeConversation,
      setActiveConversation,
      highlightedMessageId,
      scrollToMessage,
      clearHighlight,
      addNewDMConversation,
      globalPresence,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
