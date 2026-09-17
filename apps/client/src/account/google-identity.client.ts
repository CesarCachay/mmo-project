type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;

  renderButton(
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "signin_with";
      shape: "rectangular";
      logo_alignment: "left";
      width: number;
    }
  ): void;
};

type GoogleGlobal = {
  accounts: {
    id: GoogleIdentityApi;
  };
};

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

const GOOGLE_SCRIPT_ID = "google-identity-services";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let googleScriptPromise: Promise<GoogleGlobal> | undefined;

let initializedClientId: string | undefined;

let credentialHandler: ((credential: string) => void) | undefined;

function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");
  }

  return clientId;
}

async function loadGoogleIdentityServices(): Promise<GoogleGlobal> {
  if (window.google) {
    return window.google;
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<GoogleGlobal>((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => {
            if (window.google) {
              resolve(window.google);
              return;
            }

            reject(new Error("Google Identity Services did not initialize"));
          },
          {
            once: true,
          }
        );

        return;
      }

      const script = document.createElement("script");

      script.id = GOOGLE_SCRIPT_ID;

      script.src = GOOGLE_SCRIPT_URL;

      script.async = true;
      script.defer = true;

      script.addEventListener(
        "load",
        () => {
          if (!window.google) {
            reject(new Error("Google Identity Services did not initialize"));

            return;
          }

          resolve(window.google);
        },
        {
          once: true,
        }
      );

      script.addEventListener(
        "error",
        () => {
          googleScriptPromise = undefined;

          reject(new Error("Could not load Google Identity Services"));
        },
        {
          once: true,
        }
      );

      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

export class GoogleIdentityClient {
  async renderSignInButton(
    container: HTMLElement,
    onCredential: (credential: string) => void
  ): Promise<void> {
    credentialHandler = onCredential;

    const google = await loadGoogleIdentityServices();

    const clientId = getGoogleClientId();

    if (!initializedClientId) {
      google.accounts.id.initialize({
        client_id: clientId,

        callback: (response: GoogleCredentialResponse) => {
          const credential = response.credential?.trim();

          if (!credential) {
            return;
          }

          credentialHandler?.(credential);
        },
      });

      initializedClientId = clientId;
    } else if (initializedClientId !== clientId) {
      throw new Error("Google Identity Services was initialized with another client id");
    }

    container.replaceChildren();

    const availableWidth = container.clientWidth;
    const buttonWidth = Math.max(200, Math.min(320, availableWidth || 256));

    google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: buttonWidth,
    });
  }
}
