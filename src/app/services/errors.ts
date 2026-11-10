import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse))
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  if (error.status === 0)
    return 'We could not connect. Check your internet connection and try again.';
  const body = error.error || {};
  const code = body.error_code || body.code || '';
  const message = body.message || body.error_description || body.error || '';
  if (code === 'invalid_credentials') return 'The email or password is incorrect.';
  if (code === 'email_not_confirmed')
    return 'This account still requires email confirmation. Please ask the project owner to confirm it for this demo.';
  if (['user_already_exists', 'email_exists'].includes(code))
    return 'An account already uses this email. Please log in instead.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.';
  if (['email_address_invalid', 'validation_failed'].includes(code))
    return 'Please check your email address and password.';
  if (code === 'signup_disabled' || code === 'email_provider_disabled')
    return 'Account registration is currently unavailable.';
  if (
    [
      'refresh_token_not_found',
      'refresh_token_already_used',
      'bad_jwt',
      'session_not_found',
    ].includes(code) ||
    error.status === 401
  )
    return 'Your session is no longer valid. Please log out and log in again.';
  if (code === 'PGRST205' || code === '42P01')
    return 'The notebook database has not been set up yet. Please contact the project owner.';
  if (code === 'PGRST204')
    return 'The notebook database needs an update. Please contact the project owner.';
  if (code === '42501' || error.status === 403)
    return 'You do not have permission to access this notebook. Please log in again.';
  if (code === '23503') return 'This pet profile no longer exists. Please reload the notebook.';
  if (['23514', '22007', '22008'].includes(code))
    return 'Please check the dates and details you entered.';
  if (error.status === 429) return 'Too many requests. Please wait a little and try again.';
  if (error.status === 413) return 'This photo is too large. Please choose a smaller image.';
  if (error.url?.includes('/storage/v1/')) {
    if (String(message).toLowerCase().includes('bucket'))
      return 'Photo storage has not been set up yet. Please contact the project owner.';
    return 'The photo could not be loaded or uploaded. Please try again.';
  }
  if (error.status === 404) return 'This item could not be found.';
  return 'We could not save or load your information. Please try again.';
}
