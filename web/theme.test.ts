import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const theme = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

describe('identité de la chaîne', () => {
  it('reprend le jaune et les polices de la chaîne', () => {
    expect(theme).toMatch(/--gold:\s*#b69b64/i);
    expect(theme).toMatch(/--font-display:\s*'Fraunces'/);
    expect(theme).toMatch(/--font-body:\s*'Times New Roman'/);
    expect(theme).toMatch(/--rec:/);
  });

  it('ne charge plus les anciennes polices', () => {
    expect(html).toMatch(/family=Fraunces/);
    expect(html).not.toMatch(/Limelight|League\+Gothic|IM\+Fell/);
  });
});
