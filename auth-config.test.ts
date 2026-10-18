import { describe, expect, it } from 'vitest';
function mapsSearch(query: string, lat?: number, lng?: number) {
  const q = lat != null && lng != null ? `hospitals near ${lat},${lng}` : query || 'hospitals near me';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
describe('nearby hospital search fallback', () => {
  it('creates a generic Maps search without location permission', () => {
    expect(mapsSearch('hospitals near me')).toContain('google.com/maps/search');
    expect(decodeURIComponent(mapsSearch('hospitals near me'))).toContain('hospitals near me');
  });
  it('uses coordinates only after a location is provided', () => {
    expect(decodeURIComponent(mapsSearch('', 11.6643, 78.1460))).toContain('11.6643,78.146');
  });
});
