export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  votes: number;
  userVote?: number;
  replies?: Comment[];
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  votes: number;
  commentCount: number;
  timestamp: string;
  imageUrl?: string;
  comments: Comment[];
  userVote?: number;
}

export interface SubredditInfo {
  name: string;
  description: string;
  subscribers: string;
  online: number;
  icon: string;
  createdAt: string;
  isMember?: boolean;
}

export interface Notification {
  _id: string;
  recipient: string;
  actor: {
    _id: string;
    username: string;
  };
  type: 'post_comment' | 'comment_reply' | 'mention';
  post?: {
    _id: string;
    title: string;
  };
  comment?: {
    _id: string;
    body: string;
  };
  isRead: boolean;
  createdAt: string;
}
