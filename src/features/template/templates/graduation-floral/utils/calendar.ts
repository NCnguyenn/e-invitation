import type { EventConfig } from '../types/config';

export function getGoogleCalendarUrl(event: EventConfig): string {
  const target = new Date(event.targetDate);
  const startTime = target.toISOString().replace(/-|:|\.\d+/g, '');
  
  // Add 3 hours duration
  const endTimeDate = new Date(target.getTime() + 3 * 60 * 60 * 1000);
  const endTime = endTimeDate.toISOString().replace(/-|:|\.\d+/g, '');
  
  const title = encodeURIComponent(`${event.badgeTop} // ${event.ownerName} - ${event.subName}`);
  const details = encodeURIComponent(
    `Sự kiện: ${event.badgeTop} - ${event.ownerName}\nThời gian: ${event.timeString}, Ngày ${event.day}/${event.month}/${event.year}\nĐịa điểm: ${event.venue.name} - ${event.venue.subVenue}\nĐịa chỉ: ${event.venue.address}`
  );
  const location = encodeURIComponent(`${event.venue.name}, ${event.venue.address}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&location=${location}`;
}

export function generateMonthlyDays(year: number, month1Indexed: number, highlightDay: number) {
  const firstDay = new Date(year, month1Indexed - 1, 1);
  const lastDay = new Date(year, month1Indexed, 0);
  const totalDays = lastDay.getDate();

  // Monday-based (0 = Mon, 6 = Sun)
  let startCol = firstDay.getDay() - 1;
  if (startCol === -1) startCol = 6;

  const days: Array<{ day: number | null; isHighlight: boolean }> = [];

  // Empty leading days
  for (let i = 0; i < startCol; i++) {
    days.push({ day: null, isHighlight: false });
  }

  // Actual days
  for (let d = 1; d <= totalDays; d++) {
    days.push({
      day: d,
      isHighlight: d === highlightDay,
    });
  }

  return days;
}
