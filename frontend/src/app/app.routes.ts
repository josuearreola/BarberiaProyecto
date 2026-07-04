import { Routes } from '@angular/router';
import { TermsOfService } from './pages/terms-of-service/terms-of-service';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { AdminAppointments } from './pages/admin-appointments/admin-appointments';
import { adminGuard } from './guards/admin.guard';

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
        path: 'admin/citas',
        redirectTo: 'admin',
        pathMatch: 'full'
    },
    {
        path: 'admin',
        component: AdminAppointments,
        canActivate: [adminGuard]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
