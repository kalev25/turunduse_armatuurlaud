// Import Firebase Admin SDK
const admin = require('firebase-admin');

// Import your service account key (make sure this file is in the root of your project)
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get a Firestore instance
const db = admin.firestore();

// Path to your JSON data file
const data = require('./marketingData.json');

// Collection name in Firestore
const collectionName = 'marketingData';

async function importMarketingData() {
  console.log(`Starting data import to collection "${collectionName}"...`);
  let batch = db.batch();
  let counter = 0;

  for (const item of data) {
    // We use the 'date' field as part of the document ID for easier querying and overwriting
    // For this example, we'll use date to make it identifiable
    const docRef = db.collection(collectionName).doc(item.date.replace(/-/g, '')); // e.g., "20240301"

    batch.set(docRef, item);
    counter++;

    // Firestore batches are limited to 500 operations
    if (counter % 499 === 0) {
      console.log(`Committing batch ${counter / 499}...`);
      await batch.commit();
      batch = db.batch(); // Start a new batch
    }
  }

  // Commit any remaining operations in the last batch
  if (counter % 499 !== 0 || counter === 0) {
    console.log(`Committing final batch of ${counter % 499} items...`);
    await batch.commit();
  }

  console.log(`Successfully imported ${counter} documents to "${collectionName}".`);
}

// Run the import function
importMarketingData().catch(error => {
  console.error("Error importing data:", error);
  process.exit(1);
});

