import React from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Trash2, ExternalLink, Hash, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function SavedMessages() {
  const { conversations, toggleSaveMessage, scrollToMessage } = useChat();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Get all saved messages with their conversation context
  const savedMessagesWithContext = conversations.flatMap(conv => 
    conv.messages
      .filter(m => m.isSaved)
      .map(m => ({
        message: m,
        conversation: conv,
      }))
  ).sort((a, b) => new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime());

  const handleJumpToMessage = (messageId: string) => {
    scrollToMessage(messageId);
    navigate('/app');
  };

  const getSenderName = (senderId: string, conv: typeof conversations[0]) => {
    if (senderId === user?.id) return 'You';
    const participant = conv.participants.find(p => p.id === senderId);
    return participant?.username || 'Unknown';
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6 flex-shrink-0">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Bookmark className="w-7 h-7 text-primary" />
          Saved Messages
        </h2>
        <p className="text-muted-foreground mt-1">
          {savedMessagesWithContext.length} saved message{savedMessagesWithContext.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      {savedMessagesWithContext.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bookmark className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No saved messages yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Click the bookmark icon on any message to save it here for quick access
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-2">
            {savedMessagesWithContext.map(({ message, conversation }) => {
              const isOwn = message.senderId === user?.id;
              const isGroup = conversation.type === 'group';
              
              return (
                <div
                  key={message.id}
                  className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200 animate-fade-in group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Conversation context */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          {isGroup ? (
                            <>
                              <Hash className="w-3 h-3" />
                              {conversation.name}
                            </>
                          ) : (
                            <>
                              <UserIcon className="w-3 h-3" />
                              {conversation.name}
                            </>
                          )}
                        </Badge>
                      </div>
                      
                      {/* Message info */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">
                          {getSenderName(message.senderId, conversation)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.timestamp), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      
                      {/* Message content */}
                      <p className="text-sm text-foreground/90">{message.content}</p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleJumpToMessage(message.id)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Jump to message</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => toggleSaveMessage(message.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove from saved</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
