import type { Message } from './timeline';

export interface GroupMessage extends Message {
  senderId: string;
}

export interface GroupSession {
  id: string;
  name: string;
  memberIds: string[];
  messages: GroupMessage[];
  createdAt: string;
  updatedAt: string;
}
