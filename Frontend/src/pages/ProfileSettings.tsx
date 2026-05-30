import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Camera, 
  Trash2, 
  Mail, 
  Lock, 
  Check, 
  X, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { UserStatus } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProfileFormData {
  email: string;
  bio: string;
  status: UserStatus;
}

interface ValidationErrors {
  email?: string;
  bio?: string;
}

type ConfirmationState = 'idle' | 'pending' | 'success' | 'error';

const ProfileSettings = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    email: 'alice@example.com', // Demo email
    bio: 'Hey there! I\'m using CollabChat.',
    status: user?.status || 'online',
  });

  const [originalData] = useState<ProfileFormData>({ ...formData });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<ConfirmationState>('idle');

  // Email change state
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeState, setEmailChangeState] = useState<ConfirmationState>('idle');

  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetState, setPasswordResetState] = useState<ConfirmationState>('idle');

  // Avatar removal confirmation
  const [showRemoveAvatar, setShowRemoveAvatar] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (formData.bio.length > 160) {
      newErrors.bio = 'Bio must be less than 160 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const newAvatar = reader.result as string;
        setAvatarPreview(newAvatar);
        if (user) {
          try {
            const updated = await fetchWithAuth('/users/me', {
              method: 'PUT',
              body: JSON.stringify({ avatar: newAvatar })
            });
            if (updated) {
              updateUser({ ...user, avatar: updated.avatar });
              toast.success('Profile picture updated successfully');
            }
          } catch (e) {
            toast.error('Failed to update avatar on server');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarPreview(null);
    setShowRemoveAvatar(false);
    if (user) {
      const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
      try {
        const updated = await fetchWithAuth('/users/me', {
          method: 'PUT',
          body: JSON.stringify({ avatar: defaultAvatar })
        });
        if (updated) {
          updateUser({ ...user, avatar: updated.avatar });
          toast.success('Profile picture removed');
        }
      } catch (e) {
        toast.error('Failed to remove avatar on server');
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setSaveState('pending');

    try {
      if (user) {
        const updated = await fetchWithAuth('/users/me', {
          method: 'PUT',
          body: JSON.stringify({
            status: formData.status,
            bio: formData.bio || ''
          })
        });

        if (updated) {
          updateUser({ 
            ...user, 
            status: updated.status,
            bio: updated.bio
          });
        }
      }

      setIsSaving(false);
      setSaveState('success');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      setSaveState('error');
      setIsSaving(false);
      toast.error('Failed to save settings');
    }

    // Reset success state after 3 seconds
    setTimeout(() => setSaveState('idle'), 3000);
  };

  const handleCancel = () => {
    setFormData(originalData);
    setAvatarPreview(null);
    setErrors({});
    setIsEditing(false);
  };

  const handleEmailChange = async () => {
    if (!validateEmail(newEmail)) {
      return;
    }

    setEmailChangeState('pending');

    // Simulate sending verification email
    await new Promise(resolve => setTimeout(resolve, 1500));

    setEmailChangeState('success');

    // Keep success state visible
    setTimeout(() => {
      setShowEmailChange(false);
      setNewEmail('');
      setEmailChangeState('idle');
    }, 5000);
  };

  const handlePasswordReset = async () => {
    setPasswordResetState('pending');

    // Simulate sending password reset email
    await new Promise(resolve => setTimeout(resolve, 1500));

    setPasswordResetState('success');

    // Keep success state visible
    setTimeout(() => {
      setShowPasswordReset(false);
      setPasswordResetState('idle');
    }, 5000);
  };

  const hasChanges = 
    formData.bio !== originalData.bio ||
    formData.status !== originalData.status ||
    avatarPreview !== null;

  const statusOptions: { value: UserStatus; label: string; color: string }[] = [
    { value: 'online', label: 'Online', color: 'bg-success' },
    { value: 'away', label: 'Away', color: 'bg-warning' },
    { value: 'dnd', label: 'Do Not Disturb', color: 'bg-destructive' },
    { value: 'offline', label: 'Offline', color: 'bg-muted-foreground' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 h-full w-full">
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
            <p className="text-muted-foreground">Manage your profile and preferences</p>
          </div>
          {saveState === 'success' && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Changes saved
            </Badge>
          )}
        </div>

        {/* Profile Picture Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Picture</CardTitle>
            <CardDescription>Upload a photo to personalize your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-border">
                  <AvatarImage src={avatarPreview || user?.avatar} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {user?.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label="Change profile picture"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {(avatarPreview || user?.avatar) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setShowRemoveAvatar(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max size 5MB.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* Basic Info Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                Username
                <Badge variant="secondary" className="text-xs font-normal">Read-only</Badge>
              </Label>
              <Input
                id="username"
                value={user?.username || ''}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Your username cannot be changed
              </p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value as UserStatus)}
                disabled={!isEditing}
              >
                <SelectTrigger className={cn(!isEditing && 'bg-muted')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', option.color)} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center justify-between">
                <span>Bio</span>
                <span className={cn(
                  'text-xs',
                  formData.bio.length > 160 ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {formData.bio.length}/160
                </span>
              </Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                disabled={!isEditing}
                rows={3}
                className={cn(!isEditing && 'bg-muted resize-none')}
                placeholder="Tell others a bit about yourself..."
              />
              {errors.bio && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.bio}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Address
            </CardTitle>
            <CardDescription>Manage your email for account notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{formData.email}</p>
                  <div className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowEmailChange(true)}>
                Change
              </Button>
            </div>

            {showEmailChange && (
              <div className="p-4 rounded-lg border bg-card space-y-4">
                {emailChangeState === 'success' ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <Clock className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Verification email sent!</p>
                      <p className="text-sm text-muted-foreground">
                        Check your inbox at <span className="font-medium">{newEmail}</span> and click the verification link.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="newEmail">New Email Address</Label>
                      <Input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email address"
                        error={newEmail.length > 0 && !validateEmail(newEmail)}
                      />
                      {newEmail.length > 0 && !validateEmail(newEmail) && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Please enter a valid email address
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setShowEmailChange(false);
                          setNewEmail('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleEmailChange}
                        disabled={!validateEmail(newEmail) || emailChangeState === 'pending'}
                      >
                        {emailChangeState === 'pending' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send Verification'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>Secure your account with a strong password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-xs text-muted-foreground">Last changed 30 days ago</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPasswordReset(true)}>
                Reset Password
              </Button>
            </div>

            {showPasswordReset && (
              <div className="p-4 rounded-lg border bg-card space-y-4">
                {passwordResetState === 'success' ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Password reset email sent!</p>
                      <p className="text-sm text-muted-foreground">
                        Check your inbox at <span className="font-medium">{formData.email}</span> for the reset link.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        We'll send a password reset link to <span className="font-medium text-foreground">{formData.email}</span>
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowPasswordReset(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handlePasswordReset}
                        disabled={passwordResetState === 'pending'}
                      >
                        {passwordResetState === 'pending' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send Reset Link'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remove Avatar Confirmation Dialog */}
      <AlertDialog open={showRemoveAvatar} onOpenChange={setShowRemoveAvatar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Profile Picture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your current profile picture. You can always upload a new one later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAvatar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileSettings;
