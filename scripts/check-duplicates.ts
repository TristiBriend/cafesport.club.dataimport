import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');

function checkDuplicates(filePath: string) {
    if (!fs.existsSync(filePath)) return;

    console.log(`\n🔍 Analyse de ${path.basename(filePath)}...`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!data.events || !Array.isArray(data.events)) {
        console.log("❌ Pas de collection 'events' trouvée.");
        return;
    }

    const ids = data.events.map((e: any) => e.id);
    const uniqueIds = new Set(ids);
    const duplicateCount = ids.length - uniqueIds.size;

    if (duplicateCount > 0) {
        console.log(`⚠️  DOUBLONS TROUVÉS : ${duplicateCount} matchs dupliqués sur ${ids.length} total.`);

        // Identifier quelques exemples
        const seen = new Set();
        const dupes = ids.filter((id: string) => {
            if (seen.has(id)) return true;
            seen.add(id);
            return false;
        });

        console.log(`👉 Exemple d'IDs dupliqués : ${dupes.slice(0, 3).join(', ')}`);
    } else {
        console.log(`✅ Aucun doublon détecté sur les ${ids.length} matchs.`);
    }
}

const files = fs.readdirSync(EXPORTS_DIR)
    .filter(f => f.endsWith('.json') && (f.startsWith('wc') || f.startsWith('ligue1')))
    .map(f => path.join(EXPORTS_DIR, f));

console.log("🚀 Lancement de l'analyse des doublons d'événements...");
files.forEach(checkDuplicates);
