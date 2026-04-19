import { initializeApp } from 'firebase/app'
import { initializeAuth } from '@firebase/auth'
import type { Persistence } from '@firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

// getReactNativePersistence is only exported from the RN build of @firebase/auth,
// but TypeScript resolves the 'types' condition before 'react-native', so we load it at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence
}
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  increment,
  orderBy,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyD0i3D0y-dk9UBn2cG_Zi10qvHX1Q161wE',
  authDomain: 'flipbloom-8c388.firebaseapp.com',
  projectId: 'flipbloom-8c388',
  storageBucket: 'flipbloom-8c388.appspot.com',
  messagingSenderId: '896313547888',
  appId: '1:896313547888:web:3047ec8674b1936f5b28b5',
}

const app = initializeApp(firebaseConfig)

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
})
export const db = getFirestore(app)

export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  increment,
  orderBy,
}
