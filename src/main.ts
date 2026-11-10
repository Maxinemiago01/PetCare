import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  paw,
  heart,
  calendar,
  add,
  arrowBack,
  arrowForward,
  pencil,
  trash,
  close,
  logOut,
  search,
  camera,
  checkmark,
  medical,
  chevronForward,
  eye,
  eyeOff,
  refresh,
  mail,
  documentText,
  female,
  male,
} from 'ionicons/icons';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

addIcons({
  paw,
  heart,
  calendar,
  add,
  arrowBack,
  arrowForward,
  pencil,
  trash,
  close,
  logOut,
  search,
  camera,
  checkmark,
  medical,
  chevronForward,
  eye,
  eyeOff,
  refresh,
  mail,
  documentText,
  female,
  male,
});

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular({ mode: 'md', animated: false }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes),
    provideHttpClient(),
  ],
}).catch((error) => console.error(error));
