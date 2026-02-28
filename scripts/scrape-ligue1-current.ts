import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const yearLabel = '2025-2026';
const OUTPUT_FILE = path.join(ROOT_DIR, 'exports', `ligue1-${yearLabel.substring(5)}.json`); // ligue1-2026.json

function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function scrapeAll() {
    console.log(`🚀 Lancement du scraping complet de la Ligue 1 ${yearLabel}...`);

    const MAIN_URL = 'https://www.footmercato.net/france/ligue-1/calendrier/';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };

    // 1. Récupération des URLs de toutes les journées (on privilégie /resultat/)
    const { data: mainData } = await axios.get(MAIN_URL, { headers });
    const $main = cheerio.load(mainData);

    const urls: string[] = [];
    $main('.select__itemButton').each((_, el) => {
        let href = $main(el).attr('href');
        if (href && href.includes('journee-')) {
            // On transforme systématiquement en lien de résultat pour avoir les scores
            const finalPath = href.replace('/calendrier/', '/resultat/');
            if (!finalPath.startsWith('http')) {
                urls.push(`https://www.footmercato.net${finalPath}`);
            } else {
                urls.push(finalPath);
            }
        }
    });

    const uniqueUrls = Array.from(new Set(urls));
    console.log(`📌 ${uniqueUrls.length} journées trouvées.`);

    const compId = "comp_ligue_1";
    const competitionCatalog = {
        id: compId,
        currentName: "Ligue 1",
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
        label: `Ligue 1 ${yearLabel}`,
        startDate: "2025-08-15",
        endDate: "2026-05-16"
    };

    const teamsMap = new Map<string, any>();
    const events: any[] = [];
    const eventTeams: any[] = [];
    const eventIds: string[] = [];

    // 2. Boucler sur chaque journée (séquentiellement pour éviter d'être banni)
    for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];
        console.log(`⏳ Scraping journée ${i + 1}/${uniqueUrls.length}...`);

        try {
            const { data } = await axios.get(url, { headers });
            const $ = cheerio.load(data);

            $('.matchFull').each((_, el) => {
                const $el = $(el);
                const link = $el.find('.matchFull__link').attr('href') || Math.random().toString();
                const parsedId = link.split('/').pop() || Math.random().toString();
                const eventId = `evt_${slugify(parsedId)}`;

                // DÉDUPLICATION : Si on a déjà ce match, on passe
                if (eventIds.includes(eventId)) return;

                const $homeTeam = $el.find('.matchFull__team').not('.matchFull__team--away').first();
                const $awayTeam = $el.find('.matchFull__team--away').first();

                const homeName = $homeTeam.find('.matchTeam__name').text().trim();
                const awayName = $awayTeam.find('.matchTeam__name').text().trim();

                if (!homeName || !awayName) return;

                const cleanHomeName = homeName.trim();
                const cleanAwayName = awayName.trim();

                const getFrenchLeagueTeam = (name: string) => {
                    let prefix = "";
                    let formalName = name;
                    if (name.startsWith("Le ")) {
                        prefix = "du ";
                        formalName = name.substring(3);
                    } else {
                        const vowels = ['A', 'E', 'I', 'O', 'U', 'Y', 'É', 'È', 'Ê', 'Â'];
                        if (vowels.includes(name.charAt(0).toUpperCase())) {
                            prefix = "d'";
                        } else {
                            prefix = "de ";
                        }
                    }
                    const nameMini = name.substring(0, 3).charAt(0).toUpperCase() + name.substring(0, 3).substring(1).toLowerCase();

                    return {
                        name: name,
                        nameFull: `Équipe ${prefix}${formalName} de Football`,
                        nameMini: nameMini
                    };
                };

                const homeTeamData = getFrenchLeagueTeam(cleanHomeName);
                const awayTeamData = getFrenchLeagueTeam(cleanAwayName);

                const homeId = `tm_${slugify(cleanHomeName)}`;
                const awayId = `tm_${slugify(cleanAwayName)}`;

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

                const homeScoreText = $homeTeam.find('.matchFull__score').text().trim();
                const awayScoreText = $awayTeam.find('.matchFull__score').text().trim();
                const resultStr = `${homeScoreText} - ${awayScoreText}`;

                const statusText = $el.find('.matchFull__infosPlayed').text().trim().toLowerCase();
                let status = statusText.includes('terminé') ? "Passé" : "À venir";

                let dateStrLabel = "À déterminer";
                let dateISO = "2026-02-28";
                const dateBlock = $el.closest('.blockVertical').find('.title__left').text().trim();
                if (dateBlock) {
                    dateStrLabel = dateBlock;
                    dateISO = "2026-02-28";
                }

                const eventObj = {
                    id: eventId,
                    title: `${homeName} vs. ${awayName}`,
                    sport: "Football",
                    league: "Ligue 1",
                    date: dateStrLabel,
                    dateISO: dateISO,
                    location: "France",
                    status: status,
                    communityScore: null,
                    reviews: 0,
                    result: status === "Passé" ? resultStr : " - ",
                    image: `images/events/ligue1_default.jpg`,
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

            await new Promise(r => setTimeout(r, 600));

        } catch (e) {
            console.error(`❌ Erreur sur l'URL ${url}`, e);
        }
    }

    const league = {
        id: compId,
        title: "Ligue 1",
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
        leagueTitle: "Ligue 1",
        sport: "Football",
        seasonKey: seasonKey,
        year: yearLabel,
        title: `Ligue 1 ${yearLabel}`,
        averageScore: 0,
        count: events.length,
        dateRangeLabel: "Août 2025 - Mai 2026",
        endDateISO: "2026-05-16",
        startDateISO: "2025-08-15",
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

    console.log(`✅ Scraping de la Ligue 1 ${yearLabel} terminé ! ${finalData.teams.length} équipes, ${events.length} matchs scrapés.`);
    console.log(`➡️  Données enregistrées dans ${OUTPUT_FILE}`);
}

scrapeAll().catch(e => console.error(e));
