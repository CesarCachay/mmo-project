import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';

import type { Request } from 'express';

import { isPlayerAvatarId } from '@cesar-mmo/shared';

import { AccountRequestAuthenticationService } from './account-request-authentication.service';

import { AccountTrainerService } from './account-trainer.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTrainerLimitError(error: unknown): boolean {
  return isRecord(error) && error.code === 'TRAINER_LIMIT_REACHED';
}

@Controller('trainers')
export class AccountTrainerHttpController {
  constructor(
    @Inject(AccountRequestAuthenticationService)
    private readonly accountRequestAuthenticationService: AccountRequestAuthenticationService,

    @Inject(AccountTrainerService)
    private readonly accountTrainerService: AccountTrainerService,
  ) {}

  @Get()
  async listTrainers(@Req() request: Request): Promise<{
    trainers: Array<{
      trainerId: string;
      displayName: string | null;
      avatarId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    const context =
      await this.accountRequestAuthenticationService.requireAuthenticatedAccount(
        request,
      );

    const trainers = await this.accountTrainerService.listTrainers(
      context.account.accountId,
    );

    return {
      trainers: trainers.map((trainer) => ({
        trainerId: trainer.trainerId,
        displayName: trainer.displayName,
        avatarId: trainer.avatarId,
        createdAt: trainer.createdAt,
        updatedAt: trainer.updatedAt,
      })),
    };
  }

  @Post()
  @HttpCode(201)
  async createTrainer(
    @Req()
    request: Request,

    @Body()
    body: unknown,
  ): Promise<{
    trainer: {
      trainerId: string;
      displayName: string | null;
      avatarId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }> {
    const context =
      await this.accountRequestAuthenticationService.requireAuthenticatedAccount(
        request,
      );

    if (!isRecord(body)) {
      throw new BadRequestException('Invalid trainer payload');
    }

    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim() : '';

    const avatarId = body.avatarId;

    if (displayName.length < 3 || displayName.length > 16) {
      throw new BadRequestException(
        'Trainer name must contain between 3 and 16 characters',
      );
    }

    if (!isPlayerAvatarId(avatarId)) {
      throw new BadRequestException('Invalid trainer avatar');
    }

    try {
      const trainer = await this.accountTrainerService.createTrainer({
        accountId: context.account.accountId,

        displayName,
        avatarId,
      });

      return {
        trainer: {
          trainerId: trainer.trainerId,
          displayName: trainer.displayName,
          avatarId: trainer.avatarId,
          createdAt: trainer.createdAt,
          updatedAt: trainer.updatedAt,
        },
      };
    } catch (error: unknown) {
      if (isTrainerLimitError(error)) {
        throw new ConflictException('Trainer limit reached');
      }

      throw error;
    }
  }
}
