import { PrismaService } from '../database/prisma.service';
import { AccountRepository } from '../account/account.repository';
import { AccountService } from '../account/account.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();

  await prisma.onModuleInit();

  try {
    const repository = new AccountRepository(prisma);
    const service = new AccountService(repository);

    const providerUserId = `account-smoke-${globalThis.crypto.randomUUID()}`;

    const first = await service.resolveProviderAccount({
      provider: 'GOOGLE',
      providerUserId,
      email: 'ACCOUNT-SMOKE@EXAMPLE.COM',
    });

    const second = await service.resolveProviderAccount({
      provider: 'GOOGLE',
      providerUserId,
      email: 'account-smoke@example.com',
    });

    if (first.accountId !== second.accountId) {
      throw new Error(
        'Account upsert created two Accounts for the same provider identity',
      );
    }

    if (second.email !== 'account-smoke@example.com') {
      throw new Error(`Unexpected persisted email: ${second.email}`);
    }

    console.log('ACCOUNT PERSISTENCE SMOKE ✅', {
      accountId: second.accountId,
      provider: second.provider,
      providerUserId: second.providerUserId,
      email: second.email,
    });

    await prisma.account.delete({
      where: {
        id: second.accountId,
      },
    });
  } finally {
    await prisma.onModuleDestroy();
  }
}

void main();
