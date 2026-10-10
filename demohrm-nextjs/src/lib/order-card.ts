export interface OrderCard {
  summary: string;
  videoLink: string;
  wages: string[];
  images: string[];
  manager: string;
}

export function encodeOrderNote(card: OrderCard): string {
  return JSON.stringify({
    twCard: 1,
    summary: card.summary,
    wages: card.wages,
    manager: card.manager,
  });
}

export function noteWithoutMedia(note: string | null | undefined): string | null {
  if (!note) return note ?? null;
  try {
    const value = JSON.parse(note) as { twCard?: number };
    if (value.twCard === 1) return encodeOrderNote(readOrderCard(note));
  } catch {
    return note;
  }
  return note;
}

export function readOrderCard(note: string | null | undefined): OrderCard {
  const empty: OrderCard = { summary: "", videoLink: "", wages: [], images: [], manager: "" };
  if (!note) return empty;
  try {
    const value = JSON.parse(note) as Partial<OrderCard> & { twCard?: number };
    if (value.twCard === 1) {
      return {
        summary: typeof value.summary === "string" ? value.summary : "",
        videoLink: typeof value.videoLink === "string" ? value.videoLink : "",
        wages: Array.isArray(value.wages) ? value.wages.filter((item) => typeof item === "string") : [],
        images: Array.isArray(value.images) ? value.images.filter((item) => typeof item === "string") : [],
        manager: typeof value.manager === "string" ? value.manager : "",
      };
    }
  } catch {
    return { ...empty, summary: note };
  }
  return { ...empty, summary: note };
}
