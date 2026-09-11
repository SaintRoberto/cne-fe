import type { LucideIcon } from 'lucide-react';

export type User = {
  name: string;
  role: string;
  email: string;
  initials: string;
};

export type MenuItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
};
