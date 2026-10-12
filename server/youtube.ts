const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYoutubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v');
    else {
      const m = /^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname);
      candidate = m?.[1] ?? null;
    }
  }
  return candidate && ID.test(candidate) ? candidate : null;
}
