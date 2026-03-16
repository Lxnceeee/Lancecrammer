const CONTACTS_DOC_ID = 'SrFWuIv44cGOlebEbPdn';

const firebaseConfig = {
  apiKey: 'AIzaSyAy1YEgDjJmspWYfFTREe7R0J_O00SsJ8g',
  authDomain: 'smsblasting-bd6d2.firebaseapp.com',
  projectId: 'smsblasting-bd6d2',
  storageBucket: 'smsblasting-bd6d2.firebasestorage.app',
  messagingSenderId: '182875332715',
  appId: '1:182875332715:web:ed2f2ebba268f40528912e'
};

const stubProvider = {
  ready: Promise.resolve(),
  fetchContacts: async () => null,
  saveContacts: async () => {},
  enabled: false
};

window.firebaseContacts = stubProvider;

(async () => {
  try {
    const firebaseAppModule = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js');
    const firestoreModule = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js');
    const { initializeApp } = firebaseAppModule;
    const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = firestoreModule;

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const contactsDoc = doc(db, 'contacts', CONTACTS_DOC_ID);

    const provider = {
      ready: (async () => {
        await getDoc(contactsDoc);
        return provider;
      })(),
      async fetchContacts() {
        const snapshot = await getDoc(contactsDoc);
        if (!snapshot.exists()) {
          return { students: [], parents: [] };
        }
        const data = snapshot.data() || {};
        if (!Array.isArray(data.students) && !Array.isArray(data.parents) && Array.isArray(data.contacts)) {
          return { students: data.contacts, parents: [] };
        }
        return {
          students: Array.isArray(data.students) ? data.students : [],
          parents: Array.isArray(data.parents) ? data.parents : []
        };
      },
      async saveContacts(payload) {
        if (!payload || typeof payload !== 'object') return;
        await setDoc(
          contactsDoc,
          {
            ...payload,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      },
      enabled: true
    };

    window.firebaseContacts = provider;
    console.log('Firebase contacts sync enabled.');
  } catch (err) {
    console.error('Failed to initialize Firebase contacts:', err);
    window.firebaseContacts = stubProvider;
  }
})();
