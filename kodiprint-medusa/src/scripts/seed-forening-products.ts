import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import * as fs from "fs";
import * as path from "path";

// Map base product handle to the primary image filename
const productImageFiles: Record<string, string> = {
  sportflaska: "sportflaska-svart.jpg",
  termosflaska: "termos.jpg",
  kontorsflaska: "kontorsflaska-svart.jpg",
  olglas: "olglas.jpg",
  dryckesglas: "dryckesglas.jpg",
  underlagg: "underlagg.jpg",
};

// Path to the storefront's product images
const IMAGES_BASE = path.resolve(
  __dirname,
  "../../../kodiprint-storefront/public/uploads/foreningar"
);

// Base products with prices in öre
const baseProducts = [
  { handle: "sportflaska", title: "Sportflaska", price: 13900, description: "Smidig sportflaska i BPA-fri plast. 750ml kapacitet.", supports_personalization: true },
  { handle: "termosflaska", title: "Termosflaska", price: 17900, description: "Dubbelväggig termosflaska i rostfritt stål. Håller drycken kall i 24h eller varm i 12h.", supports_personalization: true },
  { handle: "kontorsflaska", title: "Kontorsflaska", price: 15900, description: "Elegant kontorsflaska i glas med silikonskydd. 500ml.", supports_personalization: true },
  { handle: "olglas", title: "Ölglas", price: 14900, description: "Klassiskt ölglas med föreningens logga. 50cl kapacitet.", supports_personalization: false },
  { handle: "dryckesglas", title: "Dryckesglas", price: 14900, description: "Stilrent dryckesglas för alla tillfällen. 40cl.", supports_personalization: false },
  { handle: "underlagg", title: "Bordsunderlägg 6-pack", price: 15900, description: "Set med 6 glasunderlägg i kork med föreningens logga.", supports_personalization: false },
];

export default async function seedForeningProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productService = container.resolve(Modules.PRODUCT);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const pricingService = container.resolve(Modules.PRICING);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const inventoryService = container.resolve(Modules.INVENTORY);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const fileService = container.resolve(Modules.FILE);

  logger.info("Starting förening products seeding...");

  // Get all customers that are föreningar
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "metadata"],
  });

  // Filter to only föreningar and map to simpler structure
  const foreningar = (customers || [])
    .filter((customer: any) => customer.metadata?.is_forening === true)
    .map((customer: any) => ({
      id: customer.id,
      name: customer.metadata?.foreningsnamn || "Okänd förening",
      slug: customer.metadata?.slug || null,
    }))
    .filter((f: any) => f.slug); // Only include föreningar with slug

  if (foreningar.length === 0) {
    logger.error("No föreningar found!");
    return;
  }

  logger.info(`Found ${foreningar.length} föreningar`);

  // Get default sales channel
  const salesChannels = await salesChannelService.listSalesChannels({});
  const defaultSalesChannel = salesChannels[0];

  if (!defaultSalesChannel) {
    logger.error("No sales channel found!");
    return;
  }

  // Get stock location
  const stockLocations = await stockLocationService.listStockLocations({});
  const stockLocation = stockLocations[0];

  // Get or create product category for föreningar
  let foreningCategory;
  const categories = await productService.listProductCategories({ name: "Föreningsprodukter" });

  if (categories.length === 0) {
    foreningCategory = await productService.createProductCategories({
      name: "Föreningsprodukter",
      handle: "foreningsprodukter",
      is_active: true,
    });
    logger.info("Created category: Föreningsprodukter");
  } else {
    foreningCategory = categories[0];
  }

  // Create products for each förening
  for (const forening of foreningar) {
    logger.info(`\nProcessing ${forening.name}...`);

    for (const baseProduct of baseProducts) {
      const productHandle = `${baseProduct.handle}-${forening.slug}`;
      const productTitle = `${baseProduct.title} - ${forening.name}`;

      // Check if product already exists
      const existingProducts = await productService.listProducts({ handle: productHandle });

      if (existingProducts.length > 0) {
        logger.info(`  ${productTitle} already exists, skipping`);
        continue;
      }

      try {
        // Create the product without variants first
        const product = await productService.createProducts({
          title: productTitle,
          handle: productHandle,
          description: baseProduct.description,
          status: "published",
          metadata: {
            forening_id: forening.id,
            forening_slug: forening.slug,
            forening_name: forening.name,
            base_product: baseProduct.handle,
            supports_personalization: baseProduct.supports_personalization,
          },
          categories: [{ id: foreningCategory.id }],
        });

        // Create variant separately
        const variant = await productService.createProductVariants({
          product_id: product.id,
          title: "Standard",
          sku: `${baseProduct.handle.toUpperCase()}-${forening.slug.toUpperCase()}`,
          manage_inventory: true,
        });

        logger.info(`  Created: ${productTitle}`);

        // Upload and set product thumbnail
        const imageFilename = productImageFiles[baseProduct.handle];
        if (imageFilename) {
          const imagePath = path.join(IMAGES_BASE, forening.slug, "products", imageFilename);
          if (fs.existsSync(imagePath)) {
            try {
              const fileContent = fs.readFileSync(imagePath);
              const uploaded = await fileService.createFiles({
                filename: `${productHandle}-${imageFilename}`,
                mimeType: "image/jpeg",
                content: fileContent,
                access: "public",
              });
              const uploadedFile = Array.isArray(uploaded) ? uploaded[0] : uploaded;
              await productService.updateProducts(product.id, {
                thumbnail: uploadedFile.url,
                images: [{ url: uploadedFile.url }],
              });
              logger.info(`  Set thumbnail: ${uploadedFile.url}`);
            } catch (imgError: any) {
              logger.warn(`  Could not upload image: ${imgError.message}`);
            }
          } else {
            logger.warn(`  Image not found: ${imagePath}`);
          }
        }

        // Link to sales channel
        await link.create({
          [Modules.PRODUCT]: { product_id: product.id },
          [Modules.SALES_CHANNEL]: { sales_channel_id: defaultSalesChannel.id },
        });

        // Create price set with SEK price
        const priceSet = await pricingService.createPriceSets({
          prices: [
            {
              amount: baseProduct.price,
              currency_code: "sek",
            },
          ],
        });

        // Link price set to variant
        await link.create({
          [Modules.PRODUCT]: { variant_id: variant.id },
          [Modules.PRICING]: { price_set_id: priceSet.id },
        });

        logger.info(`  Set price: ${baseProduct.price / 100} SEK`);

        // Create inventory if stock location exists
        if (stockLocation) {
          const inventoryItem = await inventoryService.createInventoryItems({
            sku: variant.sku,
            requires_shipping: true,
          });

          await link.create({
            [Modules.PRODUCT]: { variant_id: variant.id },
            [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
          });

          await inventoryService.createInventoryLevels({
            inventory_item_id: inventoryItem.id,
            location_id: stockLocation.id,
            stocked_quantity: 1000,
          });

          logger.info(`  Created inventory: 1000 in stock`);
        }

      } catch (error: any) {
        logger.error(`  Error creating ${productTitle}: ${error.message}`);
      }
    }
  }

  logger.info("\nFinished seeding förening products!");
}
