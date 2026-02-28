import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const yearLabel = '2026';
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const INPUT_FILE = path.join(ROOT_DIR, 'rugby', 'exports', `six-nations-${yearLabel}.json`);

function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

const roleMap: Record<string, string> = {
    "Prop": "Pilier",
    "Hooker": "Talonneur",
    "Lock": "Deuxième ligne",
    "Back row": "Troisième ligne",
    "Flanker": "Troisième ligne aile",
    "Number 8": "Troisième ligne centre",
    "Scrum-half": "Demi de mêlée",
    "Fly-half": "Demi d'ouverture",
    "Centre": "Centre",
    "Wing": "Ailier",
    "Full-back": "Arrière"
};

async function scrapeRugbySquads() {
    console.log(`🚀 Scraping des effectifs du Tournoi des Six Nations ${yearLabel}...`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error("❌ Fichier export 6 nations introuvable. Lancez d'abord scrape-sixnations.ts.");
        return;
    }

    const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const wikiUrl = `https://en.wikipedia.org/wiki/2026_Six_Nations_Championship_squads`;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    const { data: html } = await axios.get(wikiUrl, { headers });
    const $ = cheerio.load(html);

    const athletes: any[] = [];
    const teamAthleteIds: Record<string, string[]> = {};

    const nations = ['England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales'];
    const nationMapping: Record<string, { id: string, fr: string }> = {
        'England': { id: 'tm_rugby_england', fr: 'Angleterre' },
        'France': { id: 'tm_rugby_france', fr: 'France' },
        'Ireland': { id: 'tm_rugby_ireland', fr: 'Irlande' },
        'Italy': { id: 'tm_rugby_italy', fr: 'Italie' },
        'Scotland': { id: 'tm_rugby_scotland', fr: 'Écosse' },
        'Wales': { id: 'tm_rugby_wales', fr: 'Pays de Galles' }
    };

    nations.forEach(nation => {
        const teamInfo = nationMapping[nation];
        teamAthleteIds[teamInfo.id] = [];

        console.log(`🔍 Extraction effectif : ${teamInfo.fr}...`);

        // Sur Wikipedia moderne, l'ID est sur le h2/h3 (parfois wrappé dans div.mw-heading)
        let section = $(`#${nation}`);
        if (!section.is('h2, h3')) section = section.closest('h2, h3');

        // On cherche le wikitable le plus proche après le bloc titre
        let table = section.nextAll('table.wikitable').first();
        if (table.length === 0) {
            table = section.closest('div.mw-heading').nextAll('table.wikitable').first();
        }

        if (table.length === 0) {
            console.log(`⚠️  Table non trouvée pour ${nation}`);
            return;
        }

        table.find('tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 3) {
                const nameLink = cells.eq(0).find('a').first();
                const name = nameLink.text().trim();
                const rawRole = cells.eq(1).find('a').first().text().trim() || cells.eq(1).text().trim();
                const club = cells.last().find('a').last().text().trim() || cells.last().text().trim();

                if (name) {
                    const athId = `ath_rugby_${slugify(name)}`;
                    const role = roleMap[rawRole] || rawRole;

                    const athlete = {
                        id: athId,
                        name: name,
                        sport: "Rugby",
                        country: teamInfo.fr,
                        teamId: teamInfo.id,
                        team: teamInfo.fr,
                        role: role,
                        bio: `Joueur de rugby international ${teamInfo.fr.toLowerCase()} évoluant au poste de ${role.toLowerCase()}. Club : ${club}.`,
                        image: `images/athletes/rugby_default.jpg`
                    };

                    athletes.push(athlete);
                    teamAthleteIds[teamInfo.id].push(athId);
                }
            }
        });
        console.log(`✅ ${teamAthleteIds[teamInfo.id].length} joueurs trouvés.`);
    });

    // Mettre à jour les équipes dans l'export
    data.athletes = athletes;
    data.teams = data.teams.map((t: any) => ({
        ...t,
        athleteIds: teamAthleteIds[t.id] || []
    }));

    fs.writeFileSync(INPUT_FILE, JSON.stringify(data, null, 2));

    console.log(`✅ ${athletes.length} joueurs ajoutés avec succès dans ${path.basename(INPUT_FILE)} !`);
}

scrapeRugbySquads().catch(e => console.error(e));
