import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCuKp6puEvFePOkYL_56UdZG6lASF4B9k0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "attendance-geofence-6f00b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "attendance-geofence-6f00b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "attendance-geofence-6f00b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "115222764354",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:115222764354:web:af4735d65cca764ecf86db",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9118VRC721"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Friendly error message mapper for Firebase Auth codes
 */
export function getFirebaseErrorMessage(error) {
  if (!error) return 'An unknown authentication error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered in Firebase. Please sign in or use Google Sign-In.';
    case 'auth/invalid-email':
      return 'The email address is improperly formatted. Please enter a valid email.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In popup was closed before completing authentication.';
    case 'auth/cancelled-popup-request':
      return 'Google Sign-In request was cancelled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Access is temporarily disabled. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please sign in again.';
    default:
      return error.message || 'Authentication failed. Please check your credentials.';
  }
}

/**
 * Trigger Google Sign-In via Popup
 * @returns {Promise<{ success: boolean, email: string, name: string, photoURL?: string, idToken?: string, uid: string }>}
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const idToken = await user.getIdToken();

  return {
    success: true,
    email: user.email.toLowerCase(),
    name: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL,
    idToken,
    uid: user.uid,
    provider: 'firebase_google'
  };
}

/**
 * Register with Email and Password, and send verification email
 */
export async function registerWithEmailPassword(email, password) {
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    // If account already exists in Firebase, attempt to sign in to check/resend verification
    if (err.code === 'auth/email-already-in-use') {
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (signInErr) {
        throw new Error(getFirebaseErrorMessage(err));
      }
    } else {
      throw new Error(getFirebaseErrorMessage(err));
    }
  }

  const user = userCredential.user;

  // Send verification email if not already verified
  if (!user.emailVerified) {
    await sendEmailVerification(user);
  }

  return {
    user,
    emailVerified: user.emailVerified,
    message: user.emailVerified
      ? 'Email is already verified!'
      : `Verification link sent to ${email}. Please check your inbox and tap the link to verify.`
  };
}

/**
 * Reload current Firebase user and check if email is verified
 */
export async function checkEmailVerified() {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  return auth.currentUser.emailVerified;
}

/**
 * Resend verification email to current user
 */
export async function resendVerificationEmail() {
  if (!auth.currentUser) {
    throw new Error('No active user session to send verification email to.');
  }
  await sendEmailVerification(auth.currentUser);
}

export {
  app,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
};

export default app;
