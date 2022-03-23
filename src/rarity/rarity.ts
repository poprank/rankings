import { NftInit, NftWithRank, NftWithRatedTraits, TraitBase, TraitPreDb } from '../types';
import { collectionNameMetaFunctionPairs, getNftTraitsMatches, NONE_TRAIT, TRAIT_COUNT } from './rarity.meta';

/**
 * Gets the component of the trait score that isn't the weight
 * @param traitCount
 * @param collectionSize
 * @param numValuesForThisType
 * @returns
 */
const getBaseTraitScore = (traitCount: number, collectionSize: number, numValuesForThisType: number) => (collectionSize / numValuesForThisType) * (1 / traitCount);

/**
 * Calculate a trait's rarity score, with the following formula:
 *
 * @param traitCount
 * @param collectionSize
 * @param numValuesForThisType
 * @param traitWeight
 * @returns
 */
export const getTraitScore = (traitCount: number, collectionSize: number, numValuesForThisType: number, traitWeight: number) =>
    +(traitWeight * getBaseTraitScore(traitCount, collectionSize, numValuesForThisType)).toFixed(3);

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
const getCollectionTraits = (nfts: NftInit[]): Record<string, TraitPreDb[]> => {
    const collectionTraitsNoRarity: Record<string, TraitPreDb[]> = {};
    nfts.forEach(nft => {
        nft.traits.forEach(t => {
            pushTraitToCollectionTraits(collectionTraitsNoRarity, t);
        });
    });

    // add in "none" values, such that if something is a 1/1, the `collectionTraitValueCountPairs
    // will go from [["Galaxy Figher",1]] -> [["Galaxy Figher",1], ["none",9999]]
    nfts.forEach(n => {
        Object.keys(collectionTraitsNoRarity).forEach(traitType => {
            const category = collectionTraitsNoRarity[traitType][0].category;
            // If this NFT doesn't have a trait of type `traitType`, and this isn't a "Meta" trait,
            // Add to the collection-wide "None" trait type's count
            if (!n.traits.find(t => t.typeValue === traitType) && category !== 'Meta') {
                pushTraitToCollectionTraits(collectionTraitsNoRarity, {
                    typeValue: traitType, value: NONE_TRAIT, category: 'None', displayType: null,
                });
            }
        });
    });

    return collectionTraitsNoRarity;
};

/**
 * Calculate the "weight" (constant by which we multiply every trait's score) for the collection.
 * We calculate a value such that the lowest individual trait's rarity score is 1.
 *
 * NOTE: This weighting is arbitrary, but as it's the same weighting we're using for every trait in the collection,
 * the value won't affect the rankings at all
 * @param collectionTraits
 * @param collectionSize
 */
const getCollectionRarityWeight = (collectionTraits: Record<string, TraitPreDb[]>, collectionSize: number) => {
    let minNonWeightComponent = Infinity;

    Object.values(collectionTraits).forEach(traitTypeArray => {
        traitTypeArray.forEach(trait => {
            // Ignore all non trait count "meta" traits
            if (trait.category === 'Meta' && trait.typeValue !== TRAIT_COUNT)
                return;

            minNonWeightComponent = Math.min(minNonWeightComponent, getBaseTraitScore(trait.traitCount, collectionSize, traitTypeArray.length));
        });
    });

    return 1 / minNonWeightComponent;
};

/**
 * Calculates the rarity for each trait, their rankings, and the all-up
 * collection's traits
 * @param nfts Nfts with unranked, unrated traits
 * @returns Nfts with their rank and with rated traits, and the all-up
 */
export const calculateRarity = (nfts: NftInit[]): { nftsWithRarityAndRank: NftWithRank[], collectionTraits: Record<string, TraitPreDb[]>; } => {
    const nftsWithRarity: NftWithRatedTraits[] = [];

    const collectionTraitsNoRarity = getCollectionTraits(nfts);
    const collectionTraits: Record<string, TraitPreDb[]> = {};

    // find the trait weighting for all traits' rarities in this collection
    const weight = getCollectionRarityWeight(collectionTraitsNoRarity, nfts.length);

    let maxTraitsNum = -1;
    nfts.forEach(nft => {
        let numTraits: number;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const traitCountTrait = nft.traits.find(t => t.category === 'Meta' && t.typeValue === TRAIT_COUNT);
        // If we have a "Trait Count" trait, use that, otherwise naively filter out "none" and use the remaining
        // traits' length
        if (traitCountTrait) {
            numTraits = +traitCountTrait.value;
        } else {
            numTraits = nft.traits.filter(t => t.value.toLowerCase() !== NONE_TRAIT.toLowerCase()).length;
        }
        maxTraitsNum = Math.max(maxTraitsNum, numTraits);
    });

    // For each NFT, go through every trait it has / doesn't have, summing the rarity of each individual trait
    // to produce the final `rarityTraitSum` for the NFT. At the same time, add the traits with their now-calculated
    // rarity to our all up `collectionTraits` object.
    nfts.forEach(nft => {
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
            const trait = nft.traits.find(t => t.typeValue === traitType) ?? traitValuesOfThisType.find(t => t.category === 'None')!;

            const { value, typeValue } = trait;
            const currTraitValueCount = traitValuesOfThisType.find(t => t.value === value)!.traitCount;

            const collectionTraitValueCountPairs = collectionTraitsNoRarity[typeValue];


            const traitTypeCount = collectionTraitValueCountPairs.length;
            const currTraitRarity = getTraitScore(
                currTraitValueCount, nfts.length, traitTypeCount, weight);

            if (!collectionTraits[typeValue])
                collectionTraits[typeValue] = [];

            if (!collectionTraits[typeValue].find(t => t.value === value))
                collectionTraits[typeValue].push(({ ...trait, traitCount: currTraitValueCount, rarityTraitSum: currTraitRarity }));

            rarityTraitSum += currTraitRarity;

            nftTraitsWithRarity.push({ ...trait, traitCount: 1, rarityTraitSum: currTraitRarity });
        },
        );

        nftsWithRarity.push({ ...nft, traits: nftTraitsWithRarity, rarityTraitSum });
    });

    // Get all the array of all the NFTs' rarities, which after sorting we can use to find an NFT's rank
    const rarities = nftsWithRarity.map(nft => nft.rarityTraitSum);

    // Sort rarities from highest to lowest
    rarities.sort((a, b) => b - a);

    // Now that we've calculated the rarity of each NFT, we can calculate each NFT's rank
    const nftsWithRarityAndRank: NftWithRank[] = nftsWithRarity.map(n => ({
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
 * @param addMeta whether to add all non Trait Count meta traits. Trait Count is always added
 * @returns
 */
export const calcMetaTraits = (nftTraits: TraitBase[], collection: string, addMeta?: boolean): TraitBase[] => {
    const metaTraits: TraitBase[] = [];

    // Add the trait count
    metaTraits.push({
        typeValue: TRAIT_COUNT,
        value: `${nftTraits.filter(t => t.value.toLowerCase() !== NONE_TRAIT.toLowerCase()).length}`,
        category: 'Meta',
        displayType: null,
    });

    if (!addMeta) return metaTraits;

    // Call all the functions that calculate meta traits for this collection
    collectionNameMetaFunctionPairs.forEach(colMetaFuncPair => {
        if (Object.keys(colMetaFuncPair)[0] === collection) {
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
