import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function setupFulfillment({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);

  logger.info("Setting up fulfillment infrastructure...");

  // Check if stock location exists
  let stockLocations = await stockLocationService.listStockLocations({});

  if (stockLocations.length === 0) {
    logger.info("Creating stock location...");

    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "KODIPRINT Lager",
            address: {
              city: "Boden",
              country_code: "SE",
              address_1: "",
            },
          },
        ],
      },
    });

    stockLocations = stockLocationResult;
    logger.info(`Created stock location: ${stockLocations[0].name}`);
  } else {
    logger.info(`Stock location exists: ${stockLocations[0].name}`);
  }

  const stockLocation = stockLocations[0];

  // Link to fulfillment provider
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    });
    logger.info("Linked stock location to fulfillment provider");
  } catch (e: any) {
    logger.info("Fulfillment provider link already exists or not needed");
  }

  // Link to sales channel
  const salesChannels = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (salesChannels.length > 0) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: stockLocation.id,
          add: [salesChannels[0].id],
        },
      });
      logger.info("Linked stock location to sales channel");
    } catch (e: any) {
      logger.info("Sales channel link already exists");
    }
  }

  logger.info("Fulfillment setup complete!");
  logger.info(`Stock location ID: ${stockLocation.id}`);
}
