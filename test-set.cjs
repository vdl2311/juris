const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const config = require('./firebase-applet-config.json');
admin.initializeApp({ projectId: config.projectId });
const db = getFirestore();
db.collection('usuarios').doc('test').set({ hello: 'world' }).then(() => {
  console.log("Success");
  process.exit(0);
}).catch(err => {
  console.error("Err:", err.message);
  process.exit(1);
});
