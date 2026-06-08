import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { Message, User, MessageStatus } from '@/types';
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
  avatar?: string;
  status?: 'online' | 'away' | 'dnd' | 'offline';
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
  addNewDMConversation: (user: NewUserData) => Promise<boolean>;
  createGroupConversation: (name: string, memberIds: string[]) => Promise<boolean>;
  addGroupMembers: (chatId: string, memberIds: string[]) => Promise<boolean>;
  globalPresence: Record<string, string>;
  sendTypingEvent: () => void;
  sendReadReceipt: (messageId: string) => void;
  incomingCall: any;
  setIncomingCall: (call: any) => void;
  activeVideoCallChatId: string | null;
  startVideoCall: (chatId: string) => Promise<boolean>;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => Promise<void>;
  endVideoCall: (chatId?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children, currentUserId }: { children: ReactNode; currentUserId?: string }) {
  const { user: authUser } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [globalPresence, setGlobalPresence] = useState<Record<string, string>>({});
  const [conversationRevision, setConversationRevision] = useState(0);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeVideoCallChatId, setActiveVideoCallChatId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const presenceWsRef = useRef<WebSocket | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingReadReceipts = useRef<Set<string>>(new Set());

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

      setConversations(prev => allConvs.map(conversation => {
        const existingConversation = prev.find(existing => existing.id === conversation.id);
        return existingConversation
          ? {
              ...conversation,
              participants: conversation.participants.length > 0
                ? conversation.participants.map(participant => {
                    const existingParticipant = existingConversation.participants.find(
                      existing => existing.id === participant.id
                    );
                    return existingParticipant
                      ? { ...participant, status: existingParticipant.status }
                      : participant;
                  })
                : existingConversation.participants,
              messages: existingConversation.messages,
              unreadCount: existingConversation.unreadCount,
              lastMessage: existingConversation.lastMessage,
            }
          : conversation;
      }));
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
        }));
        
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: mapped, lastMessage: mapped[mapped.length - 1] } : c));
      }
    } catch (e) {
      console.error("Failed fetching messages", e);
    }
  }, [activeConversationId, conversationRevision]);

  useEffect(() => {
    loadMessagesForActiveConversation();
  }, [loadMessagesForActiveConversation]);

  useEffect(() => {
    const conversation = conversations.find(item => item.id === activeConversationId);
    if (!conversation || conversation.type !== 'group') return;

    let cancelled = false;
    const loadGroupMembers = async () => {
      try {
        const members = await fetchWithAuth(`/chats/group/${conversation.id}/members`) || [];
        if (cancelled) return;

        const participants: User[] = members.map((member: any) => ({
          id: member.id.toString(),
          username: member.username,
          displayName: member.username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`,
          status: (globalPresence[member.id.toString()] || 'offline') as User['status'],
        }));

        setConversations(prev => prev.map(item =>
          item.id === conversation.id ? { ...item, participants } : item
        ));
      } catch (error) {
        console.error('Failed loading group members', error);
      }
    };

    loadGroupMembers();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!authUser) return;

    const token = localStorage.getItem('collab-token');
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      const pWs = new WebSocket(`${WS_BASE_URL}/ws/presence?token=${token}`);
      presenceWsRef.current = pWs;

      pWs.onopen = () => console.log('Connected to global presence WS');

      pWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'global_presence') {
            setGlobalPresence(prev => ({
              ...prev,
              [data.user_id]: data.status
            }));
            setConversations(prev => prev.map(conversation => ({
              ...conversation,
              participants: conversation.participants.map(participant =>
                participant.id === data.user_id
                  ? { ...participant, status: data.status }
                  : participant
              )
            })));
          } else if (
            data.type === 'conversations_changed' &&
            data.user_ids?.includes(authUser.id)
          ) {
            setConversationRevision(prev => prev + 1);
            loadConversations();
          } else if (
            data.type === 'incoming_call' &&
            data.caller_id?.toString() !== authUser.id.toString() &&
            data.target_user_ids?.map((id: unknown) => id?.toString()).includes(authUser.id.toString())
          ) {
            setIncomingCall(data);
          } else if (
            (data.type === 'call_ended' || data.type === 'call_declined') &&
            data.target_user_ids?.map((id: unknown) => id?.toString()).includes(authUser.id.toString())
          ) {
            const chatId = data.chat_id?.toString();
            setIncomingCall(prev => prev?.chat_id?.toString() === chatId ? null : prev);
            setActiveVideoCallChatId(prev => prev === chatId ? null : prev);
          } else if (data.type === 'ping') {
            pWs.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (e) {}
      };

      pWs.onclose = () => {
        if (!disposed) reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      presenceWsRef.current?.close();
    };
  }, [authUser, loadConversations]);

  useEffect(() => {
    if (!activeConversationId || !authUser) return;

    const token = localStorage.getItem('collab-token');
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/${activeConversationId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WS Connected to chat', activeConversationId);
        pendingReadReceipts.current.forEach(msgId => {
          ws.send(JSON.stringify({ type: 'read_receipt', message_id: parseInt(msgId) }));
        });
        pendingReadReceipts.current.clear();
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

          setConversations(prev => prev.map(c => {
            if (c.id !== data.chat_id?.toString()) return c;

            const optimisticIndex = data.client_id
              ? c.messages.findIndex(message => message.id === data.client_id)
              : -1;
            const alreadyExists = c.messages.some(message => message.id === newMessage.id);

            if (optimisticIndex >= 0) {
              const nextMessages = [...c.messages];
              nextMessages[optimisticIndex] = newMessage;
              return { ...c, messages: nextMessages, lastMessage: newMessage };
            }

            if (alreadyExists) {
               const nextMessages = c.messages.map(m => 
                 m.id === newMessage.id && m.status === 'sent' 
                   ? { ...m, status: 'delivered' as MessageStatus } 
                   : m
               );
               return { ...c, messages: nextMessages };
            }

            return {
              ...c,
              messages: [...c.messages, newMessage],
              lastMessage: newMessage,
              unreadCount: c.id === activeConversationId ? 0 : c.unreadCount + 1,
            };
          }));
        } else if (data.type === 'typing') {
          if (data.user_id.toString() !== authUser.id) {
            // Need to handle typing state via setTyping which is defined below. 
            // We can just update the typingUsers state directly here.
            setTypingUsers(prev => {
              const userId = data.user_id.toString();
              const filtered = prev.filter(id => id !== userId);
              
              if (typingTimeoutsRef.current[userId]) {
                clearTimeout(typingTimeoutsRef.current[userId]);
              }
              typingTimeoutsRef.current[userId] = setTimeout(() => {
                setTypingUsers(current => current.filter(id => id !== userId));
              }, 3000);
              
              return [...filtered, userId];
            });
          }
        } else if (data.type === 'read_receipt') {
          setConversations(prev => prev.map(c => {
            if (c.id !== data.chat_id?.toString()) return c;
            
            if (data.user_id.toString() !== authUser.id) {
              const readMessageId = parseInt(data.message_id);
              if (isNaN(readMessageId)) return c;
              
              const updatedMessages = c.messages.map(msg => {
                const msgId = parseInt(msg.id);
                if (msg.senderId === authUser.id && !isNaN(msgId) && msgId <= readMessageId && msg.status !== 'read') {
                  return { ...msg, status: 'read' as MessageStatus };
                }
                return msg;
              });
              
              return { ...c, messages: updatedMessages };
            }
            return c;
          }));
        } else if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      };

      ws.onclose = () => {
        if (!disposed) reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
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
    
    const clientId = `temp-${crypto.randomUUID()}`;
    const optimisticMsg: Message = {
      ...messageData,
      id: clientId,
      timestamp: new Date(),
      status: 'sending'
    };

    setConversations(prev => prev.map(c => 
      c.id === activeConversationId
        ? { ...c, messages: [...c.messages, optimisticMsg], lastMessage: optimisticMsg }
        : c
    ));

    try {
      const savedMessage = await fetchWithAuth('/messages', {
        method: 'POST',
        body: JSON.stringify({
          chat_id: parseInt(activeConversationId),
          client_id: clientId,
          content: messageData.content,
        }),
      });

      if (savedMessage) {
        const persistedMessage: Message = {
          id: savedMessage.id.toString(),
          senderId: savedMessage.sender_id.toString(),
          content: savedMessage.content || '',
          timestamp: new Date(savedMessage.created_at || Date.now()),
          status: 'sent',
          messageType: savedMessage.message_type,
          fileUrl: savedMessage.file_url,
        };

        setConversations(prev => prev.map(c => {
          if (c.id !== activeConversationId) return c;

          const optimisticIndex = c.messages.findIndex(message => message.id === clientId);
          if (optimisticIndex < 0) return c;

          const nextMessages = [...c.messages];
          nextMessages[optimisticIndex] = persistedMessage;
          return { ...c, messages: nextMessages, lastMessage: persistedMessage };
        }));
      }
    } catch (error) {
      console.error('Failed sending message', error);
      setConversations(prev => prev.map(c => ({
        ...c,
        messages: c.messages.filter(message => message.id !== clientId),
      })));
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

  const setTyping = useCallback((userId: string, isTyping: boolean) => {
    if (isTyping) {
      setTypingUsers(prev => {
        const filtered = prev.filter(id => id !== userId);
        if (typingTimeoutsRef.current[userId]) {
          clearTimeout(typingTimeoutsRef.current[userId]);
        }
        typingTimeoutsRef.current[userId] = setTimeout(() => {
          setTypingUsers(current => current.filter(id => id !== userId));
        }, 3000);
        return [...filtered, userId];
      });
    } else {
      setTypingUsers(prev => prev.filter(id => id !== userId));
      if (typingTimeoutsRef.current[userId]) {
        clearTimeout(typingTimeoutsRef.current[userId]);
      }
    }
  }, []);

  const sendTypingEvent = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, []);

  const sendReadReceipt = useCallback((messageId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'read_receipt', message_id: parseInt(messageId) }));
    } else {
      pendingReadReceipts.current.add(messageId);
    }
  }, []);

  const startVideoCall = useCallback(async (chatId: string) => {
    try {
      await fetchWithAuth(`/chats/${chatId}/ring`, { method: 'POST' });
      setActiveVideoCallChatId(chatId);
      return true;
    } catch (e) {
      console.error('Failed ringing participants', e);
      return false;
    }
  }, []);

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall?.chat_id) return;
    const chatId = incomingCall.chat_id.toString();
    setActiveConversationId(chatId);
    setActiveVideoCallChatId(chatId);
    setIncomingCall(null);
  }, [incomingCall]);

  const declineIncomingCall = useCallback(async () => {
    const chatId = incomingCall?.chat_id?.toString();
    setIncomingCall(null);
    if (!chatId) return;

    try {
      await fetchWithAuth(`/chats/${chatId}/call/decline`, { method: 'POST' });
    } catch (e) {
      console.error('Failed sending call decline', e);
    }
  }, [incomingCall]);

  const endVideoCall = useCallback(async (chatId?: string) => {
    const endingChatId = chatId || activeVideoCallChatId;
    setActiveVideoCallChatId(null);
    if (!endingChatId) return;

    try {
      await fetchWithAuth(`/chats/${endingChatId}/call/end`, { method: 'POST' });
    } catch (e) {
      console.error('Failed sending call end', e);
    }
  }, [activeVideoCallChatId]);

  const addNewDMConversation = useCallback(async (newUser: NewUserData) => {
    const existingConversation = conversations.find(conversation =>
      conversation.type === 'dm' &&
      conversation.participants.some(participant => participant.id === newUser.id)
    );

    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
      return true;
    }

    // API request to create direct chat
    try {
      const res = await fetchWithAuth('/chats/direct', {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(newUser.id) })
      });
      if (res && res.chat_id) {
        await loadConversations();
        setActiveConversationId(res.chat_id.toString());
        return true;
      }
    } catch (e) {
      console.error("Failed starting DM", e);
    }
    return false;
  }, [conversations, loadConversations]);

  const createGroupConversation = useCallback(async (name: string, memberIds: string[]) => {
    try {
      const res = await fetchWithAuth('/chats/group', {
        method: 'POST',
        body: JSON.stringify({
          name,
          member_ids: memberIds.map(memberId => parseInt(memberId)),
        }),
      });
      if (res?.chat_id) {
        await loadConversations();
        setActiveConversationId(res.chat_id.toString());
        return true;
      }
    } catch (e) {
      console.error('Failed creating group', e);
    }
    return false;
  }, [loadConversations]);

  const addGroupMembers = useCallback(async (chatId: string, memberIds: string[]) => {
    try {
      await Promise.all(memberIds.map(memberId => fetchWithAuth(`/chats/group/${chatId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(memberId) }),
      })));
      await loadConversations();
      return true;
    } catch (e) {
      console.error('Failed adding group members', e);
      return false;
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
      createGroupConversation,
      addGroupMembers,
      globalPresence,
      sendTypingEvent,
      sendReadReceipt,
      incomingCall,
      setIncomingCall,
      activeVideoCallChatId,
      startVideoCall,
      acceptIncomingCall,
      declineIncomingCall,
      endVideoCall,
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
