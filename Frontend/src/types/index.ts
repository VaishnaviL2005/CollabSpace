export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  status: UserStatus;
  bio?: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  replyTo?: string;
  mentions?: string[];
  isScheduled?: boolean;
  scheduledFor?: Date;
  isSaved?: boolean;
  attachments?: Attachment[];
  status?: MessageStatus;
  messageType?: string;
  fileUrl?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  url: string;
  size?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'completed';
  assignee?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  avatar?: string;
}

export interface DirectMessage {
  id: string;
  participantIds: string[];
  lastMessage?: Message;
}
