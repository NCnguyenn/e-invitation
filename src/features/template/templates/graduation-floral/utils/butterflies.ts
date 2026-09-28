export const triggerButterflyFlock = (originX?: number, originY?: number) => {
  if (typeof window === 'undefined') return;

  const defaultX = 70;
  const defaultY = window.innerHeight - 70;

  window.dispatchEvent(
    new CustomEvent('burst-butterflies', {
      detail: {
        originX: originX ?? defaultX,
        originY: originY ?? defaultY,
        count: window.innerWidth < 768 ? 18 : 28,
      },
    })
  );
};
