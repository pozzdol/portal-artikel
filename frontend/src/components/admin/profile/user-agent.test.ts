import { describe, expect, test } from 'bun:test';

import { describeUserAgent } from './user-agent';

describe('describeUserAgent', () => {
  test('common browsers', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome di Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari di iOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
      ),
    ).toBe('Firefox di Linux');
  });
  test('unknown', () => {
    expect(describeUserAgent(null)).toBe('Perangkat tidak dikenal');
    expect(describeUserAgent('curl/8.5.0')).toBe('curl');
  });
});
