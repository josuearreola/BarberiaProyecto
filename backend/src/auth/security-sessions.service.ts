import { Injectable } from '@nestjs/common';

@Injectable()
export class SecuritySessionsService {
  private readonly revokeAllByUser = new Map<number, number>();

  revokeAll(userId: number): number {
    const now = Date.now();
    this.revokeAllByUser.set(userId, now);
    return now;
  }

  isSessionRevoked(userId: number, loginAt?: number): boolean {
    const revokedAt = this.revokeAllByUser.get(userId);
    if (!revokedAt) {
      return false;
    }

    if (!loginAt) {
      return true;
    }

    return loginAt <= revokedAt;
  }
}
