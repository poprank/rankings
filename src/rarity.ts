import { collectionNameMetaFunctionPairs, getNftTraitsMatches, NONE_TRAIT, TRAIT_COUNT } from './rarity.meta';
import { NftInit, NftWithRank, NftWithRatedTraits, TraitBase, TraitPreDb } from './types';


// Next PR i'll implement the new rarity calc, and will remove the
// lint disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const traitRarityTraitSum = (traitCount: number, collectionSize: number, _traitTypeCount: number): number =>
    +((collectionSize / Math.sqrt(traitCount - 0.9)).toFixed(3)) / 10;


/**
 * Push a trait to the all-up collection's traits obj
 * @param collectionTraits Object of key:value pairs of `trait type: array of trait values of this type`
 * eg: `head:[{typeValue:'head',value:'crown'}...]
 * @param trait The trait to push
 */
const pushTraitToCollectionTraits = (collectionTraits: Record<string, TraitPreDb[]>, trait: TraitBase) => {
    const { value, typeValue } = trait;

    if (!collectionTraits[typeValue])
        collectionTraits[typeValue] = [];

    const alreadySeenTraitIndex = collectionTraits[typeValue].findIndex(t => t.value === value && t.typeValue === typeValue);
    const alreadySeenTrait = collectionTraits[typeValue][alreadySeenTraitIndex];

    if (alreadySeenTraitIndex === -1) {
        collectionTraits[typeValue].push({ ...trait, rarityTraitSum: 0, traitCount: 1 });
    } else {
        collectionTraits[typeValue][alreadySeenTraitIndex] = { ...alreadySeenTrait, traitCount: alreadySeenTrait.traitCount + 1 };
    }
};

/**
 * Given all the NFTs in a collection, build up the collection-wide traits object.
 * @param nfts All NFTs in the collection, w/ traits attached
 * @returns An object with `traitType: arrayOfTraitsOfThisType` key-value pairs, with each trait having the
 * correct `traitCount`.
 */
const getCollectionTraits = (nfts: NftInit[]): Record<string, TraitPreDb[]>=>{
    const collectionTraitsNoRarity: Record<string, TraitPreDb[]> = {};
    nfts.forEach(nft=>{
        nft.traits.forEach(t => {
            pushTraitToCollectionTraits(collectionTraitsNoRarity, t);
        });
    });

    // add in "none" values, such that if something is a 1/1, the `collectionTraitValueCountPairs
    // will go from [["Galaxy Figher",1]] -> [["Galaxy Figher",1], ["none",9999]]
    Object.keys(collectionTraitsNoRarity).forEach(traitType => {
        const collectionTraitValueCountPairs = collectionTraitsNoRarity[traitType];
        // For every NFT in the collection, see if it has a trait of this type.
        let sum = 0;
        nfts.forEach(n => {
            // Whether we've already seen this trait type in this NFT, as some NFTs
            // might have multiple of the same trait type
            let seenTraitType = false;
            n.traits.forEach(nt => { if (nt.typeValue === traitType) seenTraitType = true; });
            if (seenTraitType)
                sum += 1;
        });

        if (sum !== nfts.length) {
            collectionTraitValueCountPairs.push({
                typeValue: traitType, value: NONE_TRAIT, traitCount: nfts.length - sum, rarityTraitSum: 0, category: 'None', displayType: null,
            });
        }
    });

    return collectionTraitsNoRarity;
};

/**
 * Calculates the rarity for each trait, their rankings, and the all-up
 * collection's traits
 * @param nfts Nfts with unranked, unrated traits
 * @returns Nfts with their rank and with rated traits, and the all-up
 */
export const calculateRarity = (nfts: NftInit[]): { nftsWithRarityAndRank: NftWithRank[], collectionTraits: Record<string, TraitPreDb[]> } => {
    const nftsWithRarity: NftWithRatedTraits[] = [];

    const collectionTraitsNoRarity = getCollectionTraits(nfts);
    const collectionTraits: Record<string, TraitPreDb[]> = {};


    let maxTraitsNum = -1;
    nfts.forEach(nft => {
        let numTraits: number;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const traitCountTrait = nft.traits.find(t=>t.category === 'Meta' && t.typeValue === TRAIT_COUNT);
        // If we have a "Trait Count" trait, use that, otherwise naively filter out "none" and use the remaining
        // traits' length
        if (traitCountTrait){
            numTraits = +traitCountTrait.value;
        } else {
            numTraits = nft.traits.filter(t=>t.value.toLowerCase() !== NONE_TRAIT.toLowerCase()).length;
        }
        maxTraitsNum = Math.max(maxTraitsNum, numTraits );
    });

    // For each NFT, go through every trait it has / doesn't have, summing the rarity of each individual trait
    // to produce the final `rarityTraitSum` for the NFT. At the same time, add the traits with their now-calculated
    // rarity to our all up `collectionTraits` object.
    nfts.forEach(nft=>{
        let rarityTraitSum = 0;
        const nftTraitsWithRarity: TraitPreDb[] = [];

        Object.keys(collectionTraitsNoRarity).forEach(traitType => {
            const traitValuesOfThisType = collectionTraitsNoRarity[traitType];
            if (traitValuesOfThisType.length === 0)
                return;
            const category = traitValuesOfThisType[0].category;
            if (category === 'Meta' && traitType !== TRAIT_COUNT)
                return;

            // The trait is either the nft's trait w/ this type, or this type's "none"
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const trait = traitValuesOfThisType.find(t => t.typeValue === traitType) ?? traitValuesOfThisType.find(t => t.category === 'None')!;

            // Temporarily disable this ahead of reworking our trait calculation
            if (trait.category === 'None') return;
            const { value, typeValue } = trait;
            const currTraitValueCount = trait.traitCount;
            const collectionTraitValueCountPairs = collectionTraitsNoRarity[typeValue];


            const traitTypeCount = collectionTraitValueCountPairs.length;
            const currTraitRarity = traitRarityTraitSum(
                currTraitValueCount, nfts.length, traitTypeCount);


            let currTraitSum = 0;
            if (typeValue === TRAIT_COUNT) {
                currTraitSum = currTraitRarity * (maxTraitsNum - nft.traits.length);
            } else if (trait.category !== 'Meta') {
                currTraitSum = currTraitRarity;
            }

            currTraitSum = +currTraitSum.toFixed(3);

            if (!collectionTraits[typeValue])
                collectionTraits[typeValue] = [];

            if (!collectionTraits[typeValue].find(t => t.value === value))
                collectionTraits[typeValue].push(({ ...trait, traitCount: currTraitValueCount, rarityTraitSum: currTraitSum }));

            rarityTraitSum += currTraitSum;

            nftTraitsWithRarity.push({ ...trait, traitCount: 1, rarityTraitSum: currTraitSum });
        },
        );

        nftsWithRarity.push({ ...nft, traits: nftTraitsWithRarity, rarityTraitSum });
    });

    // Get all the array of all the NFTs' rarities, which after sorting we can use to find an NFT's rank
    const rarities = nftsWithRarity.map(nft=>nft.rarityTraitSum);

    // Sort rarities from highest to lowest
    rarities.sort((a, b)=>b - a);

    // Now that we've calculated the rarity of each NFT, we can calculate each NFT's rank
    const nftsWithRarityAndRank: NftWithRank[] = nftsWithRarity.map(n=>({
        ...n,
        // Below will also handle the case where two NFTs have the same
        // rarity score
        rarityTraitSumRank: rarities.indexOf(n.rarityTraitSum) + 1,
    }));

    return { nftsWithRarityAndRank, collectionTraits };
};


/**
 * Calculate the meta traits for an NFT within a collection. There will be a lot of collection-specific logic in here
 * around our "matches" meta trait
 * @param nftTraits
 * @param collection
 * @returns
 */
export const calcMetaTraits = ( nftTraits: TraitBase[], collection: string): TraitBase[]=>{
    const metaTraits: TraitBase[] = [];

    // Call all the functions that calculate meta traits for this collection
    collectionNameMetaFunctionPairs.forEach(colMetaFuncPair=>{
        if (Object.keys(colMetaFuncPair)[0] === collection){
            colMetaFuncPair[collection](nftTraits, metaTraits);
        }
    });

    const traitValueMatches = getNftTraitsMatches(nftTraits, collection);

    // Calculate our "Matches" meta trait

    Object.keys(traitValueMatches).forEach(val => {
        const numMatches = traitValueMatches[val];

        if (numMatches > 1) {
            metaTraits.push({
                typeValue: 'Matches',
                value: `${numMatches} - ${val}`,
                category: 'Meta',
                displayType: null,
            });
        }
    });

    return metaTraits;
};
