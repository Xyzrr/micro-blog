// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: 'AIzaSyBKQLX0Eq7YEf-EYRnHzVjyXEeCLhC9jAg',
	authDomain: 'microblog-27e1d.firebaseapp.com',
	projectId: 'microblog-27e1d',
	storageBucket: 'microblog-27e1d.appspot.com',
	messagingSenderId: '1080997036457',
	appId: '1:1080997036457:web:d542438875f6cb99b404b8'
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
