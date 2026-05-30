import React, { useEffect, useState, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Bookmark, 
  CheckSquare, 
  Video, 
  Palette, 
  BarChart3,
  Hash,
  User,
  ChevronDown,
  MessageSquare,
  Plus,
  Search,
  X,
  Settings
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api';

interface UserSearchResult {
  id: string;
  username: string;
  avatar: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
}

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

function NavItem({ to, icon: Icon, label, badge }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            isActive 
              ? "bg-primary text-primary-foreground shadow-md" 
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{label}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
              {badge}
            </Badge>
          )}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

interface ChannelItemProps {
  id: string;
  name: string;
  unread?: number;
  isActive?: boolean;
  onClick: () => void;
}

function ChannelItem({ id, name, unread, isActive, onClick }: ChannelItemProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 w-full text-sm rounded-lg transition-all duration-200",
        isActive 
          ? "bg-primary text-primary-foreground font-medium shadow-sm" 
          : "text-sidebar-foreground hover:bg-sidebar-accent",
        unread && unread > 0 && !isActive && "font-medium"
      )}
    >
      <Hash className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
      <span className="flex-1 text-left">{name}</span>
      {unread !== undefined && unread > 0 && !isActive && (
        <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
          {unread}
        </Badge>
      )}
    </button>
  );
}

interface DMItemProps {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  unread?: number;
  isActive?: boolean;
  onClick: () => void;
}

function DMItem({ id, name, avatar, status, unread, isActive, onClick }: DMItemProps) {
  const statusColors = {
    online: 'bg-status-online',
    away: 'bg-status-away',
    dnd: 'bg-status-dnd',
    offline: 'bg-muted-foreground',
  };
  
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 w-full text-sm rounded-lg transition-all duration-200",
        isActive 
          ? "bg-primary text-primary-foreground font-medium shadow-sm" 
          : "text-sidebar-foreground hover:bg-sidebar-accent",
        unread && unread > 0 && !isActive && "font-medium"
      )}
    >
      <div className="relative">
        <img src={avatar} alt={name} className="w-6 h-6 rounded-full" />
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
          isActive ? "border-primary" : "border-sidebar",
          statusColors[status]
        )} />
      </div>
      <span className="flex-1 text-left truncate">{name}</span>
      {unread !== undefined && unread > 0 && !isActive && (
        <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
          {unread}
        </Badge>
      )}
    </button>
  );
}

export default function AppSidebar() {
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showGroupSearch, setShowGroupSearch] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [showDMSearch, setShowDMSearch] = useState(false);
  const [dmSearchQuery, setDMSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const { conversations, activeConversation, setActiveConversation, addNewDMConversation, globalPresence } = useChat();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const dmConversations = conversations.filter(c => c.type === 'dm');
  const groupConversations = conversations.filter(c => c.type === 'group');
  
  const isOnChatPage = location.pathname === '/app' || location.pathname === '/app/';

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return groupConversations;
    const query = groupSearchQuery.toLowerCase();
    return groupConversations.filter(c => c.name.toLowerCase().includes(query));
  }, [groupSearchQuery, groupConversations]);

  // Filter DMs based on search
  const filteredDMs = useMemo(() => {
    if (!dmSearchQuery.trim()) return dmConversations;
    const query = dmSearchQuery.toLowerCase();
    return dmConversations.filter(c => c.name.toLowerCase().includes(query));
  }, [dmSearchQuery, dmConversations]);

  useEffect(() => {
    const query = userSearchQuery.trim();
    if (!query) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const results = await fetchWithAuth(`/users/search?query=${encodeURIComponent(query)}`) || [];
        if (!cancelled) {
          setUserSearchResults(results.map((result: any) => ({
            id: result.id.toString(),
            username: result.username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.username}`,
            status: 'offline',
          })));
        }
      } catch (error) {
        console.error('Failed searching users', error);
        if (!cancelled) setUserSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchingUsers(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userSearchQuery]);

  const filteredUsers = useMemo(() => {
    return userSearchResults
      .map(u => ({
        ...u,
        status: (globalPresence[u.id] || u.status) as UserSearchResult['status'],
      }));
  }, [userSearchResults, globalPresence]);

  const handleSelectUser = (selectedUser: UserSearchResult) => {
    addNewDMConversation(selectedUser);
    setShowUserSearch(false);
    setUserSearchQuery('');
    navigate('/app');
  };

  const getParticipantStatus = (conv: typeof conversations[0]) => {
    if (conv.type === 'dm' && conv.participants[0]) {
      const pid = conv.participants[0].id;
      return (globalPresence[pid] || conv.participants[0].status) as 'online' | 'away' | 'dnd' | 'offline';
    }
    return 'online';
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 px-4 flex items-center border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-glow">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg gradient-text">CollabSpace</span>
        </div>
      </div>
      
      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-4">
          {/* Quick actions */}
          <nav className="space-y-1 mb-4">
            <NavItem to="/app/tasks" icon={CheckSquare} label="Personal Tasks" />
            <NavItem to="/app/meetings" icon={Video} label="Meetings" />
            <NavItem to="/app/whiteboard" icon={Palette} label="Whiteboard" />
            <NavItem to="/app/analytics" icon={BarChart3} label="Analytics" />
          </nav>
          
          {/* Groups */}
          <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen} className="mt-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors group">
              <span>Groups</span>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowGroupSearch(!showGroupSearch);
                        setGroupsOpen(true);
                      }}
                    >
                      <Search className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Search Groups</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create Group</TooltipContent>
                </Tooltip>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", groupsOpen && "rotate-180")} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {/* Group Search Input */}
              {showGroupSearch && (
                <div className="px-1 py-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Filter groups..."
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      className="h-8 pl-7 pr-7 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => {
                        setShowGroupSearch(false);
                        setGroupSearchQuery('');
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {filteredGroups.map(conv => (
                <ChannelItem 
                  key={conv.id}
                  id={conv.id}
                  name={conv.name} 
                  unread={conv.unreadCount}
                  isActive={isOnChatPage && activeConversation?.id === conv.id}
                  onClick={() => {
                    setActiveConversation(conv.id);
                    if (location.pathname !== '/app') {
                      navigate('/app');
                    }
                  }}
                />
              ))}
              
              {showGroupSearch && filteredGroups.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  No groups found
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Direct Messages */}
          <Collapsible open={dmsOpen} onOpenChange={setDmsOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors group">
              <span>Direct Messages</span>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowDMSearch(!showDMSearch);
                        setDmsOpen(true);
                      }}
                    >
                      <Search className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Search Messages</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowUserSearch(true);
                        setDmsOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New Message</TooltipContent>
                </Tooltip>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", dmsOpen && "rotate-180")} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {/* DM Filter Search Input */}
              {showDMSearch && (
                <div className="px-1 py-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Filter messages..."
                      value={dmSearchQuery}
                      onChange={(e) => setDMSearchQuery(e.target.value)}
                      className="h-8 pl-7 pr-7 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => {
                        setShowDMSearch(false);
                        setDMSearchQuery('');
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* User Search Input for adding new DM */}
              {showUserSearch && (
                <div className="px-1 py-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search username..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="h-8 pl-7 pr-7 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => {
                        setShowUserSearch(false);
                        setUserSearchQuery('');
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {/* Search Results Dropdown */}
                  {userSearchQuery.trim() && (
                    <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                      {isSearchingUsers ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                          Searching...
                        </div>
                      ) : filteredUsers.length > 0 ? (
                        <div className="max-h-40 overflow-y-auto">
                          {filteredUsers.map(u => (
                            <button
                              key={u.id}
                              onClick={() => handleSelectUser(u)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                            >
                              <div className="relative">
                                <img src={u.avatar} alt={u.username} className="w-6 h-6 rounded-full" />
                                <span className={cn(
                                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-popover",
                                  u.status === 'online' && 'bg-status-online',
                                  u.status === 'away' && 'bg-status-away',
                                  u.status === 'dnd' && 'bg-status-dnd',
                                  u.status === 'offline' && 'bg-muted-foreground',
                                )} />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="font-medium">{u.username}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No user found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {filteredDMs.map(conv => (
                <DMItem 
                  key={conv.id}
                  id={conv.id}
                  name={conv.name} 
                  avatar={conv.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.name}`}
                  status={getParticipantStatus(conv)}
                  unread={conv.unreadCount}
                  isActive={isOnChatPage && activeConversation?.id === conv.id}
                  onClick={() => {
                    setActiveConversation(conv.id);
                    if (location.pathname !== '/app') {
                      navigate('/app');
                    }
                  }}
                />
              ))}
              
              {showDMSearch && filteredDMs.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  No conversations found
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
      
      {/* User section at bottom - fixed */}
      <div className="p-3 border-t border-sidebar-border flex-shrink-0 bg-sidebar">
        <div 
          onClick={() => navigate('/app/profile')}
          className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent cursor-pointer transition-colors group"
        >
          <div className="relative">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.displayName} className="w-8 h-8 rounded-full" />
            ) : (
              <User className="w-8 h-8 p-1.5 rounded-full bg-primary/10 text-primary" />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-online border-2 border-sidebar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.displayName || 'Your Status'}</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Account Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
