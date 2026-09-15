const DEVELOPMENT_CLIENT_ORIGIN = 'http://localhost:5173';

export function resolveClientOrigin(): string {
  const configuredOrigin = process.env.CLIENT_ORIGIN?.trim();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CLIENT_ORIGIN is required in production');
  }

  return DEVELOPMENT_CLIENT_ORIGIN;
}
