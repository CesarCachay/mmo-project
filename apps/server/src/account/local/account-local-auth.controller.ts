import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';

import type { Response } from 'express';

import { setAccountSessionCookie } from '../account-session-cookie';

import {
  LocalAccountLoginError,
  LocalAccountRegistrationError,
} from './account-local-auth.errors';

import { AccountLocalLoginService } from './account-local-login.service';

import { AccountLocalRegistrationService } from './account-local-registration.service';

interface LocalAuthRequestBody {
  readonly loginId?: unknown;
  readonly password?: unknown;
}

interface LocalAuthResponse {
  readonly authenticated: true;

  readonly account: {
    readonly accountId: string;
    readonly provider: 'LOCAL';
    readonly email: string | null;
  };

  readonly session: {
    readonly expiresAt: Date;
  };
}

@Controller('auth')
export class AccountLocalAuthController {
  constructor(
    @Inject(AccountLocalRegistrationService)
    private readonly registrationService: AccountLocalRegistrationService,

    @Inject(AccountLocalLoginService)
    private readonly loginService: AccountLocalLoginService,
  ) {}

  @Post('register')
  async register(
    @Body()
    body: LocalAuthRequestBody,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<LocalAuthResponse> {
    try {
      const result = await this.registrationService.register({
        loginId: typeof body.loginId === 'string' ? body.loginId : '',
        password: typeof body.password === 'string' ? body.password : '',
      });

      setAccountSessionCookie(response, result.token);

      return this.toResponse(result);
    } catch (error) {
      if (error instanceof LocalAccountRegistrationError) {
        if (error.code === 'ACCOUNT_ALREADY_EXISTS') {
          throw new ConflictException(error.message);
        }

        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    body: LocalAuthRequestBody,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<LocalAuthResponse> {
    try {
      const result = await this.loginService.login({
        loginId: typeof body.loginId === 'string' ? body.loginId : '',
        password: typeof body.password === 'string' ? body.password : '',
      });

      setAccountSessionCookie(response, result.token);

      return this.toResponse(result);
    } catch (error) {
      if (error instanceof LocalAccountLoginError) {
        throw new UnauthorizedException('Invalid login id or password');
      }

      throw error;
    }
  }

  private toResponse(result: {
    account: {
      accountId: string;
      provider: 'LOCAL';
      email: string | null;
    };
    session: {
      expiresAt: Date;
    };
  }): LocalAuthResponse {
    return {
      authenticated: true,
      account: {
        accountId: result.account.accountId,
        provider: result.account.provider,
        email: result.account.email,
      },
      session: {
        expiresAt: result.session.expiresAt,
      },
    };
  }
}
