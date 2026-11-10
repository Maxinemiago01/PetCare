import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink, IonContent, IonIcon],
  template: `
    <ion-content
      ><main class="privacy-page">
        <a class="brand" [routerLink]="auth.isLoggedIn ? '/app' : '/login'"
          ><img src="assets/paw.png" alt="" /><span>petcare.</span></a
        >
        <a class="back-link" [routerLink]="auth.isLoggedIn ? '/app' : '/login'"
          ><ion-icon name="arrow-back" aria-hidden="true" /> Back to my notebook</a
        >
        <h1>Privacy & demo terms</h1>
        <p>Petcare is a school demonstration for organizing pet information.</p>
        <section>
          <h2>What is saved</h2>
          <p>
            Your account email and sign-in information are handled by Supabase Auth. Pet profiles
            and care records are saved in Supabase under your account. This app does not store your
            password in its database. You can use a made-up email address as your login ID. This
            demo sends no verification or recovery emails, so remember your password.
          </p>
        </section>
        <section>
          <h2>Pet photos</h2>
          <p>
            Profile photos are uploaded to private Supabase Storage. The app displays them using
            temporary links that work for one hour. Anyone who has a temporary link can view that
            photo until the link expires. Upload only photos you have permission to use, and avoid
            photos containing private documents or personal information.
          </p>
        </section>
        <section>
          <h2>Your browser session</h2>
          <p>
            The app keeps sign-in tokens in your browser’s session storage so you can move between
            pages. Logging out clears the saved session. Treat access to an open, signed-in browser
            tab as access to your notebook.
          </p>
        </section>
        <section>
          <h2>Editing and removal</h2>
          <p>
            You can edit or delete your pets and care records in the app. Deleting a pet also
            removes its care records. Replaced or removed photo files remain private in Supabase
            Storage until the project owner removes them from that account.
          </p>
        </section>
        <section>
          <h2>Using this demo</h2>
          <p>
            Keep a separate copy of information you need. Entries are personal notes, and this
            school demo does not provide veterinary care. Use the app responsibly and add only
            information and images you are entitled to use.
          </p>
        </section>
      </main></ion-content
    >
  `,
})
export class PrivacyPage {
  constructor(public auth: AuthService) {}
}
