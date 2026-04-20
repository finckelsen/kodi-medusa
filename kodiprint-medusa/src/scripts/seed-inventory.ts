import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

export default async function seedInventory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventoryService = container.resolve(Modules.INVENTORY);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  logger.info("Starting inventory seeding...");

  // Get stock location
  const stockLocations = await stockLocationService.listStockLocations({});
  const stockLocation = stockLocations[0];

  if (!stockLocation) {
    logger.error("No stock location found!");
    return;
  }

  logger.info(`Using stock location: ${stockLocation.name} (${stockLocation.id})`);

  // Get all product variants
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku", "variants.manage_inventory"],
  });

  logger.info(`Found ${products?.length || 0} products`);

  for (const product of products || []) {
    logger.info(`Processing ${product.handle}...`);

    for (const variant of product.variants || []) {
      if (!variant.manage_inventory) {
        logger.info(`  ${variant.sku}: inventory not managed, skipping`);
        continue;
      }

      try {
        // Check if inventory item already exists for this variant
        const { data: existingLinks } = await query.graph({
          entity: "product_variant",
          fields: ["id", "inventory_items.inventory_item_id"],
          filters: { id: variant.id },
        });

        const existingInventoryItemId = existingLinks?.[0]?.inventory_items?.[0]?.inventory_item_id;

        if (existingInventoryItemId) {
          logger.info(`  ${variant.sku}: already has inventory item ${existingInventoryItemId}`);

          // Check if there's a level at this location
          const levels = await inventoryService.listInventoryLevels({
            inventory_item_id: existingInventoryItemId,
            location_id: stockLocation.id,
          });

          if (levels.length === 0) {
            // Create inventory level
            await inventoryService.createInventoryLevels({
              inventory_item_id: existingInventoryItemId,
              location_id: stockLocation.id,
              stocked_quantity: 1000,
            });
            logger.info(`  ${variant.sku}: created inventory level with 1000 stock`);
          } else {
            logger.info(`  ${variant.sku}: inventory level already exists (${levels[0].stocked_quantity} in stock)`);
          }
          continue;
        }

        // Create new inventory item
        const inventoryItem = await inventoryService.createInventoryItems({
          sku: variant.sku,
          requires_shipping: true,
        });

        logger.info(`  ${variant.sku}: created inventory item ${inventoryItem.id}`);

        // Link inventory item to variant
        await link.create({
          [Modules.PRODUCT]: {
            variant_id: variant.id,
          },
          [Modules.INVENTORY]: {
            inventory_item_id: inventoryItem.id,
          },
        });

        logger.info(`  ${variant.sku}: linked to variant`);

        // Create inventory level at stock location
        await inventoryService.createInventoryLevels({
          inventory_item_id: inventoryItem.id,
          location_id: stockLocation.id,
          stocked_quantity: 1000,
        });

        logger.info(`  ${variant.sku}: created inventory level with 1000 stock`);

      } catch (error: any) {
        logger.error(`  ${variant.sku}: error - ${error.message}`);
      }
    }
  }

  logger.info("Finished seeding inventory!");
}
