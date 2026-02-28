import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'exports', 'wc2022.json');

function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function scrapeWorldCup() {
    console.log("🚀 Lancement du scraping de la Coupe du Monde 2022 depuis Wikipedia...");

    const MAIN_URL = 'https://en.wikipedia.org/wiki/2022_FIFA_World_Cup';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    const { data: mainData } = await axios.get(MAIN_URL, { headers });
    const $ = cheerio.load(mainData);

    const compId = "comp_world_cup";
    const competitionCatalog = {
        id: compId,
        currentName: "Coupe du Monde de la FIFA",
        sport: "Football",
        seasonModel: "calendar_year",
        frequency: "every_4_years"
    };

    const seasonKey = "2022";
    const seasonId = `${compId}:${seasonKey}`;
    const seasonCatalog = {
        id: seasonId,
        competitionId: compId,
        seasonKey: seasonKey,
        label: "Coupe du Monde 2022 (Qatar)",
        startDate: "2022-11-20",
        endDate: "2022-12-18"
    };

    const teamsMap = new Map<string, any>();
    const events: any[] = [];
    const eventTeams: any[] = [];
    const eventIds: string[] = [];

    $('.footballbox').each((i, el) => {
        const $el = $(el);
        const eventId = `evt_wc2022_${i + 1}`;

        const homeName = $el.find('th.fhome span[itemprop="name"] a').last().text().trim() || $el.find('th.fhome').text().trim();
        const awayName = $el.find('th.faway span[itemprop="name"] a').last().text().trim() || $el.find('th.faway').text().trim();
        const scoreText = $el.find('th.fscore').text().replace(/\(a\.e\.t\.\)/, '').replace(/\(a\.e\.t\./, '').trim(); // Remove " (a.e.t.)" text

        if (!homeName || !awayName) return;

        // Fix some parsing issues from typical wiki flags
        const cleanHomeName = homeName.replace(/[^a-zA-Z\s\-]/g, '').trim();
        const cleanAwayName = awayName.replace(/[^a-zA-Z\s\-]/g, '').trim();

        // Helper to translate to French and format
        const getFrenchTeam = (enName: string) => {
            const translations: Record<string, string> = {
                "Qatar": "Qatar", "Ecuador": "Équateur", "Senegal": "Sénégal", "Netherlands": "Pays-Bas",
                "England": "Angleterre", "IR Iran": "Iran", "Iran": "Iran", "United States": "États-Unis",
                "Wales": "Pays de Galles", "Argentina": "Argentine", "Saudi Arabia": "Arabie Saoudite",
                "Mexico": "Mexique", "Poland": "Pologne", "France": "France", "Australia": "Australie",
                "Denmark": "Danemark", "Tunisia": "Tunisie", "Spain": "Espagne", "Costa Rica": "Costa Rica",
                "Germany": "Allemagne", "Japan": "Japon", "Belgium": "Belgique", "Canada": "Canada",
                "Morocco": "Maroc", "Croatia": "Croatie", "Brazil": "Brésil", "Serbia": "Serbie",
                "Switzerland": "Suisse", "Cameroon": "Cameroun", "Portugal": "Portugal", "Ghana": "Ghana",
                "Uruguay": "Uruguay", "South Korea": "Corée du Sud"
            };

            const frName = translations[enName] || enName;

            let prefix = "de ";
            const vowels = ['A', 'E', 'I', 'O', 'U', 'É', 'È', 'Ê', 'Â'];
            if (frName === "Pays-Bas" || frName === "États-Unis") {
                prefix = "des ";
            } else if (["Brésil", "Cameroun", "Canada", "Costa Rica", "Danemark", "Ghana", "Japon", "Maroc", "Mexique", "Portugal", "Qatar", "Sénégal"].includes(frName)) {
                prefix = "du ";
            } else if (frName === "Pays de Galles") {
                prefix = "du ";
            } else if (vowels.includes(frName.charAt(0))) {
                prefix = "d'";
            }

            // nameMini example: "Fra"
            const nameMini = frName.substring(0, 3).charAt(0).toUpperCase() + frName.substring(0, 3).substring(1).toLowerCase();

            return {
                name: frName,
                nameFull: `Équipe ${prefix}${frName} de Football`,
                nameMini: nameMini
            };
        };

        const homeTeamData = getFrenchTeam(cleanHomeName);
        const awayTeamData = getFrenchTeam(cleanAwayName);

        // Keep ID simple and unaccented
        const homeId = `tm_${slugify(cleanHomeName)}`;
        const awayId = `tm_${slugify(cleanAwayName)}`;

        if (!teamsMap.has(homeId)) {
            teamsMap.set(homeId, {
                id: homeId,
                name: homeTeamData.name,
                nameFull: homeTeamData.nameFull,
                nameMini: homeTeamData.nameMini,
                sport: "Football",
                city: homeTeamData.name,
                athleteIds: []
            });
        }

        if (!teamsMap.has(awayId)) {
            teamsMap.set(awayId, {
                id: awayId,
                name: awayTeamData.name,
                nameFull: awayTeamData.nameFull,
                nameMini: awayTeamData.nameMini,
                sport: "Football",
                city: awayTeamData.name,
                athleteIds: []
            });
        }

        // Convert date "21 November 2022" -> "2022-11-21" approx
        const dateStr = $el.find('.fdate').text().trim();
        const dateMatches = dateStr.match(/\d{4}-\d{2}-\d{2}/);
        let dateISO = "2022-12-18T20:00:00Z";

        if (dateMatches && dateMatches[0]) {
            dateISO = `${dateMatches[0]}T20:00:00Z`;
        }

        const eventObj = {
            id: eventId,
            title: `${cleanHomeName} vs. ${cleanAwayName}`,
            sport: "Football",
            league: "Coupe du Monde",
            date: dateMatches ? dateMatches[0] : "Novembre 2022",
            dateISO: dateISO.split('T')[0],
            location: "Qatar",
            status: "Passé",
            communityScore: null,
            reviews: 0,
            result: scoreText.replace('–', '-'), // Normalisation du tiret
            image: "images/events/wc2022_default.jpg",
            competitionId: compId,
            seasonId: seasonId,
            seasonKey: seasonKey
        };

        events.push(eventObj);
        eventIds.push(eventId);

        eventTeams.push({
            eventId: eventId,
            teamIds: [homeId, awayId]
        });
    });

    const league = {
        id: compId,
        title: "Coupe du Monde",
        sport: "Football",
        seasonModel: "calendar_year",
        frequency: "every_4_years",
        count: events.length,
        averageScore: 0,
        events: events,
        seasons: []
    };

    const leagueSeason = {
        id: seasonId,
        leagueId: compId,
        leagueTitle: "Coupe du Monde",
        sport: "Football",
        seasonKey: seasonKey,
        year: "2022",
        title: "Coupe du Monde 2022",
        averageScore: 0,
        count: events.length,
        dateRangeLabel: "Nov 2022 - Déc 2022",
        endDateISO: "2022-12-18",
        startDateISO: "2022-11-20",
        pastCount: events.length,
        upcomingCount: 0,
        eventIds: eventIds,
        events: events
    };

    league.seasons.push(leagueSeason as never);

    const finalData = {
        competitionCatalog: [competitionCatalog],
        seasonCatalog: [seasonCatalog],
        leagues: [league],
        leagueSeasons: [leagueSeason],
        events: events,
        teams: Array.from(teamsMap.values()),
        eventTeams: eventTeams,
        users: [],
        athletes: [],
        athleteParticipation: [],
        comments: [],
        curatedLists: [],
        activitySamples: [],
        tagCatalog: [],
        objectTags: [],
        objectTagVotes: []
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));

    console.log(`✅ Scraping de la CdM terminé ! ${finalData.teams.length} équipes, ${events.length} matchs scrapés.`);
    console.log(`➡️  Données enregistrées dans ${OUTPUT_FILE}`);
}

scrapeWorldCup().catch(e => console.error(e));
