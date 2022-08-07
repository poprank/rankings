import { NftWithInitialTraits } from '@poprank/sdk';
import fs from 'fs';
import { getAllNftsRarity } from './rarity';
import { TRAIT_COUNT } from './rarity.meta';

describe('addAllNftsRarity', () => {
    const data = fs.readFileSync('./src/rarity/boredapeyachtclub.test.json', { encoding: 'utf8', flag: 'r' });
    const nfts: NftWithInitialTraits[] = JSON.parse(data);

    // console.log(nfts[0]);
    const { nftsWithRarityAndRank, collectionTraits } = getAllNftsRarity(nfts);
    test('min rarity is close to 1', () => {

        let minRarityScore = Infinity;

        Object.values(collectionTraits).forEach(traits => traits.forEach(trait => {
            if (!(trait.category === 'Meta' && trait.value !== TRAIT_COUNT) && minRarityScore > trait.rarityTraitSum) {
                minRarityScore = trait.rarityTraitSum;
            }
        }));

        nftsWithRarityAndRank.sort((a, b) => a.rarityTraitSumRank - b.rarityTraitSumRank);

        expect(minRarityScore).toBeGreaterThan(0.99);
        expect(minRarityScore).toBeLessThan(1.01);

    });

    test('collectionTraits', () => {
        console.log(collectionTraits);
    });
});
