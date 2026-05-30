import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { Message, MessageStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Bookmark, 
  Reply, 
  MoreHorizontal, 
  Clock, 
  Search,
  Image as ImageIcon,
  X,
  Video,
  MoreVertical,
  User,
  FileImage,
  BellOff,
  Ban,
  Hash,
  Users,
  ExternalLink,
  Trash2,
  Check,
  CheckCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function TypingIndicator({ username, avatar }: { username: string; avatar?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 animate-fade-in">
      <Avatar className="w-8 h-8">
        <AvatarImage src={avatar} />
        <AvatarFallback>{username.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-tl-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{username} is typing...</span>
    </div>
  );
}

function ReadReceipt({ status }: { status?: MessageStatus }) {
  if (!status) return null;
  
  return (
    <span className="inline-flex items-center ml-1">
      {status === 'sending' && (
        <Clock className="w-3 h-3 text-muted-foreground/50" />
      )}
      {status === 'sent' && (
        <Check className="w-3.5 h-3.5 text-muted-foreground/60" />
      )}
      {status === 'delivered' && (
        <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
      )}
      {status === 'read' && (
        <CheckCheck className="w-3.5 h-3.5 text-primary" />
      )}
    </span>
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName: string;
  senderAvatar: string;
  onReply: (messageId: string) => void;
  onSave: (messageId: string) => void;
  isHighlighted?: boolean;
}

function MessageBubble({ message, isOwn, senderName, senderAvatar, onReply, onSave, isHighlighted }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isHighlighted && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);
  
  // Parse mentions in content
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="font-semibold text-primary cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div 
      ref={messageRef}
      id={`message-${message.id}`}
      className={cn(
        "group flex gap-3 px-4 py-2 hover:bg-muted/30 transition-all duration-300",
        isOwn ? "flex-row-reverse" : "flex-row",
        isHighlighted && "bg-primary/10 ring-2 ring-primary/30 rounded-lg animate-pulse"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className="w-9 h-9 flex-shrink-0">
        <AvatarImage src={senderAvatar} />
        <AvatarFallback>{senderName.charAt(0)}</AvatarFallback>
      </Avatar>
      
      <div className={cn("flex flex-col max-w-[70%]", isOwn && "items-end")}>
        <div className={cn("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
          <span className="text-sm font-medium">{senderName}</span>
          <span className="flex items-center text-xs text-muted-foreground">
            {format(new Date(message.timestamp), 'h:mm a')}
            {isOwn && <ReadReceipt status={message.status} />}
          </span>
          {message.isSaved && (
            <Bookmark className="w-3 h-3 text-primary fill-primary" />
          )}
        </div>

        {message.replyTo && (
          <div className={cn(
            "text-xs px-2 py-1 mb-1 rounded border-l-2 border-primary bg-muted/50",
            isOwn ? "mr-2" : "ml-2"
          )}>
            <span className="text-muted-foreground">Replying to a message</span>
          </div>
        )}
        
        <div className={cn(
          "px-4 py-2.5 rounded-2xl shadow-sm relative",
          isOwn 
            ? "bg-chat-self text-chat-self-text rounded-tr-md" 
            : "bg-chat-other text-chat-other-text rounded-tl-md"
        )}>
          <p className="text-sm leading-relaxed">{renderContent(message.content)}</p>
        </div>
        
        {/* Message actions */}
        {showActions && (
          <div className={cn(
            "flex items-center gap-1 mt-1 animate-fade-in",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => onReply(message.id)}
                >
                  <Reply className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => onSave(message.id)}
                >
                  <Bookmark className={cn("w-3.5 h-3.5", message.isSaved && "fill-primary text-primary")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{message.isSaved ? 'Unsave' : 'Save'}</TooltipContent>
            </Tooltip>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"}>
                <DropdownMenuItem>Copy text</DropdownMenuItem>
                <DropdownMenuItem>Forward</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatArea() {
  const { user } = useAuth();
  const { 
    messages, 
    addMessage, 
    toggleSaveMessage, 
    typingUsers, 
    activeConversation,
    conversations,
    highlightedMessageId,
    clearHighlight,
    scrollToMessage,
    globalPresence
  } = useChat();
  const navigate = useNavigate();
  
  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [showConversationDetails, setShowConversationDetails] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!highlightedMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, highlightedMessageId]);

  // Clear highlight after animation
  useEffect(() => {
    if (highlightedMessageId) {
      const timer = setTimeout(clearHighlight, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedMessageId, clearHighlight]);
  
  const handleSend = () => {
    if (!inputValue.trim() && !attachment) return;
    
    const mentions = inputValue.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    
    addMessage({
      senderId: user?.id || '',
      content: inputValue,
      replyTo: replyingTo || undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
    
    setInputValue('');
    setReplyingTo(null);
    setAttachment(null);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachment(file);
      toast.success(`File "${file.name}" attached`);
    }
  };
  
  const filteredMessages = searchQuery 
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;
  
  const getMessageSender = (senderId: string) => {
    if (senderId === user?.id) {
      return { name: user.username, avatar: user.avatar };
    }
    // Find the sender in conversation participants
    const participant = activeConversation?.participants.find(p => p.id === senderId);
    if (participant) {
      return { name: participant.username, avatar: participant.avatar };
    }
    // Fallback for group messages
    const allParticipants = conversations.flatMap(c => c.participants);
    const sender = allParticipants.find(p => p.id === senderId);
    return sender 
      ? { name: sender.username, avatar: sender.avatar }
      : { name: 'Unknown', avatar: '' };
  };

  const getTypingUser = () => {
    if (typingUsers.length === 0) return { name: '', avatar: '' };
    const participant = activeConversation?.participants.find(p => typingUsers.includes(p.id));
    return { name: participant?.username || 'Someone', avatar: participant?.avatar || '' };
  };

  // Get saved messages for current conversation
  const savedMessagesForConversation = activeConversation 
    ? activeConversation.messages.filter(m => m.isSaved)
    : [];

  const handleJumpToSavedMessage = (messageId: string) => {
    setShowSavedMessages(false);
    scrollToMessage(messageId);
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return 'You';
    const sender = getMessageSender(senderId);
    return sender.name;
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background items-center justify-center">
        <div className="text-center p-8">
          <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
          <p className="text-muted-foreground text-sm">
            Choose a group or direct message from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  const isGroup = activeConversation.type === 'group';
  const chatName = isGroup ? `#${activeConversation.name}` : activeConversation.name;
  const chatAvatar = isGroup ? undefined : activeConversation.avatar;
  const participantStatus = !isGroup && activeConversation.participants[0]
    ? globalPresence[activeConversation.participants[0].id] || activeConversation.participants[0].status
    : undefined;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Chat header - sticky */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {isGroup ? (
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Hash className="w-5 h-5 text-primary" />
            </div>
          ) : (
            <Avatar className="w-9 h-9">
              <AvatarImage src={chatAvatar} />
              <AvatarFallback>{chatName.charAt(0)}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <h3 className="font-semibold text-sm">{chatName}</h3>
            <div className="flex items-center gap-1.5">
              {isGroup ? (
                <span className="text-xs text-muted-foreground">
                  {activeConversation.participants.length} members
                </span>
              ) : (
                <>
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    participantStatus === 'online' ? "bg-status-online" : 
                    participantStatus === 'away' ? "bg-status-away" : 
                    participantStatus === 'dnd' ? "bg-status-dnd" : "bg-muted-foreground"
                  )} />
                  <span className="text-xs text-muted-foreground capitalize">{participantStatus}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {showSearch ? (
            <div className="flex items-center gap-2 animate-slide-in-left">
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-48 h-8"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
                    <Search className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search messages</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => toast.info('Starting video call...')}
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start video call</TooltipContent>
              </Tooltip>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowConversationDetails(true)}>
                    {isGroup ? <Users className="w-4 h-4 mr-2" /> : <User className="w-4 h-4 mr-2" />}
                    {isGroup ? 'View Members' : 'View Profile'}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileImage className="w-4 h-4 mr-2" />
                    Media & Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowSavedMessages(true)}>
                    <Bookmark className="w-4 h-4 mr-2" />
                    Saved Messages
                    {savedMessagesForConversation.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {savedMessagesForConversation.length}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <BellOff className="w-4 h-4 mr-2" />
                    Mute Notifications
                  </DropdownMenuItem>
                  {!isGroup && (
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Ban className="w-4 h-4 mr-2" />
                      Block User
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      
      {/* Messages area - scrollable */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            filteredMessages.map(message => {
              const sender = getMessageSender(message.senderId);
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === user?.id}
                  senderName={sender.name}
                  senderAvatar={sender.avatar}
                  onReply={setReplyingTo}
                  onSave={toggleSaveMessage}
                  isHighlighted={message.id === highlightedMessageId}
                />
              );
            })
          )}
          
          {typingUsers.length > 0 && (() => {
            const typingUser = getTypingUser();
            return <TypingIndicator username={typingUser.name} avatar={typingUser.avatar} />;
          })()}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      {/* Reply preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center justify-between animate-slide-up flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <Reply className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Replying to message</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      {/* Attachment preview */}
      {attachment && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center justify-between animate-slide-up flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <ImageIcon className="w-4 h-4 text-primary" />
            <span className="truncate max-w-[200px]">{attachment.name}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachment(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      {/* Input area - fixed at bottom */}
      <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx"
          />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach file</TooltipContent>
          </Tooltip>
          
          <div className="flex-1 relative">
            <Input
              placeholder={`Message ${chatName}...`}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Smile className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add emoji</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => toast.info('Schedule message feature')}
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Schedule message</TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleSend}
                className="gradient-bg shadow-glow flex-shrink-0"
                size="icon"
                disabled={!inputValue.trim() && !attachment}
              >
                <Send className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Dialog open={showConversationDetails} onOpenChange={setShowConversationDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isGroup ? `${activeConversation.name} members` : activeConversation.name}</DialogTitle>
            <DialogDescription>
              {isGroup
                ? `${activeConversation.participants.length} member${activeConversation.participants.length === 1 ? '' : 's'} in this group`
                : 'Direct-message profile'}
            </DialogDescription>
          </DialogHeader>

          {isGroup ? (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {activeConversation.participants.map(participant => {
                const status = globalPresence[participant.id] || participant.status;
                return (
                  <div key={participant.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={participant.avatar} />
                      <AvatarFallback>{participant.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{participant.username}</p>
                      <p className="text-xs capitalize text-muted-foreground">{status}</p>
                    </div>
                    <span className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      status === 'online' ? 'bg-status-online' : 'bg-muted-foreground'
                    )} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={activeConversation.participants[0]?.avatar} />
                <AvatarFallback>{activeConversation.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{activeConversation.participants[0]?.username || activeConversation.name}</p>
                <p className="text-sm capitalize text-muted-foreground">{participantStatus || 'offline'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Saved Messages Dialog */}
      <Dialog open={showSavedMessages} onOpenChange={setShowSavedMessages}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-primary" />
              Saved Messages
              <span className="text-sm font-normal text-muted-foreground">
                ({savedMessagesForConversation.length})
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {savedMessagesForConversation.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No saved messages in this conversation</p>
                <p className="text-xs mt-1">Click the bookmark icon on any message to save it</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {savedMessagesForConversation.map(msg => (
                  <div 
                    key={msg.id}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{getSenderName(msg.senderId)}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{msg.content}</p>
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => handleJumpToSavedMessage(msg.id)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Jump to message</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => toggleSaveMessage(msg.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove from saved</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
