import { TraitBase, TraitCategory } from '../types';

export const TRAIT_COUNT = 'Trait Count';
export const NONE_TRAIT = 'None';

/**
 * All the manual functions we use to add special "meta" traits to collections.
 * These meta traits don't affect rarity at all; they just make for more meaningful
 * trait filters on the frontend.
 */
export const collectionNameMetaFunctionPairs: Record<string, (nftTraits: TraitBase[], outTraits: TraitBase[]) => void>[] = [{
    'creatureworld': (nftTraits: TraitBase[], outTraits: TraitBase[]) => {
        const bg = nftTraits.find(t => t.typeValue === 'Background');
        const creature = nftTraits.find(t => t.typeValue === 'Creature');
        if (bg && creature) {
            if (bg.value === creature.value) {
                // Add trait count
                outTraits.push({
                    typeValue: 'Creature Background Match',
                    value: 'true',
                    category: 'Meta',
                    displayType: null,
                });
            }
        }
    },
}, {
    'deathbats-club': (nftTraits: TraitBase[], outTraits: TraitBase[]) => {
        nftTraits.forEach(trait => {
            const tType = trait.typeValue;
            if (['Brooks Wackerman', 'Johnny Christ', 'M. Shadows', 'Synyster Gates', 'Zacky Vengence', 'Zacky Vengeance', 'Shadows'].includes(tType) && !Object.keys(outTraits).includes('1 of 1')) {
                outTraits.push({
                    typeValue: '1 of 1',
                    value: tType,
                    category: 'Meta',
                    displayType: null,
                });
            }
        });
    },
}, {
    'mutant-ape-yacht-club': (nftTraits: TraitBase[], outTraits: TraitBase[]) => {
        const firstTrait = nftTraits[0].value;
        const baseTrait = {
            typeValue: 'Mutant Type',
            id: '',
            rarityTraitSum: 0,
            traitCount: 0,
            category: 'Meta' as TraitCategory,
            displayType: null,
        };

        if (firstTrait.includes('M1')) {
            outTraits.push({
                ...baseTrait,
                value: 'M1',

            });
        } else if (firstTrait.includes('M2')) {
            outTraits.push({
                ...baseTrait,
                value: 'M2',
            });
        } else {
            outTraits.push({
                ...baseTrait,
                value: 'M3',
            });
        }
    },
}];

/**
 * Get the "match" traits for a collection. Has some collection-specific logic to add desired
 * filters.
 * @param nftTraits
 * @param collection
 * @returns
 */
export const getNftTraitsMatches = (nftTraits: TraitBase[], collection: string): Record<string, number> => {
    const traitValueMatches: Record<string, number> = {};
    nftTraits.forEach((n: TraitBase) => {
        let scrubbedValue = n.value;

        // Ignore all "None" traits
        if (scrubbedValue === NONE_TRAIT) return;

        // Remove the first word from the trait, as it's always "M1/M2/M3"
        if (collection === 'mutant-ape-yacht-club')
            scrubbedValue = n.value.split(' ').slice(1).join(' ');

        // Attempt to match "Skin - Blue" and "Shirt - Light Blue"
        if (collection === 'doodles-official') {
            scrubbedValue = n.value.toLowerCase().replace('light ', '');
        }

        // Grab the first word of the trait type. This is to try match "Blue Shirt" and "Blue Hat".
        // Will likely make this more intelligent in the future, this is just a simple implementation
        scrubbedValue = n.value.split(' ')[0].toLowerCase();

        if (!traitValueMatches[scrubbedValue]) {
            traitValueMatches[scrubbedValue] = 0;

            // For Creature World, if an NFT is a "thermal", it has two, not just one, trait signifying that
            if (collection === 'creatureworld' && ['thermal', 'clouds'].includes(scrubbedValue))
                return;
        }

        traitValueMatches[scrubbedValue]++;
    });

    return traitValueMatches;
};
