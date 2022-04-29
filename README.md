# Rankings

This package holds PopRank's NFT rankings logic. Curious as to how we calculate our rarity and aesthetics scores? Well, we believe it should be transparent, so it's all laid out publicly here!

For a more hands-on example which involves pulling NFTs from OpenSea via their API and then calculating their rarity, check out the example in our [@poprank/opensea package](https://www.npmjs.com/package/@poprank/opensea)

Please join us in our [Discord](https://discord.com/invite/9R5RzdUbXb) too, we'd love to chat with you

Install via npm / yarn:

```
yarn add @poprank/rankings
```

## Example

In order to run the example, you need to have Node / NPM installed. To run a typescript file, we suggest installing `npx` such that you can run `npx ts-node <filename>.ts`.

There are numerous how-to's online about this that can explain it better than we can.

By default, our `example.ts` will use our saved collection we use for tests, in the rarity/ folder, which is an array of our `NftBase` type - NFTs with traits attached to them, but no rarity / trait counts calculated yet.

The example will calculate the rarity for the collection, saving the final rankings both in its JSON form, and a simple HTML file that'll show you visually the top 100 ranked NFTs!

You can make whatever edits you wish to our rarity algorithm and re-run the example.ts to see how it impacts the end result! We'd love to hear what you come up with :)
