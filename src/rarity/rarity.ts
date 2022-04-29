import { NftInit, NftWithRank, NftWithRatedTraits, TraitBase, TraitPreDb } from '../types';
import { collectionNameMetaFunctionPairs, ensCollectionSizes, EnsCollectionSlug, ensCollectionSlugs, getNftTraitsMatches, ID_TRAIT_TYPE, NONE_TRAIT, stringToKeccak256DecimalId, TRAIT_COUNT } from './rarity.meta';

/**
 * Gets the component of the trait score that isn't the weight.
 * @param traitCount
 * @param collectionSize
 * @param numValuesForThisType
 * @returns
 */
const calculateBaseTraitScore = (traitCount: number, collectionSize: number, numValuesForThisType: number) => (collectionSize / numValuesForThisType) * (1 / traitCount);

/**
 * Calculate an individual trait's rarity score.
 * @param traitCount
 * @param collectionSize
 * @param numValuesForThisType
 * @param traitWeight
 * @returns
 */
export const calculateTraitScore = (traitCount: number, collectionSize: number, numValuesForThisType: number, traitWeight: number) =>
    +(traitWeight * calculateBaseTraitScore(traitCount, collectionSize, numValuesForThisType)).toFixed(3);

/**
 * Push a trait to the all-up collection's traits obj.
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
            // If this NFT doesn't have a trait of type `traitType`
            // Add to the collection-wide "None" trait type's count
            if (!n.traits.find(t => t.typeValue === traitType)) {
                pushTraitToCollectionTraits(collectionTraitsNoRarity, {
                    typeValue: traitType, value: NONE_TRAIT, category: 'None', displayType: null,
                });
            }
        });
    });

    return collectionTraitsNoRarity;
};

/**
 * Calculate the meta traits for an NFT within a collection. There will be a lot of collection-specific logic in here
 * around our "matches" meta trait.
 * @param nftTraits
 * @param collection
 * @param addMeta whether to add all non Trait Count meta traits. Trait Count is always added
 * @returns
 */
export const getMetaTraits = (nftTraits: TraitBase[], collection: string, addMeta?: boolean): TraitBase[] => {
    // Initialize meta traits with the "Trait Count" trait
    const metaTraits: TraitBase[] = [{
        typeValue: TRAIT_COUNT,
        value: `${nftTraits.filter(t => t.category !== 'None').length}`,
        category: 'Meta',
        displayType: null,
    }];

    // Return early if no more meta traits are requested
    if (!addMeta) return metaTraits;

    // Call this collection's meta trait function, if it exists
    const collectionMetaFunctionPair = collectionNameMetaFunctionPairs.find(
        collectionFunctionPair => Object.keys(collectionFunctionPair)[0] === collection);
    if (collectionMetaFunctionPair) metaTraits.push(...collectionMetaFunctionPair[collection](nftTraits));

    // Calculate our "Matches" meta trait
    const traitValueMatches = getNftTraitsMatches(nftTraits, collection);
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

    // if (metaTraits.find(t => t.value === 'Triple')) console.log(metaTraits);

    return metaTraits;
};

/**
 * Calculate the "weight" (constant by which we multiply every trait's score) for the collection.
 * We calculate a value such that the lowest individual trait's rarity score is 1.
 *
 * NOTE: This weighting is arbitrary, but as it's the same weighting we're using for every trait in the collection,
 * the value won't affect the rankings at all.
 * @param collectionTraits
 * @param collectionSize
 */
const calculateCollectionRarityWeight = (collectionTraits: Record<string, TraitPreDb[]>, collectionSize: number) => {
    let minNonWeightComponent = Infinity;

    Object.values(collectionTraits).forEach(traitTypeArray => {
        // If this is a meta trait that isn't trait count, don't count it
        if (traitTypeArray.find(t => t.category === 'Meta' && t.typeValue !== TRAIT_COUNT))
            return;
        traitTypeArray.forEach(trait => {
            // Ignore all non trait count "meta" traits
            if (trait.category === 'Meta' && trait.typeValue !== TRAIT_COUNT)
                return;
            if (minNonWeightComponent > calculateBaseTraitScore(trait.traitCount, collectionSize, traitTypeArray.length)) {

                minNonWeightComponent = Math.min(minNonWeightComponent, calculateBaseTraitScore(trait.traitCount, collectionSize, traitTypeArray.length));
            }
        });
    });

    return 1 / minNonWeightComponent;
};

/**
 * Calculates the rarity for each trait, their rankings, and the all-up
 * collection's traits.
 * @param nfts Nfts with unranked, unrated traits
 * @returns Nfts with their rank and with rated traits, and the all-up
 */
export const getAllNftsRarity = (nfts: NftInit[]): { nftsWithRarityAndRank: NftWithRank[], collectionTraits: Record<string, TraitPreDb[]>; } => {
    const collection = nfts[0].collection;
    // Add all the base traits to the traits we'll add to the NFT, and calculate all "matches"
    nfts.forEach(nft => {
        if (ensCollectionSlugs.includes(collection as EnsCollectionSlug)) {
            const max = ensCollectionSizes[collection as EnsCollectionSlug];
            const digits = max.toString().length - 1;
            // Reverse engineer the number value of the ENS given its name or tokenID
            let i = 0;
            if (nft.name.includes('eth')) {
                i = +nft.name.replace('.eth', '');
            } else {
                for (i = 0; i < 10000; i++) {
                    const id = stringToKeccak256DecimalId(i.toString(), digits);

                    // Find the initial integer ID
                    if (id === nft.id) break;
                }
            }
            nft.traits.push({
                value: i.toString(),
                category: 'Traits',
                typeValue: ID_TRAIT_TYPE,
                displayType: 'number',
            });
        }
        nft.traits.push(...getMetaTraits(nft.traits, nft.collection, true));
    });

    const nftsWithRarity: NftWithRatedTraits[] = [];

    const collectionTraitsNoRarity = getCollectionTraits(nfts);
    const collectionTraits: Record<string, TraitPreDb[]> = {};

    const pushRatedTraitToCollectionTraits = (trait: TraitPreDb) => {
        const { typeValue, value } = trait;
        if (!collectionTraits[typeValue])
            collectionTraits[typeValue] = [];

        if (!collectionTraits[typeValue].find(t => t.value === value))
            collectionTraits[typeValue].push((trait));
    };

    // find the trait weighting for all traits' rarities in this collection
    const weight = calculateCollectionRarityWeight(collectionTraitsNoRarity, nfts.length);

    // For each NFT, go through every trait it has / doesn't have, summing the rarity of each individual trait
    // to produce the final `rarityTraitSum` for the NFT. At the same time, add the traits with their now-calculated
    // rarity to our all up `collectionTraits` object.
    nfts.forEach(nft => {
        let rarityTraitSum = 0;
        const nftTraitsWithRarity: TraitPreDb[] = [];

        // All the NFTs' traits, and the "None" traits
        const traitsToParse = nft.traits;

        // Add the "None" traits for all non-Meta traits
        Object.keys(collectionTraitsNoRarity).forEach(traitType => {
            if (!nft.traits.find(t => t.typeValue === traitType) && !collectionTraitsNoRarity[traitType].find(t => t.category === 'Meta')) {
                traitsToParse.push(collectionTraitsNoRarity[traitType].find(t => t.category === 'None')!);
            }
        });

        traitsToParse.forEach(trait => {
            // The trait is either the nft's trait w/ this type, or this type's "none"
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { value, typeValue, category } = trait;
            const currTraitValueCount = collectionTraitsNoRarity[typeValue].find(t => t.value === value)!.traitCount;

            // Adds the rated trait to the output `collectionTraits` obj if it's not already there

            // For all non trait-count meta traits, don't calculate the rarity. If it's not none though, still
            // add it to the end traits array
            if (category === 'Meta' && typeValue !== TRAIT_COUNT) {
                if (trait.category !== 'None') {
                    const ratedTrait = { ...trait, traitCount: currTraitValueCount, rarityTraitSum: 0 };
                    pushRatedTraitToCollectionTraits(ratedTrait);
                    nftTraitsWithRarity.push(ratedTrait);
                }
                return;
            }

            const collectionTraitValueCountPairs = collectionTraitsNoRarity[typeValue];

            const traitTypeCount = collectionTraitValueCountPairs.length;
            const currTraitRarity = calculateTraitScore(
                currTraitValueCount, nfts.length, traitTypeCount, weight);
            const ratedTrait = { ...trait, traitCount: currTraitValueCount, rarityTraitSum: currTraitRarity };

            rarityTraitSum += currTraitRarity;

            // Push this trait to the collection-wide object if it's not there
            pushRatedTraitToCollectionTraits(ratedTrait);

            // Don't add "None" traits to the final array, they're implicit
            // if (trait.category !== 'None')
            nftTraitsWithRarity.push(ratedTrait);
        },
        );

        // Collections for which rarity doesn't make sense
        if (ensCollectionSlugs.includes(collection as EnsCollectionSlug)) {
            rarityTraitSum = 0;
        }

        nftTraitsWithRarity.sort((a, b) => b.rarityTraitSum - a.rarityTraitSum);
        nftsWithRarity.push({ ...nft, traits: nftTraitsWithRarity, rarityTraitSum: +rarityTraitSum.toFixed(3) });
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
