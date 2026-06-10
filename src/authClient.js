import { supabase } from './supabaseClient.js';

// Same interface the rest of the app already imports — adapter on top of Supabase auth.

export async function initializeIdentity() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export function subscribeToIdentity(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  // If email confirmation is required, data.user is set but session is null.
  // Caller can check `user.emailVerified` analogue — we return user with that hint.
  return { ...data.user, emailVerified: Boolean(data.session) };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export function authMessage(error) {
  if (!error) return '';
  return error.message || error.error_description || String(error);
}
