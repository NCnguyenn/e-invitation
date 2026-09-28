export interface MetaConfig {
  pageTitle: string;
  shareTitle: string;
  shareDescription: string;
  favicon: string;
}

export interface CalendarConfig {
  year: number;
  month: number;
  highlightDay: number;
  title: string;
}

export interface VenueConfig {
  name: string;
  subVenue: string;
  address: string;
  coordinates?: string;
  mapDirectLink: string;
  mapEmbedUrl: string;
}

export interface EventConfig {
  badgeTop: string;
  badgeBottom: string;
  ownerName: string;
  subName: string;
  defaultGuestName: string;
  inviteGreeting: string;
  targetDate: string; // ISO string e.g. "2026-09-28T10:45:00"
  timeString: string;
  day: string;
  month: string;
  year: string;
  calendar: CalendarConfig;
  venue: VenueConfig;
}

export interface GalleryItem {
  id: string;
  src: string;
  caption: string;
  category?: string;
}

export interface ImagesConfig {
  heroPortrait: string;
  storyPortrait: string;
  marqueePhotos: string[];
  galleryPhotos: GalleryItem[];
  thankYouBanner: string;
}

export interface StoryConfig {
  heading: string;
  tagline?: string;
  paragraphs: string[];
  signature: string;
}

export interface RSVPConfig {
  title: string;
  subtitle: string;
  description: string;
  acceptLabel: string;
  declineLabel: string;
  submitLabel: string;
  googleSheetWebhookUrl?: string;
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrImage: string;
}

export interface GiftBoxConfig {
  enabled: boolean;
  title: string;
  description: string;
  accounts: BankAccount[];
}

export interface ThankYouConfig {
  title: string;
  subtitle?: string;
  message: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
}

export interface MusicConfig {
  enabled: boolean;
  audioSrc: string;
  songTitle: string;
  artist: string;
  playlist?: MusicTrack[];
}

export interface EffectsConfig {
  particles: boolean;
  particleType: 'petals' | 'butterflies' | 'both';
  themeColor: 'rose' | 'rosegold' | 'cream';
}

export interface GuestWish {
  id: string;
  name: string;
  attendance: 'yes' | 'no';
  guestsCount: number;
  message: string;
  timestamp: string;
}

export interface AppConfig {
  meta: MetaConfig;
  event: EventConfig;
  images: ImagesConfig;
  story: StoryConfig;
  rsvp: RSVPConfig;
  giftBox: GiftBoxConfig;
  thankYou: ThankYouConfig;
  music: MusicConfig;
  effects: EffectsConfig;
}
