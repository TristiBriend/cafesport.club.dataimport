import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ROOT_DIR = path.resolve(__dirname, '..');
const inputArg = process.argv[2] || 'exports/ligue1-2025.json';
const MATCHING_FILE = path.resolve(ROOT_DIR, inputArg);
const VALIDATION_FILE = path.join(ROOT_DIR, 'exports', 'validation.json');
const SCHEMA_DIR = path.join(ROOT_DIR, 'schemas');

async function main() {
    console.log(`🛡️ Lancement de la validation V2 sur ${inputArg}...`);

    if (!fs.existsSync(MATCHING_FILE)) {
        console.error(`❌ Fichier ${MATCHING_FILE} introuvable.`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(MATCHING_FILE, 'utf8'));

    const validationReport = {
        errors: [] as any[],
        warnings: [] as any[]
    };

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    function validateCollection(collectionName: string, schemaFileName: string) {
        if (data[collectionName] && Array.isArray(data[collectionName])) {
            console.log(`🔍 Validation de ${data[collectionName].length} elements dans ${collectionName}...`);
            const schemaPath = path.join(SCHEMA_DIR, schemaFileName);

            if (fs.existsSync(schemaPath)) {
                const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
                const validate = ajv.compile(schema);

                data[collectionName].forEach((item: any, index: number) => {
                    const valid = validate(item);
                    if (!valid) {
                        validationReport.errors.push({
                            entity: collectionName,
                            index: index,
                            id: item.id || item.eventId || item.userId || 'N/A',
                            issues: validate.errors
                        });
                    }
                });
            } else {
                console.warn(`⚠️ Schéma ${schemaFileName} introuvable.`);
            }
        }
    }

    // Les 16 collections de la V2
    validateCollection('competitionCatalog', 'competitionCatalog-schema.json');
    validateCollection('seasonCatalog', 'seasonCatalog-schema.json');
    validateCollection('leagues', 'league-schema.json');
    validateCollection('leagueSeasons', 'leagueSeason-schema.json');
    validateCollection('events', 'event-schema.json');
    validateCollection('teams', 'team-schema.json');
    validateCollection('eventTeams', 'eventTeam-schema.json');
    validateCollection('athletes', 'athlete-schema.json');
    validateCollection('athleteParticipation', 'athleteParticipation-schema.json');
    validateCollection('users', 'user-schema.json');
    validateCollection('comments', 'comment-schema.json');
    validateCollection('curatedLists', 'curatedList-schema.json');
    validateCollection('activitySamples', 'activitySample-schema.json');
    validateCollection('tagCatalog', 'tagCatalog-schema.json');
    validateCollection('objectTags', 'objectTag-schema.json');
    validateCollection('objectTagVotes', 'objectTagVote-schema.json');

    fs.writeFileSync(VALIDATION_FILE, JSON.stringify(validationReport, null, 2));

    if (validationReport.errors.length > 0) {
        console.error(`❌ Validation échouée : ${validationReport.errors.length} erreurs trouvées.`);
        console.log(`📋 Consultez les détails dans ${VALIDATION_FILE}`);
    } else {
        console.log("✅ Validation V2 réussie ! Aucune erreur trouvée sur les 16 schémas.");
        console.log(`📋 Rapport généré dans ${VALIDATION_FILE}`);
    }
}

main().catch(error => {
    console.error("❌ Erreur inattendue:", error);
});
