/** Extract YouTube video ID from a URL (watch, embed, shorts, or youtu.be). */
export function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const match = u.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/** Return true if the URL is a YouTube watch/embed/youtu.be URL. */
export function isYoutubeUrl(url: string): boolean {
  return !!getYoutubeVideoId(url);
}
