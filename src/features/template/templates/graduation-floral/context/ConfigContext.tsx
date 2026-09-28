import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { AppConfig, GuestWish } from '../types/config';
import { DEFAULT_CONFIG } from '../data/defaultConfig';

interface ConfigContextType {
  config: AppConfig;
  updateConfig: (updater: (prev: AppConfig) => AppConfig) => void;
  resetConfig: () => void;
  
  // Intro Floral Gate state
  isGateOpen: boolean;
  openGate: () => void;

  // Wishes / Sổ lưu bút
  wishes: GuestWish[];
  addWish: (wish: Omit<GuestWish, 'id' | 'timestamp'>) => void;
  
  // Modals & Controls
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;
  isLinkGenOpen: boolean;
  setIsLinkGenOpen: (open: boolean) => void;
  
  // Lightbox
  lightboxState: { isOpen: boolean; activeIndex: number };
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  
  // Audio
  audioPlaying: boolean;
  toggleAudio: () => void;
  changeTrack: (src: string, title: string, artist: string) => void;
  
  // Particles / Butterflies / Petals
  particlesEnabled: boolean;
  toggleParticles: () => void;
  
  // Guest params from URL
  guestName: string;
  guestGreeting: string;
  isCustomGuest: boolean;
}

const INITIAL_WISHES: GuestWish[] = [
  {
    id: "wish-1",
    name: "Hoàng Yến (Bạn thân)",
    attendance: "yes",
    guestsCount: 2,
    message: "Chúc mừng nàng thơ Nguyên Mai! Chúc bạn mãi rạng ngời như đóa hoa ban mai, luôn dịu dàng và thành công rực rỡ trên con đường phía trước nhé! 🌸",
    timestamp: "Hôm nay lúc 09:15"
  },
  {
    id: "wish-2",
    name: "Minh Thư & Hội Bạn",
    attendance: "yes",
    guestsCount: 1,
    message: "Nhìn thiệp thơ mộng xỉu Mai ơi! Hẹn gặp bạn ở Hội trường A2 nha, tụi mình đã chuẩn bị bó hoa xinh nhất cho bạn rồi nè 💕",
    timestamp: "Hôm qua lúc 18:30"
  },
  {
    id: "wish-3",
    name: "Thầy Hướng Dẫn",
    attendance: "yes",
    guestsCount: 1,
    message: "Chúc mừng em hoàn thành xuất sắc chặng đường cử nhân. Giữ mãi sự tinh tế, niềm đam mê và nụ cười rạng rỡ này nhé!",
    timestamp: "Hôm qua lúc 14:02"
  }
];

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('mau_wed_poetic_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.music || !parsed.music.audioSrc.includes('cong-tu-van-tho')) {
          parsed.music = DEFAULT_CONFIG.music;
        }
        return parsed;
      } catch (e) {
        console.error('Error parsing saved config', e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const [isGateOpen, setIsGateOpen] = useState(false);

  const [wishes, setWishes] = useState<GuestWish[]>(() => {
    const savedWishes = localStorage.getItem('mau_wed_poetic_wishes');
    if (savedWishes) {
      try {
        return JSON.parse(savedWishes);
      } catch (e) {
        console.error('Error loading wishes', e);
      }
    }
    return INITIAL_WISHES;
  });

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isLinkGenOpen, setIsLinkGenOpen] = useState(false);
  const [lightboxState, setLightboxState] = useState({ isOpen: false, activeIndex: 0 });
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(true);

  // Parse Guest from URL
  const [guestName, setGuestName] = useState(config.event.defaultGuestName);
  const [guestGreeting, setGuestGreeting] = useState(config.event.inviteGreeting);
  const [isCustomGuest, setIsCustomGuest] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('guest') || params.get('to') || params.get('name') || params.get('u');
    const greet = params.get('greeting') || params.get('g');

    if (g) {
      setGuestName(decodeURIComponent(g));
      setIsCustomGuest(true);
    } else {
      setGuestName(config.event.defaultGuestName);
    }

    if (greet) {
      setGuestGreeting(decodeURIComponent(greet));
    } else {
      setGuestGreeting(config.event.inviteGreeting);
    }
  }, [config.event.defaultGuestName, config.event.inviteGreeting]);

  // Audio setup
  useEffect(() => {
    if (!audioRef.current && config.music.audioSrc) {
      const audio = new Audio(config.music.audioSrc);
      audio.loop = true;
      audioRef.current = audio;
    } else if (audioRef.current && config.music.audioSrc) {
      if (audioRef.current.src !== window.location.origin + config.music.audioSrc && !audioRef.current.src.endsWith(config.music.audioSrc)) {
        const wasPlaying = audioPlaying;
        audioRef.current.src = config.music.audioSrc;
        if (wasPlaying) {
          audioRef.current.play().catch((e) => console.log('Playback error', e));
        }
      }
    }
  }, [config.music.audioSrc, audioPlaying]);

  const toggleAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(config.music.audioSrc);
      audioRef.current.loop = true;
    }

    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setAudioPlaying(true);
      }).catch(err => {
        console.log('Audio autoplay blocked', err);
      });
    }
  };

  const openGate = () => {
    setIsGateOpen(true);
    // User interacted: Start audio immediately
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setAudioPlaying(true);
      }).catch(err => {
        console.log('Audio start error', err);
      });
    }
  };

  const changeTrack = (src: string, title: string, artist: string) => {
    updateConfig((prev) => ({
      ...prev,
      music: {
        ...prev.music,
        audioSrc: src,
        songTitle: title,
        artist: artist,
      },
    }));
  };

  const toggleParticles = () => {
    setParticlesEnabled(prev => !prev);
  };

  const updateConfig = (updater: (prev: AppConfig) => AppConfig) => {
    setConfig(prev => {
      const updated = updater(prev);
      localStorage.setItem('mau_wed_poetic_config', JSON.stringify(updated));
      return updated;
    });
  };

  const resetConfig = () => {
    localStorage.removeItem('mau_wed_poetic_config');
    setConfig(DEFAULT_CONFIG);
  };

  const addWish = (wishData: Omit<GuestWish, 'id' | 'timestamp'>) => {
    const newWish: GuestWish = {
      ...wishData,
      id: `wish-${Date.now()}`,
      timestamp: 'Vừa xong'
    };
    setWishes(prev => {
      const next = [newWish, ...prev];
      localStorage.setItem('mau_wed_poetic_wishes', JSON.stringify(next));
      return next;
    });
  };

  const openLightbox = (index: number) => {
    setLightboxState({ isOpen: true, activeIndex: index });
  };

  const closeLightbox = () => {
    setLightboxState({ isOpen: false, activeIndex: 0 });
  };

  return (
    <ConfigContext.Provider
      value={{
        config,
        updateConfig,
        resetConfig,
        isGateOpen,
        openGate,
        wishes,
        addWish,
        isCustomizerOpen,
        setIsCustomizerOpen,
        isLinkGenOpen,
        setIsLinkGenOpen,
        lightboxState,
        openLightbox,
        closeLightbox,
        audioPlaying,
        toggleAudio,
        changeTrack,
        particlesEnabled,
        toggleParticles,
        guestName,
        guestGreeting,
        isCustomGuest,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
