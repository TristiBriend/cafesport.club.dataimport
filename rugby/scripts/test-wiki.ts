import axios from 'axios';
import * as cheerio from 'cheerio';

async function testSelectors() {
    const wikiUrl = `https://en.wikipedia.org/wiki/2026_Six_Nations_Championship_squads`;
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' };
    const { data: html } = await axios.get(wikiUrl, { headers });
    const $ = cheerio.load(html);

    const nations = ['England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales'];
    nations.forEach(nation => {
        const idElem = $(`#${nation}`);
        console.log(`Nation: ${nation}, ID Found: ${idElem.length}, Tag: ${idElem.prop('tagName')}`);

        let section = idElem;
        if (!section.is('h2, h3')) section = section.closest('h2, h3');
        console.log(`  Section Tag: ${section.prop('tagName')}`);

        const table = section.nextAll('table.wikitable').first();
        console.log(`  Table Found: ${table.length}`);

        if (table.length > 0) {
            const rowCount = table.find('tr').length;
            console.log(`  Rows : ${rowCount}`);
        }
    });

    console.log("\n--- Debug total HTML ---");
    console.log("H2s:", $('h2').length);
    $('h2').each((i, el) => {
        console.log(`H2 ${i}: id=${$(el).attr('id')} text=${$(el).text().trim()}`);
    });
}

testSelectors();
