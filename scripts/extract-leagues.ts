import fs from 'fs';
import path from 'path';

// Types pour les schémas existants
interface League {
  id: string;
  name: string;
  sport: string;
}

interface LeagueSeason {
  id: string;
  leagueId: string;
  year: number;
}

// Type de l'API Externe (Source de données)
interface ExternalLeagueAPI {
  competition_id: number;
  competition_name: string;
  sport_type: string;
  current_season_year: number;
  current_season_id: string;
}

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'staging', 'source-leagues.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'exports', 'matching.json');

async function main() {
  console.log("🚀 Lancement de l'extraction des données...");

  // 1. Lire les données sources (simulation d'un appel API avec fs.readFileSync)
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Fichier source introuvable: ${SOURCE_FILE}`);
    process.exit(1);
  }

  const rawData: ExternalLeagueAPI[] = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  console.log(`✅ ${rawData.length} ligues récupérées depuis la source de données.`);

  // 2. Préparer les tableaux de sortie avec les types stricts
  const leagues: League[] = [];
  const leagueSeasons: LeagueSeason[] = [];

  // 3. Transformation / Mapping
  for (const item of rawData) {
    const leagueId = `league_${item.competition_id}`;

    // On crée ou met à jour la Ligue
    leagues.push({
      id: leagueId,
      name: item.competition_name,
      sport: item.sport_type,
    });

    // On lie la Saison de cette ligue
    leagueSeasons.push({
      id: `season_${item.current_season_id}`,
      leagueId: leagueId,
      year: item.current_season_year,
    });
  }

  // 4. Écriture dans le fichier matching
  // (Note: on pourrait le mettre dans raw.json d'abord, on va écrire dans matching.json ici)
  const outputData = {
    leagues,
    leagueSeasons
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));

  console.log(`✅ Mapping terminé : ${leagues.length} ligues et ${leagueSeasons.length} saisons créées.`);
  console.log(`➡️  Résultat extrait dans: ${OUTPUT_FILE}`);
}

main().catch(error => {
  console.error("❌ Erreur lors de l'extraction:", error);
});
