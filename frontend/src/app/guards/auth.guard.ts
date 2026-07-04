import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.user$.pipe(
    switchMap((user) => (user ? of(user) : authService.loadSession())),
    map((user) => (user ? true : router.createUrlTree(['/login'])))
  );
};
