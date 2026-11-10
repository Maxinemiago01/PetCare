import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [DatePipe, RouterLink, RouterLinkActive, RouterOutlet, IonContent, IonIcon],
  templateUrl: './shell.page.html',
})
export class ShellPage {
  now = new Date();
  constructor(
    public auth: AuthService,
    private nav: NavController,
  ) {}
  logout(): void {
    this.auth.logout();
    void this.nav.navigateRoot('/login', { replaceUrl: true });
  }
}
