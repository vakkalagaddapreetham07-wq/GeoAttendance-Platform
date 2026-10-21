/**
 * Firebase Client Authentication Service (Modular SDK)
 * Re-exports initialized Auth instance, providers, and helper functions
 */

export {
  app,
  auth,
  googleProvider,
  signInWithGoogle,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  registerWithEmailPassword,
  checkEmailVerified,
  resendVerificationEmail,
  getFirebaseErrorMessage
} from '../firebase';

export { default } from '../firebase';
