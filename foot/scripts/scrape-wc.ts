import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const yearArg = process.argv[2] || '2018';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'exports', `wc${yearArg}.json`);

function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function scrapeWorldCup(year: string) {
    console.log(`🚀 Lancement du scraping de la Coupe du Monde ${year} depuis Wikipedia...`);

    let host = "";
    if (year === "2022") host = "Qatar";
    else if (year === "2018") host = "Russie";
    else if (year === "2014") host = "Brésil";
    else if (year === "2010") host = "Afrique du Sud";
    else if (year === "2006") host = "Allemagne";
    else if (year === "2002") host = "Corée du Sud et Japon";
    else if (year === "1998") host = "France";
    else host = "Inconnu";

    const MAIN_URL = `https://en.wikipedia.org/wiki/${year}_FIFA_World_Cup`;
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

    const seasonKey = year;
    const seasonId = `${compId}:${seasonKey}`;
    const seasonCatalog = {
        id: seasonId,
        competitionId: compId,
        seasonKey: seasonKey,
        label: `Coupe du Monde ${year} (${host})`,
        startDate: `${year}-06-01`,
        endDate: `${year}-07-31`
    };

    const teamsMap = new Map<string, any>();
    const events: any[] = [];
    const eventTeams: any[] = [];
    const eventIds: string[] = [];

    $('.footballbox').each((i, el) => {
        const $el = $(el);
        const eventId = `evt_wc${year}_${i + 1}`;

        const homeName = $el.find('th.fhome span[itemprop="name"] a').last().text().trim() || $el.find('th.fhome').text().trim();
        const awayName = $el.find('th.faway span[itemprop="name"] a').last().text().trim() || $el.find('th.faway').text().trim();
        const scoreText = $el.find('th.fscore').text().replace(/\(a\.e\.t\.\)/, '').replace(/\(a\.e\.t\./, '').trim();

        if (!homeName || !awayName) return;

        const cleanHomeName = homeName.replace(/[^a-zA-Z\s\-']/g, '').trim();
        const cleanAwayName = awayName.replace(/[^a-zA-Z\s\-']/g, '').trim();

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
                "Uruguay": "Uruguay", "South Korea": "Corée du Sud", "Russia": "Russie", "Egypt": "Égypte",
                "Peru": "Pérou", "Iceland": "Islande", "Nigeria": "Nigeria", "Sweden": "Suède",
                "Panama": "Panama", "Colombia": "Colombie", "Chile": "Chili", "Greece": "Grèce",
                "Ivory Coast": "Côte d'Ivoire", "Italy": "Italie", "Honduras": "Honduras",
                "Bosnia and Herzegovina": "Bosnie-Herzégovine", "Algeria": "Algérie",
                "South Africa": "Afrique du Sud", "New Zealand": "Nouvelle-Zélande", "Slovakia": "Slovaquie",
                "Paraguay": "Paraguay", "North Korea": "Corée du Nord", "Trinidad and Tobago": "Trinité-et-Tobago",
                "Angola": "Angola", "Togo": "Togo", "Ukraine": "Ukraine", "Czech Republic": "République Tchèque",
                "Republic of Ireland": "Irlande", "Turkey": "Turquie", "China": "Chine",
                "Slovenia": "Slovénie", "Norway": "Norvège", "Scotland": "Écosse", "Austria": "Autriche",
                "Bulgaria": "Bulgarie", "Romania": "Roumanie", "Jamaica": "Jamaïque",
                "Yugoslavia": "Yougoslavie", "Serbia and Montenegro": "Serbie-et-Monténégro"
            };

            const frName = translations[enName] || enName;

            let prefix = "de ";
            const vowels = ['A', 'E', 'I', 'O', 'U', 'É', 'È', 'Ê', 'Â', 'A'];
            if (frName === "Pays-Bas" || frName === "États-Unis") {
                prefix = "des ";
            } else if (["Brésil", "Cameroun", "Canada", "Costa Rica", "Danemark", "Ghana", "Japon", "Maroc", "Mexique", "Portugal", "Qatar", "Sénégal", "Chili", "Honduras", "Panama", "Nigeria", "Pérou"].includes(frName)) {
                prefix = "du ";
            } else if (frName === "Pays de Galles") {
                prefix = "du ";
            } else if (vowels.includes(frName.charAt(0))) {
                prefix = "d'";
            }

            const nameMini = frName.substring(0, 3).charAt(0).toUpperCase() + frName.substring(0, 3).substring(1).toLowerCase();

            return {
                name: frName,
                nameFull: `Équipe ${prefix}${frName} de Football`,
                nameMini: nameMini
            };
        };

        const homeTeamData = getFrenchTeam(cleanHomeName);
        const awayTeamData = getFrenchTeam(cleanAwayName);

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

        const dateStr = $el.find('.fdate').text().trim();
        const dateMatches = dateStr.match(/\d{4}-\d{2}-\d{2}/);
        let dateISO = `${year}-07-15T20:00:00Z`;

        if (dateMatches && dateMatches[0]) {
            dateISO = `${dateMatches[0]}T20:00:00Z`;
        }

        const eventObj = {
            id: eventId,
            title: `${homeTeamData.name} vs. ${awayTeamData.name}`,
            sport: "Football",
            league: "Coupe du Monde",
            date: dateMatches ? dateMatches[0] : `Juin/Juillet ${year}`,
            dateISO: dateISO.split('T')[0],
            location: host,
            status: "Passé",
            communityScore: null,
            reviews: 0,
            result: scoreText.replace('–', '-'),
            image: `images/events/wc${year}_default.jpg`,
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
        year: year,
        title: `Coupe du Monde ${year}`,
        averageScore: 0,
        count: events.length,
        dateRangeLabel: `Juin ${year} - Juillet ${year}`,
        endDateISO: `${year}-07-31`,
        startDateISO: `${year}-06-01`,
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

    console.log(`✅ Scraping de la CdM ${year} terminé ! ${finalData.teams.length} équipes, ${events.length} matchs scrapés.`);
    console.log(`➡️  Données enregistrées dans ${OUTPUT_FILE}`);
}

scrapeWorldCup(yearArg).catch(e => console.error(e));
