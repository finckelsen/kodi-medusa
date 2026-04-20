import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

export default async function setPersonalization({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productService = container.resolve(Modules.PRODUCT);

  logger.info("Setting supports_personalization on sportflaska products...");

  // Get all products
  const products = await productService.listProducts(
    {},
    { take: 500 }
  );

  let updated = 0;

  for (const product of products) {
    const handle = product.handle || "";
    const baseProduct = product.metadata?.base_product || handle;

    // Sportflaska (including förening variants like sportflaska-boden-city-fc)
    const isFlaska =
      baseProduct === "sportflaska" ||
      handle === "sportflaska" ||
      handle.startsWith("sportflaska-");

    if (isFlaska) {
      await productService.updateProducts(product.id, {
        metadata: {
          ...product.metadata,
          supports_personalization: true,
        },
      });
      logger.info(`  ✓ ${product.title} → supports_personalization: true`);
      updated++;
    }
  }

  logger.info(`\nDone! Updated ${updated} sportflaska products.`);
}
