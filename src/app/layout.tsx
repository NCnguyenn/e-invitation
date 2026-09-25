import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Thiệp mời điện tử',
  description: 'Những khoảnh khắc đặc biệt được kể lại theo dấu ấn riêng của bạn.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
