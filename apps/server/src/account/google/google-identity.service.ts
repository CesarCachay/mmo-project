import { Injectable, UnauthorizedException } from '@nestjs/common';

import { OAuth2Client } from 'google-auth-library';

import type { VerifiedGoogleIdentity } from './google-identity.types';

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();

  async verifyCredential(credential: unknown): Promise<VerifiedGoogleIdentity> {
    if (typeof credential !== 'string' || !credential.trim()) {
      throw new UnauthorizedException('Invalid Google credential');
    }

    const clientId = this.getGoogleClientId();

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential.trim(),
        audience: clientId,
      });

      const payload = ticket.getPayload();

      const providerUserId = payload?.sub?.trim();

      if (!providerUserId) {
        throw new UnauthorizedException('Invalid Google identity');
      }

      const email = payload?.email?.trim().toLowerCase() || null;

      return {
        provider: 'GOOGLE',
        providerUserId,
        email,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid Google credential');
    }
  }

  private getGoogleClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }

    return clientId;
  }
}
