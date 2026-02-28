import fs from 'fs';
import path from 'path';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Chargement des variables d'environnement (optionnel, selon config)
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '..');
const inputArg = process.argv[2] || 'exports/ligue1-2025.json';
const IMPORT_FILE = path.resolve(ROOT_DIR, inputArg);
const SERVICE_ACCOUNT_PATH = path.join(ROOT_DIR, 'serviceAccountKey.json');

// 1. Initialisation de Firebase Admin
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Fichier serviceAccountKey.json introuvable !');
    console.error('👉 Allez sur la console Firebase > Paramètres du projet > Comptes de service > Générer une nouvelle clé privée.');
    console.error('👉 Placez le fichier téléchargé à la racine du projet sous le nom "serviceAccountKey.json".');
    console.error('⚠️ ASSUREZ-VOUS QUE CE FICHIER EST BIEN DANS VOTRE .gitignore !');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. Fonction principale d'import
async function main() {
    console.log(`🚀 Lancement de l'import Firestore à partir de ${inputArg}...`);

    if (!fs.existsSync(IMPORT_FILE)) {
        console.error(`❌ Fichier ${IMPORT_FILE} introuvable.`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8'));
    const collections = Object.keys(data);
    let totalImported = 0;

    for (const collectionName of collections) {
        const records = data[collectionName];
        if (!Array.isArray(records) || records.length === 0) {
            console.log(`⏭️ Collection ${collectionName} vide. Ignorée.`);
            continue;
        }

        console.log(`⏳ Importation de la collection "${collectionName}" (${records.length} documents)...`);

        // Batched Writes (Firestore accepte max 500 opérations par batch)
        const BATCH_SIZE = 450;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = records.slice(i, i + BATCH_SIZE);

            for (const item of chunk) {
                // ID par défaut ou Auto-ID
                // On cherche une clé unique (id, eventId pour les relations, etc.)
                // Note: EventTeam n'a pas de champ `id`, il a `eventId`. On doit s'assurer que l'ID du document Firestore est unique
                let docId = item.id;
                if (!docId) {
                    // Pour les tables de liaison (EventTeams, AthleteParticipation) qui n'ont pas d'id défini
                    if (collectionName === "eventTeams" && item.eventId) {
                        docId = `et_${item.eventId}`;
                    } else if (collectionName === "athleteParticipation" && item.eventId) {
                        docId = `ap_${item.eventId}`;
                    } else {
                        docId = db.collection(collectionName).doc().id; // Auto gen
                    }
                }

                const docRef = db.collection(collectionName).doc(docId);
                batch.set(docRef, item, { merge: true }); // Merge true permet d'écraser/updater
            }

            await batch.commit();
            totalImported += chunk.length;
            console.log(`  -> ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} insérés dans ${collectionName}`);
        }
        console.log(`✅ Collection "${collectionName}" importée avec succès.`);
    }

    console.log(`🎉 IMPORT TERMINÉ ! Total de documents importés : ${totalImported}`);
    process.exit(0);
}

main().catch(error => {
    console.error('❌ Erreur lors de l\'importation Firestore :', error);
    process.exit(1);
});
