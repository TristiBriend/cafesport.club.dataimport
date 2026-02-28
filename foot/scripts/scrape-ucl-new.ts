import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const yearParam = process.argv[2] || '2025'; // '2025' pour 2024-25, '2026' pour 2025-26
const yearLabel = yearParam === '2025' ? '2024-2025' : '2025-2026';
const wikiYear = yearParam === '2025' ? '2024%E2%80%9325' : '2025%E2%80%9326';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'foot', 'exports', `ucl-${yearParam}.json`);

function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function scrapeUCL() {
    console.log(`🚀 Lancement du scraping UCL ${yearLabel} (Nouveau Format)...`);

    const SUB_PAGES = [
        `https://en.wikipedia.org/wiki/${wikiYear}_UEFA_Champions_League_league_phase`,
        `https://en.wikipedia.org/wiki/${wikiYear}_UEFA_Champions_League_knockout_phase`
    ];

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    const compId = "comp_ucl";
    const competitionCatalog = {
        id: compId,
        currentName: "Ligue des Champions",
        sport: "Football",
        seasonModel: "split_year",
        frequency: "annual"
    };

    const seasonKey = yearLabel;
    const seasonId = `${compId}:${seasonKey}`;
    const seasonCatalog = {
        id: seasonId,
        competitionId: compId,
        seasonKey: seasonKey,
        label: `Ligue des Champions ${yearLabel}`,
        startDate: yearParam === '2025' ? "2024-09-17" : "2025-09-16",
        endDate: yearParam === '2025' ? "2025-05-31" : "2026-05-30"
    };

    const teamsMap = new Map<string, any>();
    const events: any[] = [];
    const eventTeams: any[] = [];
    const eventIds: string[] = [];

    const getFrenchClub = (enName: string) => {
        const translations: Record<string, string> = {
            "Real Madrid": "Real Madrid", "Borussia Dortmund": "Borussia Dortmund", "Paris Saint-Germain": "PSG",
            "Bayern Munich": "Bayern Munich", "Manchester City": "Manchester City", "Arsenal": "Arsenal",
            "Atletico Madrid": "Atlético de Madrid", "Atlético Madrid": "Atlético de Madrid", "Barcelona": "FC Barcelone",
            "Inter Milan": "Inter Milan", "Napoli": "Naples", "Lazio": "Lazio Rome", "PSV Eindhoven": "PSV Eindhoven",
            "Porto": "FC Porto", "Real Sociedad": "Real Sociedad", "Copenhagen": "FC Copenhague",
            "Milan": "AC Milan", "Newcastle United": "Newcastle", "Benfica": "Benfica Lisbonne",
            "Lens": "RC Lens", "Sevilla": "Séville FC", "Galatasaray": "Galatasaray", "Manchester United": "Manchester United",
            "Feyenoord": "Feyenoord", "Shakhtar Donetsk": "Shakhtar Donetsk", "Celtic": "Celtic Glasgow",
            "Red Bull Salzburg": "RB Salzbourg", "Braga": "SC Braga", "Union Berlin": "Union Berlin",
            "Red Star Belgrade": "Étoile Rouge de Belgrade", "Young Boys": "Young Boys Berne", "Antwerp": "Royal Antwerp",
            "Bayer Leverkusen": "Bayer Leverkusen", "Stuttgart": "Stuttgart", "RB Leipzig": "RB Leipzig",
            "Liverpool": "Liverpool", "Aston Villa": "Aston Villa", "Girona": "Gérone FC",
            "Brest": "Stade Brestois", "Monaco": "AS Monaco", "Lille": "Lille OSC",
            "Atalanta": "Atalanta Bergame", "Juventus": "Juventus", "Bologna": "Bologne",
            "Sporting CP": "Sporting Portugal", "Slovan Bratislava": "Slovan Bratislava", "Sparta Prague": "Sparta Prague",
            "Dinamo Zagreb": "Dinamo Zagreb", "Sturm Graz": "Sturm Graz"
        };

        let frName = translations[enName] || enName;

        let prefix = "de ";
        const vowels = ['A', 'E', 'I', 'O', 'U', 'É', 'È', 'Ê', 'Â'];
        if (frName.startsWith("Étoile") || frName.startsWith("Lazio") || frName.startsWith("Real") || frName.startsWith("Juventus") || frName.startsWith("Atalanta")) {
            prefix = "de la ";
        } else if (frName.startsWith("FC ") || frName.startsWith("RB ") || frName.startsWith("AC ") || frName.startsWith("AS ") || frName.startsWith("SC ")) {
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

    for (const url of SUB_PAGES) {
        console.log(`⏳ Page : ${url.split('_').pop()}...`);
        try {
            const { data } = await axios.get(url, { headers });
            const $ = cheerio.load(data);

            $('.footballbox').each((_, el) => {
                const $el = $(el);

                const homeName = $el.find('th.fhome span[itemprop="name"] a').last().text().trim() || $el.find('th.fhome').text().trim();
                const awayName = $el.find('th.faway span[itemprop="name"] a').last().text().trim() || $el.find('th.faway').text().trim();
                const scoreText = $el.find('th.fscore').text().replace(/\(a\.e\.t\.\)/, '').replace(/\(a\.e\.t\./, '').trim();

                if (!homeName || !awayName) return;

                const cleanHomeName = homeName.replace(/[^a-zA-Z\s\-']/g, '').trim();
                const cleanAwayName = awayName.replace(/[^a-zA-Z\s\-']/g, '').trim();

                const eventId = `evt_ucl_${yearParam}_${events.length + 1}`;
                const homeTeamData = getFrenchClub(cleanHomeName);
                const awayTeamData = getFrenchClub(cleanAwayName);

                const homeId = `tm_football_${slugify(cleanHomeName)}`;
                const awayId = `tm_football_${slugify(cleanAwayName)}`;

                if (!teamsMap.has(homeId)) {
                    teamsMap.set(homeId, {
                        id: homeId,
                        name: homeTeamData.name,
                        nameFull: homeTeamData.nameFull,
                        nameMini: homeTeamData.nameMini,
                        sport: "Football",
                        city: cleanHomeName,
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
                        city: cleanAwayName,
                        athleteIds: []
                    });
                }

                const dateStr = $el.find('.fdate').text().trim();
                const dateMatches = dateStr.match(/\d{4}-\d{2}-\d{2}/);
                let dateISO = yearParam === '2025' ? "2024-09-17" : "2025-09-16";

                if (dateMatches && dateMatches[0]) {
                    dateISO = dateMatches[0];
                } else {
                    const parts = dateStr.split(' ');
                    if (parts.length >= 3) {
                        const day = parts[0].padStart(2, '0');
                        const months: Record<string, string> = {
                            "September": "09", "October": "10", "November": "11", "December": "12",
                            "January": "01", "February": "02", "March": "03", "April": "04", "May": "05", "June": "06"
                        };
                        const month = months[parts[1]] || "01";
                        const year = parts[2].substring(0, 4);
                        dateISO = `${year}-${month}-${day}`;
                    }
                }

                const eventObj = {
                    id: eventId,
                    title: `${homeTeamData.name} vs. ${awayTeamData.name}`,
                    sport: "Football",
                    league: "Ligue des Champions",
                    date: dateISO,
                    dateISO: dateISO,
                    location: "Europe",
                    status: (scoreText.includes(':') || scoreText === '') ? "À venir" : "Passé",
                    communityScore: null,
                    reviews: 0,
                    result: scoreText.includes(':') ? null : scoreText.replace('–', '-'),
                    image: `images/events/ucl_default.jpg`,
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
        } catch (err) {
            console.log(`⚠️ Impossible de récupérer la page ${url} (peut-être pas encore créée).`);
        }
    }

    if (events.length === 0) {
        console.log("❌ Aucun match trouvé. Vérifiez les URLs Wikipedia.");
        return;
    }

    const league = {
        id: compId,
        title: "Ligue des Champions",
        sport: "Football",
        seasonModel: "split_year",
        frequency: "annual",
        count: events.length,
        averageScore: 0,
        events: events,
        seasons: []
    };

    const leagueSeason = {
        id: seasonId,
        leagueId: compId,
        leagueTitle: "Ligue des Champions",
        sport: "Football",
        seasonKey: seasonKey,
        year: yearLabel,
        title: `Ligue des Champions ${yearLabel}`,
        averageScore: 0,
        count: events.length,
        dateRangeLabel: yearParam === '2025' ? "Sept 2024 - Mai 2025" : "Sept 2025 - Mai 2026",
        endDateISO: yearParam === '2025' ? "2025-05-31" : "2026-05-30",
        startDateISO: yearParam === '2025' ? "2024-09-17" : "2025-09-16",
        pastCount: events.filter(e => e.status === "Passé").length,
        upcomingCount: events.filter(e => e.status === "À venir").length,
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

    console.log(`✅ Scraping UCL ${yearLabel} terminé ! ${finalData.teams.length} équipes, ${events.length} matchs scrapés.`);
    console.log(`➡️  Données enregistrées dans ${OUTPUT_FILE}`);
}

scrapeUCL().catch(e => console.error(e));
