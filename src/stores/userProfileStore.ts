import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfileStore {
  /** 用户自己的头像（base64 DataURL，最多 ~30KB / 张）*/
  avatar: string;
  /** 显示昵称（可选） */
  nickname: string;
  setAvatar: (avatar: string) => void;
  setNickname: (nickname: string) => void;
  clearAvatar: () => void;
}

export const useUserProfileStore = create<UserProfileStore>()(
  persist(
    (set) => ({
      avatar: '',
      nickname: '',
      setAvatar: (avatar) => set({ avatar }),
      setNickname: (nickname) => set({ nickname }),
      clearAvatar: () => set({ avatar: '' }),
    }),
    {
      name: 'copy-chat:user-profile',
    }
  )
);
