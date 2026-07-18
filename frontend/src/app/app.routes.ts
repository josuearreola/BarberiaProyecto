import { Routes } from '@angular/router';
import { TermsOfService } from './pages/terms-of-service/terms-of-service';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { AdminAppointments } from './pages/admin-appointments/admin-appointments';
import { AdminUsers } from './pages/admin-users/admin-users';
import { AdminRoles } from './pages/admin-roles/admin-roles';
import { AdminAudit } from './pages/admin-audit/admin-audit';
import { UserProfile } from './pages/user-profile/user-profile';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: 'terminos-uso',
        component: TermsOfService
    },
    {
        path: 'login',
        component: Login
    },
    {
        path: 'registro',
        component: Register
    },
    {
        path: 'perfil',
        component: UserProfile,
        canActivate: [authGuard]
    },
    {
        path: 'admin/citas',
        component: AdminAppointments,
        canActivate: [adminGuard]
    },
    {
        path: 'admin/usuarios',
        component: AdminUsers,
        canActivate: [adminGuard]
    },
    {
        path: 'admin/roles',
        component: AdminRoles,
        canActivate: [adminGuard]
    },
    {
        path: 'admin/auditoria',
        component: AdminAudit,
        canActivate: [adminGuard]
    },
    {
        path: 'admin',
        redirectTo: 'admin/citas',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: ''
    }
];
