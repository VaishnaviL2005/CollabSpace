import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun, LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title = 'CollabSpace' }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="h-14 gradient-header flex items-center justify-between px-6 shadow-md relative overflow-hidden flex-shrink-0 sticky top-0 z-20">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary-foreground blur-2xl" />
        <div className="absolute -bottom-10 left-1/4 w-32 h-32 rounded-full bg-primary-foreground blur-2xl" />
      </div>
      
      <div className="relative z-10">
        <h1 className="text-lg font-semibold text-primary-foreground">{title}</h1>
      </div>
      
      <div className="relative z-10 flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-primary-foreground hover:bg-primary-foreground/20 rounded-full transition-all duration-300 h-9 w-9"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 transition-transform hover:rotate-12" />
              ) : (
                <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Switch to {theme === 'light' ? 'dark' : 'light'} mode
          </TooltipContent>
        </Tooltip>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary-foreground/30 hover:ring-primary-foreground/50 transition-all p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar} alt={user?.username} />
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-sm">
                  {user?.username?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-status-online rounded-full border-2 border-primary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.username}</p>
                <p className="text-xs text-muted-foreground">@{user?.username}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
