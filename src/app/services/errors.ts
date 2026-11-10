import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
  if (error.status === 0)
    return 'We could not connect. Check your internet connection and try again.';
  const code = error.error?.error?.message || '';
  if (code.includes('EMAIL_EXISTS'))
    return 'An account already uses this email. Please log in instead.';
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(code))
    return 'The email or password is incorrect.';
  if (code.includes('WEAK_PASSWORD')) return 'Choose a password with at least 6 characters.';
  if (code.includes('INVALID_EMAIL')) return 'Please enter a valid email address.';
  if (/TOO_MANY_ATTEMPTS|TOO_MANY_REQUESTS/.test(code))
    return 'Too many attempts. Please wait a little and try again.';
  if (/OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(code))
    return 'Set up Firebase Authentication and enable Email/Password sign-in in the Firebase console.';
  if (code.includes('USER_DISABLED')) return 'This account has been disabled.';
  if (/SERVICE_DISABLED|has not been used|database.*does not exist/i.test(code))
    return 'Create the Firestore database in your Firebase console, then try again.';
  if (error.status === 403)
    return 'Access was denied. Check that Firestore rules allow the signed-in owner to access their records.';
  if (error.status === 404) return 'This item could not be found.';
  if (error.status === 429) return 'The service limit was reached. Please try again later.';
  if (code.includes('Upload preset'))
    return 'Photo upload failed. Check that the Cloudinary petcare preset exists and is unsigned.';
  if (error.url?.includes('cloudinary'))
    return 'The photo could not be uploaded. Please try another JPG, PNG, or WebP image.';
  return 'We could not save or load your information. Please try again.';
}
