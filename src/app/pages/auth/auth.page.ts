import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, NavController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { errorMessage } from '../../services/errors';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
  templateUrl: './auth.page.html',
})
export class AuthPage {
  isRegister = false;
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  busy = false;
  error = '';

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private nav: NavController,
  ) {}

  ionViewWillEnter(): void {
    this.isRegister = !!this.route.snapshot.data['register'];
    this.password = '';
    this.confirmPassword = '';
    this.error = '';
    if (this.auth.isLoggedIn) void this.router.navigateByUrl('/app', { replaceUrl: true });
  }

  async submit(form: NgForm): Promise<void> {
    if (form.invalid || this.busy) return;
    this.error = '';
    if (this.isRegister && this.password !== this.confirmPassword) {
      this.error = 'Your passwords do not match.';
      return;
    }
    this.busy = true;
    try {
      if (this.isRegister) await this.auth.register(this.email, this.password);
      else await this.auth.login(this.email, this.password);
      this.password = '';
      this.confirmPassword = '';
      await this.nav.navigateRoot('/app', { replaceUrl: true });
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.busy = false;
    }
  }
}
