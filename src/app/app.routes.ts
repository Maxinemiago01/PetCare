import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: 'login', loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage) },
  {
    path: 'register',
    data: { register: true },
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy.page').then((m) => m.PrivacyPage),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./pages/shell/shell.page').then((m) => m.ShellPage),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'pets/new',
        loadComponent: () => import('./pages/pet-form/pet-form.page').then((m) => m.PetFormPage),
      },
      {
        path: 'pets/:id/edit',
        loadComponent: () => import('./pages/pet-form/pet-form.page').then((m) => m.PetFormPage),
      },
      {
        path: 'pets/:id',
        loadComponent: () =>
          import('./pages/pet-detail/pet-detail.page').then((m) => m.PetDetailPage),
      },
      {
        path: 'reminders',
        loadComponent: () =>
          import('./pages/reminders/reminders.page').then((m) => m.RemindersPage),
      },
    ],
  },
  { path: '**', redirectTo: 'app' },
];
