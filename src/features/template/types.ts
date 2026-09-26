import type { ReactNode } from 'react';
import type { GuestInvitation } from '@/lib/contracts';

export type TemplateProps = { invitation: GuestInvitation } & (
  | { mode: 'preview'; previewContext?: 'host' | 'designer'; musicVersion?: number; responseArea?: never; audioControl?: never }
  | { mode: 'guest'; responseArea: ReactNode; audioControl: ReactNode }
);

export type TemplateDefinition = {
  key: string;
  name: string;
  category: 'wedding' | 'graduation' | 'event' | 'custom';
  component: React.ComponentType<TemplateProps>;
};
