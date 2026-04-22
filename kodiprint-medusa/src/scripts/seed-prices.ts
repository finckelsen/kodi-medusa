import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

// Prices in öre (smallest currency unit for SEK)
// 139 SEK = 13900 öre
const productPrices: Record<string, number> = {
  "termosflaska": 17900,
  "sportflaska": 13900,
  "kontorsflaska": 15900,
  "olglas": 14900,
  "dryckesglas": 14900,
  "underlagg": 15900,
};

export default async function seedPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const pricingService = container.resolve(Modules.PRICING);

  logger.info("Starting price seeding...");

  // Get all products with their variants
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
  });

  logger.info(`Found ${products?.length || 0} products`);

  for (const product of products || []) {
    const priceAmount = productPrices[product.handle];

    if (!priceAmount) {
      logger.info(`Skipping ${product.handle} - no price defined`);
      continue;
    }

    logger.info(`Setting prices for ${product.handle} (${priceAmount} SEK)...`);

    for (const variant of product.variants || []) {
      try {
        // Check if there's already a linked price set for this variant
        const { data: existingLinks } = await query.graph({
          entity: "product_variant",
          fields: ["id", "price_set.id"],
          filters: { id: variant.id },
        });

        const existingPriceSetId = existingLinks?.[0]?.price_set?.id;

        if (existingPriceSetId) {
          logger.info(`  ${variant.sku} already has price set ${existingPriceSetId}`);

          // Update the price in the existing price set
          const existingPriceSet = await pricingService.retrievePriceSet(existingPriceSetId, {
            relations: ["prices"],
          });

          // Check if SEK price exists
          const sekPrice = existingPriceSet.prices?.find((p: any) => p.currency_code === "sek");

          if (!sekPrice) {
            await pricingService.addPrices({
              priceSetId: existingPriceSetId,
              prices: [
                {
                  amount: priceAmount,
                  currency_code: "sek",
                },
              ],
            });
            logger.info(`  Added SEK price ${priceAmount} öre to existing price set`);
          } else if (sekPrice.amount !== priceAmount) {
            // Update the price if it's different
            await (pricingService as any).updatePrices([
              {
                id: sekPrice.id,
                amount: priceAmount,
              },
            ]);
            logger.info(`  Updated SEK price from ${sekPrice.amount} to ${priceAmount} öre`);
          } else {
            logger.info(`  SEK price already correct: ${sekPrice.amount} öre`);
          }
          continue;
        }

        // Create a new price set with the price
        const priceSet = await pricingService.createPriceSets({
          prices: [
            {
              amount: priceAmount,
              currency_code: "sek",
            },
          ],
        });

        logger.info(`  Created price set ${priceSet.id} for ${variant.sku}`);

        // Link the price set to the variant
        await link.create({
          [Modules.PRODUCT]: {
            variant_id: variant.id,
          },
          [Modules.PRICING]: {
            price_set_id: priceSet.id,
          },
        });

        logger.info(`  Linked price set to variant ${variant.sku}`);

      } catch (error: any) {
        logger.error(`  Error setting price for ${variant.sku}: ${error.message}`);
      }
    }
  }

  logger.info("Finished seeding prices!");
}
