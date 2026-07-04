import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return router.createUrlTree(['/login']);
  }

  return authService.user$.pipe(
    switchMap((user) => (user ? of(user) : authService.loadSession())),
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/login']);
      }

      return user.role === 'admin'
        ? true
        : router.createUrlTree(['/']);
    })
  );
};
