import fs from 'fs';
import path from 'path';

const FOOT_EXPORTS = path.resolve(__dirname, '..', 'exports');

const files = fs.readdirSync(FOOT_EXPORTS).filter(f => f.endsWith('.json'));

const allTeams = new Map<string, { files: string[], data: any }>();

files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(FOOT_EXPORTS, file), 'utf8'));
    if (data.teams) {
        data.teams.forEach((team: any) => {
            if (!allTeams.has(team.id)) {
                allTeams.set(team.id, { files: [file], data: team });
            } else {
                allTeams.get(team.id)!.files.push(file);
            }
        });
    }
});

console.log("🔍 Analyse des équipes à travers tous les fichiers exports...");

const duplicates = Array.from(allTeams.entries()).filter(([_, info]) => info.files.length > 1);

if (duplicates.length === 0) {
    console.log("✅ Aucune équipe partagée entre les fichiers (IDs uniques partout).");
} else {
    console.log(`⚠️  ${duplicates.length} équipes sont présentes dans plusieurs fichiers :`);
    duplicates.slice(0, 10).forEach(([id, info]) => {
        console.log(`- [${id}] "${info.data.name}" présent dans : ${info.files.join(', ')}`);
    });
    if (duplicates.length > 10) console.log(`... et ${duplicates.length - 10} autres.`);
}

console.log("\n💡 Comment c'est géré lors de l'import ?");
console.log("Grâce à ton système d'ID 'tm_nom-de-pays', ces doublons sont une FORCE :");
console.log("1. Firestore utilisera l'ID comme chemin unique.");
console.log("2. Quand tu importeras WC2022, il créera 'tm_france'.");
console.log("3. Quand tu importeras WC2018, il verra 'tm_france' et mettra simplement à jour ses infos au lieu d'en créer un nouveau.");
console.log("4. Résultat : Ta base Firestore reste parfaitement propre avec 1 seul document par équipe.");
