import { describe, expect, it } from 'vitest';
import { parseYoutubeId } from './youtube';

describe('parseYoutubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reconnaît %s', (url, id) => {
    expect(parseYoutubeId(url)).toBe(id);
  });

  it.each(['https://vimeo.com/123', 'pas un lien', 'https://www.youtube.com/watch?v=court', ''])(
    'refuse %s',
    (url) => {
      expect(parseYoutubeId(url)).toBeNull();
    },
  );
});
