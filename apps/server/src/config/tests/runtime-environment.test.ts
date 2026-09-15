import { afterEach, describe, expect, it } from 'vitest';

import { resolveClientOrigin } from '../runtime-environment';

const originalClientOrigin = process.env.CLIENT_ORIGIN;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalClientOrigin === undefined) {
    delete process.env.CLIENT_ORIGIN;
  } else {
    process.env.CLIENT_ORIGIN = originalClientOrigin;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('resolveClientOrigin', () => {
  it('returns configured CLIENT_ORIGIN', () => {
    process.env.CLIENT_ORIGIN = '  https://game.example.com  ';
    process.env.NODE_ENV = 'production';

    expect(resolveClientOrigin()).toBe('https://game.example.com');
  });

  it('uses localhost fallback outside production', () => {
    delete process.env.CLIENT_ORIGIN;
    process.env.NODE_ENV = 'development';

    expect(resolveClientOrigin()).toBe('http://localhost:5173');
  });

  it('fails when CLIENT_ORIGIN is missing in production', () => {
    delete process.env.CLIENT_ORIGIN;
    process.env.NODE_ENV = 'production';

    expect(() => resolveClientOrigin()).toThrow(
      'CLIENT_ORIGIN is required in production',
    );
  });
});
