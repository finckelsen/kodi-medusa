import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

export default async function setVingaLeanPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const pricingService = container.resolve(Modules.PRICING);

  logger.info("Setting prices on Vinga Lean Rosa & Blå variants...");

  // Use query.graph to get variants with price_set link info
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "price_set.id"],
    filters: {
      id: [
        "variant_01KJX43V4S36JZ50VX0JRQ2BVP", // Rosa
        "variant_01KJX44649G76TW3AJH0NEFCFB", // Blå
      ],
    },
  });

  for (const variant of variants ?? []) {
    if (variant.price_set?.id) {
      logger.info(`  "${variant.title}" already has price set — skipping`);
      continue;
    }

    // Create price set with 149 SEK (same as Svart/Transparent baseline)
    const priceSet = await pricingService.createPriceSets({
      prices: [{ amount: 149, currency_code: "sek" }],
    });

    // Link price set → variant
    await link.create({
      [Modules.PRODUCT]: { variant_id: variant.id },
      [Modules.PRICING]: { price_set_id: priceSet.id },
    });

    logger.info(`  ✓ "${variant.title}" → price set ${priceSet.id} (149 SEK)`);
  }

  logger.info("\nDone!");
}
