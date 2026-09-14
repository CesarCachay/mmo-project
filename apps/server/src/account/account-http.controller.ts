import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import type { AccountProvider } from './account.types';

import { AccountAuthenticationService } from './account-authentication.service';
import { AccountSessionService } from './account-session.service';
import { AccountGoogleLoginService } from './google/account-google-login.service';

import {
  clearAccountSessionCookie,
  getAccountSessionTokenFromCookieHeader,
  setAccountSessionCookie,
} from './account-session-cookie';

@Controller('auth')
export class AccountHttpController {
  constructor(
    @Inject(AccountAuthenticationService)
    private readonly accountAuthenticationService: AccountAuthenticationService,
    @Inject(AccountSessionService)
    private readonly accountSessionService: AccountSessionService,
    @Inject(AccountGoogleLoginService)
    private readonly accountGoogleLoginService: AccountGoogleLoginService,
  ) {}

  @Post('google')
  @HttpCode(200)
  async loginWithGoogle(
    @Body()
    body: {
      credential?: unknown;
    },

    @Res({ passthrough: true })
    response: Response,
  ): Promise<{
    authenticated: true;
    account: {
      accountId: string;
      provider: AccountProvider;
      email: string | null;
    };
    session: {
      expiresAt: Date;
    };
  }> {
    const result = await this.accountGoogleLoginService.login(body.credential);

    setAccountSessionCookie(response, result.token);

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

  @Get('session')
  async getSession(@Req() request: Request): Promise<{
    authenticated: true;
    account: {
      accountId: string;
      provider: AccountProvider;
      email: string | null;
    };
    session: {
      expiresAt: Date;
    };
  }> {
    const token = getAccountSessionTokenFromCookieHeader(
      request.headers.cookie,
    );

    const context =
      await this.accountAuthenticationService.resolveAuthenticatedAccount(
        token,
      );

    if (!context) {
      throw new UnauthorizedException();
    }

    return {
      authenticated: true,
      account: {
        accountId: context.account.accountId,
        provider: context.account.provider,
        email: context.account.email,
      },
      session: {
        expiresAt: context.session.expiresAt,
      },
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true })
    response: Response,
  ): Promise<{
    success: true;
  }> {
    const token = getAccountSessionTokenFromCookieHeader(
      request.headers.cookie,
    );

    if (token) {
      await this.accountSessionService.revokeSession(token);
    }

    clearAccountSessionCookie(response);

    return {
      success: true,
    };
  }
}
