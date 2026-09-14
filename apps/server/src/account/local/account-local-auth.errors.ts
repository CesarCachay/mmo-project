export type LocalAccountRegistrationErrorCode =
  'INVALID_LOGIN_ID' | 'INVALID_PASSWORD' | 'ACCOUNT_ALREADY_EXISTS';

export class LocalAccountRegistrationError extends Error {
  constructor(
    readonly code: LocalAccountRegistrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LocalAccountRegistrationError';
  }
}

export type LocalAccountLoginErrorCode = 'INVALID_CREDENTIALS';

export class LocalAccountLoginError extends Error {
  constructor(
    readonly code: LocalAccountLoginErrorCode,
    message = 'Invalid login id or password',
  ) {
    super(message);

    this.name = 'LocalAccountLoginError';
  }
}
