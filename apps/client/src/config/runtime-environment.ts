const DEVELOPMENT_API_URL = "http://localhost:3000";

export type ClientRuntimeEnvironment = {
  readonly apiUrl?: string;
  readonly production: boolean;
};

function getBrowserRuntimeEnvironment(): ClientRuntimeEnvironment {
  return {
    apiUrl: import.meta.env.VITE_API_URL,
    production: import.meta.env.PROD,
  };
}

export function resolveApiBaseUrl(
  explicitBaseUrl?: string,
  environment: ClientRuntimeEnvironment = getBrowserRuntimeEnvironment(),
): string {
  const explicitUrl = explicitBaseUrl?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const configuredUrl = environment.apiUrl?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  if (environment.production) {
    throw new Error("VITE_API_URL is required in production");
  }

  return DEVELOPMENT_API_URL;
}
