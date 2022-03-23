export type TraitCategory = 'Traits' | 'Meta' | 'None';
export type DisplayType = 'number' | null;

export interface TraitBase {
    typeValue: string;
    value: string;
    category: TraitCategory;
    displayType: DisplayType;
}

export interface TraitPreDb extends TraitBase {
    rarityTraitSum: number;
    traitCount: number;
}
export interface Trait extends TraitPreDb {
    id: string;
    minPrice?: number;
}


// THESE TYPES I'LL RENAME ONCE THEYRE IN THEIR OWN PACKAGE
export interface NftInit {
    collection: string;
    name: string;
    id: string;
    address: string;
    imageUrl: string;
    metadataUrl: string;
    rating: number;
    timesSeen: number;
    timesWon: number;
    aestheticRank: number;
    traits: TraitBase[];
}

export interface NftWithRatedTraits extends NftInit {
    traits: TraitPreDb[];
    rarityTraitSum: number;
}

export interface NftWithRank extends NftWithRatedTraits {
    rarityTraitSumRank: number;
}
