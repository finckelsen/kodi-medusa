import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

// Hex colors extracted from product photos
const COLOR_HEX: Record<string, string> = {
  svart:       "#4D505A", // dark smoke grey
  transparent: "#C5C9D1", // light grey (simulates clear/transparent)
  rosa:        "#E0488F", // deep pink / magenta
  blå:         "#00AECB", // teal / cyan
};

export default async function setVingaLeanColors({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productService = container.resolve(Modules.PRODUCT);

  logger.info("Setting body_color metadata on Vinga Lean variants...");

  // Fetch product by handle
  const [product] = await productService.listProducts(
    { handle: "vinga-lean" },
    { relations: ["variants", "variants.options", "options", "options.values"] }
  );

  if (!product) {
    logger.error("Product with handle 'vinga-lean' not found!");
    return;
  }

  logger.info(`Found product: ${product.title} (${product.id})`);

  let updated = 0;

  for (const variant of product.variants ?? []) {
    // Find the Färg option value for this variant
    const colorOptionValue = (variant.options ?? []).find((o: any) => {
      // option_id matches the "Färg" option
      return true; // we'll just grab all option values and find the color
    });

    // Get all option values for this variant and find the color name
    const allOptionValues = (variant.options ?? []).map((o: any) =>
      (o.value ?? "").toLowerCase()
    );

    const matchedColor = allOptionValues.find(
      (v: string) => COLOR_HEX[v] !== undefined
    );

    if (!matchedColor) {
      logger.warn(
        `  ⚠ Variant "${variant.title}" — no matching color found in [${allOptionValues.join(", ")}]`
      );
      continue;
    }

    const hex = COLOR_HEX[matchedColor];

    await productService.updateProductVariants(variant.id, {
      metadata: {
        ...(variant.metadata ?? {}),
        body_color: hex,
      },
    });

    logger.info(`  ✓ "${variant.title}" (${matchedColor}) → body_color: ${hex}`);
    updated++;
  }

  logger.info(`\nDone! Updated ${updated} variants.`);
}
