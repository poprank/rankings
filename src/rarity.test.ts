import fs from 'fs';
import { calculateRarity } from './rarity';
import { NftInit } from './types';

describe('calculateRarity', () => {
    test('min rarity is close to 1', () => {
        const data = fs.readFileSync('./test/boredapeyachtclub.json', { encoding: 'utf8', flag: 'r' });
        const nfts: NftInit[] = JSON.parse(data);

        // console.log(nfts[0]);
        const { nftsWithRarityAndRank, collectionTraits } = calculateRarity(nfts);

        let minRarityScore = Infinity;

        Object.values(collectionTraits).forEach(traits => traits.forEach(trait => {
            if (minRarityScore > trait.rarityTraitSum) {
                minRarityScore = trait.rarityTraitSum;
            }
        }));

        nftsWithRarityAndRank.sort((a, b) => a.rarityTraitSumRank - b.rarityTraitSumRank);

        expect(minRarityScore).toBeGreaterThan(0.99);
        expect(minRarityScore).toBeLessThan(1.01);

    });
});
