import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun, MessageSquare, Users, CheckSquare, Video, Check, X, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [signupData, setSignupData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation
  const passwordValidation = {
    minLength: signupData.password.length >= 6,
    hasNumber: /\d/.test(signupData.password),
    hasLowerUpper: /[a-z]/.test(signupData.password) && /[A-Z]/.test(signupData.password),
    passwordsMatch: signupData.password === signupData.confirmPassword && signupData.confirmPassword.length > 0,
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const success = await login(loginData.username, loginData.password);
    
    if (success) {
      toast.success('Welcome back!');
      navigate('/app');
    } else {
      toast.error('Invalid username or password');
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!passwordValidation.minLength) {
      toast.error('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    if (!signupData.username || !signupData.email || !signupData.password || !signupData.confirmPassword) {
      toast.error('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    const success = await signup(signupData.username, signupData.email, signupData.password);
    
    if (success) {
      toast.success('Account created successfully!');
      navigate('/app');
    } else {
      toast.error('Username already exists');
    }
    setIsLoading(false);
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={cn(
      "flex items-center gap-2 text-xs transition-colors",
      valid ? "text-success" : "text-muted-foreground"
    )}>
      {valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex transition-colors duration-300">
      {/* Left side - Branding (42% width) */}
      <div className="hidden lg:flex lg:w-[42%] gradient-header p-10 flex-col justify-between relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute bottom-40 right-10 w-80 h-80 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary-foreground blur-3xl opacity-50" />
        </div>
        
        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] right-[10%] w-32 h-32 rounded-2xl bg-primary-foreground/10 rotate-12" />
          <div className="absolute bottom-[20%] left-[8%] w-24 h-24 rounded-xl bg-primary-foreground/10 -rotate-6" />
          <div className="absolute top-[60%] right-[20%] w-20 h-20 rounded-lg bg-primary-foreground/10 rotate-45" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-primary-foreground">CollabSpace</h1>
          </div>
          <p className="text-primary-foreground/70 text-sm">Your collaborative workspace</p>
        </div>
        
        <div className="relative z-10 space-y-5 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-4 text-primary-foreground animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
            <div className="w-11 h-11 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Real-time Chat</h3>
              <p className="text-xs text-primary-foreground/70">Message threading & mentions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-primary-foreground animate-slide-in-left" style={{ animationDelay: '0.2s' }}>
            <div className="w-11 h-11 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Task Management</h3>
              <p className="text-xs text-primary-foreground/70">Kanban boards & drag-drop</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-primary-foreground animate-slide-in-left" style={{ animationDelay: '0.3s' }}>
            <div className="w-11 h-11 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Video Meetings</h3>
              <p className="text-xs text-primary-foreground/70">HD calls & screen sharing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-primary-foreground animate-slide-in-left" style={{ animationDelay: '0.4s' }}>
            <div className="w-11 h-11 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Team Whiteboard</h3>
              <p className="text-xs text-primary-foreground/70">Collaborate in real-time</p>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-primary-foreground/50 text-xs">
          © 2024 CollabSpace. All rights reserved.
        </div>
      </div>
      
      {/* Right side - Auth forms (58% width) */}
      <div className="flex-1 lg:w-[58%] flex h-screen min-h-0 items-center justify-center overflow-hidden p-6 bg-background">
        <div className="flex min-h-0 w-full max-w-md">
          <Card className="flex max-h-[calc(100vh-3rem)] min-h-0 w-full flex-col shadow-lg animate-bounce-in overflow-hidden">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {/* Fixed height container to prevent jumping */}
              <div className="flex h-[min(600px,calc(100vh-3rem))] min-h-0 flex-col">
                {/* Header with dark mode toggle */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <div>
                    <h2 className="text-xl font-bold">Welcome to CollabSpace</h2>
                    <p className="text-sm text-muted-foreground">Sign in or create an account</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleTheme}
                    className="rounded-full h-9 w-9 flex-shrink-0 transition-all hover:bg-primary hover:text-primary-foreground"
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </Button>
                </div>
                
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6">
                  <Tabs defaultValue="login" className="flex min-h-0 w-full flex-1 flex-col">
                    <TabsList className="grid w-full grid-cols-2 mb-5">
                      <TabsTrigger value="login" className="transition-all">Login</TabsTrigger>
                      <TabsTrigger value="signup" className="transition-all">Sign Up</TabsTrigger>
                    </TabsList>
                    
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth pr-1">
                      <TabsContent value="login" className="mt-0 h-full data-[state=active]:animate-fade-in">
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="login-username">Username</Label>
                            <Input
                              id="login-username"
                              placeholder="Enter your username"
                              value={loginData.username}
                              onChange={e => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                              required
                              className="h-11 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="login-password">Password</Label>
                            <div className="relative">
                              <Input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={loginData.password}
                                onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                                required
                                className="h-11 pr-10 transition-all"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </div>
                          <Button type="submit" className="w-full h-11 gradient-bg font-medium transition-all hover:shadow-glow" disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign In'}
                          </Button>
                        </form>
                        
                        <div className="mt-6 p-4 bg-muted rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground mb-2">Demo accounts:</p>
                          <div className="space-y-1.5 text-sm">
                            <p><span className="font-medium text-foreground">Alice:</span> <span className="text-muted-foreground">alice / alice123</span></p>
                            <p><span className="font-medium text-foreground">Bob:</span> <span className="text-muted-foreground">bob / bob123</span></p>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="signup" className="mt-0 pb-6 data-[state=active]:animate-fade-in">
                        <form onSubmit={handleSignup} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-username">Username</Label>
                            <Input
                              id="signup-username"
                              placeholder="Your username"
                              value={signupData.username}
                              onChange={e => setSignupData(prev => ({ ...prev, username: e.target.value }))}
                              required
                              className="h-10 transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-email">Email</Label>
                            <Input
                              id="signup-email"
                              type="email"
                              placeholder="name@example.com"
                              value={signupData.email}
                              onChange={e => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                              required
                              className="h-10 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="signup-password">Password</Label>
                            <div className="relative">
                              <Input
                                id="signup-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Create a password"
                                value={signupData.password}
                                onChange={e => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                                required
                                className="h-10 pr-10 transition-all"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                              </Button>
                            </div>
                            
                            {/* Password validation */}
                            {signupData.password.length > 0 && (
                              <div className="space-y-1 pt-2">
                                <ValidationItem valid={passwordValidation.minLength} text="At least 6 characters" />
                                <ValidationItem valid={passwordValidation.hasNumber} text="Contains a number (0-9)" />
                                <ValidationItem valid={passwordValidation.hasLowerUpper} text="Lowercase (a-z) and uppercase (A-Z)" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="signup-confirm">Confirm Password</Label>
                            <div className="relative">
                              <Input
                                id="signup-confirm"
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Re-type password"
                                value={signupData.confirmPassword}
                                onChange={e => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                                className="h-10 pr-10 transition-all"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                              </Button>
                            </div>
                            {signupData.confirmPassword.length > 0 && (
                              <ValidationItem valid={passwordValidation.passwordsMatch} text="Passwords match" />
                            )}
                          </div>
                          <Button type="submit" className="w-full h-10 gradient-bg font-medium mt-2 transition-all hover:shadow-glow" disabled={isLoading}>
                            {isLoading ? 'Creating account...' : 'Create Account'}
                          </Button>
                        </form>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
