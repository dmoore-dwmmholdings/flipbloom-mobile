import { initializeApp } from 'firebase/app'
import { initializeAuth, getReactNativePersistence } from '@firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
