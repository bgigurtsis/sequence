export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  profileImageUrl?: string;
  dateAdded: string;
  lastActive?: string;
}

export interface ShareLink {
  id: string;
  resourceType: 'recording' | 'rehearsal' | 'performance' | 'collection';
  resourceId: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  password?: string;
  accessCount: number;
  isActive: boolean;
}

export interface Comment {
  id: string;
  resourceType: 'recording' | 'rehearsal';
  resourceId: string;
  userId: string;
  userName: string;
  userProfileUrl?: string;
  content: string;
  timestamp: string;
  timestampInVideo?: number; // For comments on specific video timestamps
  parentCommentId?: string; // For replies
  isEdited?: boolean;
  reactions?: {
    [reaction: string]: string[]; // Maps reaction emoji to array of userIds
  };
}

export interface Notification {
  id: string;
  recipientId: string;
  type: 'new_recording' | 'new_comment' | 'mentioned' | 'share' | 'team_invite';
  senderId?: string;
  senderName?: string;
  resourceType: 'recording' | 'rehearsal' | 'performance' | 'collection' | 'team';
  resourceId: string;
  resourceName: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  ownerId: string;
  members: TeamMember[];
} 