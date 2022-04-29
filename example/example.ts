import fs from 'fs';
import { getAllNftsRarity, NftInit } from '../src';

const exampleCalculateRarityOfAllNfts = () => {
    const data = fs.readFileSync('ens.test.json', { encoding: 'utf8', flag: 'r' });
    // const data = fs.readFileSync('../src/rarity/boredapeyachtclub.test.json', { encoding: 'utf8', flag: 'r' });
    const nfts: NftInit[] = JSON.parse(data);
    const { nftsWithRarityAndRank } = getAllNftsRarity(nfts.map(n => ({ ...n, traits: n.traits.filter(t => t.category !== 'Meta') })));

    nftsWithRarityAndRank.sort((a, b) => a.rarityTraitSumRank - b.rarityTraitSumRank);

    return nftsWithRarityAndRank;
};

const saveAndCalculateRarity = async () => {
    const nftsWithRarityAndRank = exampleCalculateRarityOfAllNfts();
    const jsonString = JSON.stringify(nftsWithRarityAndRank);

    fs.writeFile('./collection-rankings.json', jsonString, err => {
        if (err) {
            console.log('Error writing file', err);
        }
    });

    const top5 = nftsWithRarityAndRank.slice(0, 5);
    console.log('And your top 5 are:');
    top5.forEach(nft => { console.log(`#${nft.rarityTraitSumRank} ID: ${nft.id}, name: ${nft.name}, url:${nft.imageUrl}`); });

    const htmlStr = `
    <head>
        <style type="text/css">
            .nft{
                display:flex;
                flex-direction: column;
                height:400;
                width:300;
            }

            .nft-info{
                color:#1F1F1F;
                font-size: 36px;
                margin-left: 16px;
            }

            .rankings{
                display:flex;
                flex-wrap: wrap;
                justify-content: space-between;
                flex-direction: row;
            }
        </style>
    </head>
    <body>
        <div class="rankings">
        ${nftsWithRarityAndRank.slice(0, 100).map(n => `
            <div class="nft">
                <span class="nft-info">${n.rarityTraitSumRank}</span>
                <img src="${n.imageUrl}"></img>
                <span class="nft-info">${n.name}</span>
            </div>
            `)}
        </div>
    </body>`;

    fs.writeFile('./collection-example.html', htmlStr, err => {
        if (err) {
            console.log('Error writing file', err);
        }
    });

};

saveAndCalculateRarity();
