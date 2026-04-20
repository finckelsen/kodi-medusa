import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

export default async function fixRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const regionService = container.resolve(Modules.REGION);
  const storeService = container.resolve(Modules.STORE);

  logger.info("Fixing region currency...");

  // Get the region
  const regions = await regionService.listRegions({});
  const swedenRegion = regions.find((r: any) => r.name === "Sverige");

  if (!swedenRegion) {
    logger.error("Sweden region not found!");
    return;
  }

  logger.info(`Current region: ${swedenRegion.name}, currency: ${swedenRegion.currency_code}`);

  if (swedenRegion.currency_code !== "sek") {
    // Update the region to use SEK
    await regionService.updateRegions(swedenRegion.id, {
      currency_code: "sek",
    });
    logger.info("Updated region currency to SEK");
  } else {
    logger.info("Region already uses SEK");
  }

  // Also update the store's supported currencies
  const stores = await storeService.listStores({});
  const store = stores[0];

  if (store) {
    logger.info(`Current store supported currencies: ${JSON.stringify(store.supported_currencies)}`);

    // Check if SEK is already in supported currencies
    const hasSek = store.supported_currencies?.some((c: any) => c.currency_code === "sek");

    if (!hasSek) {
      await storeService.updateStores(store.id, {
        supported_currencies: [
          { currency_code: "sek", is_default: true },
        ],
      });
      logger.info("Updated store to support SEK as default currency");
    } else {
      logger.info("Store already supports SEK");
    }
  }

  logger.info("Done fixing region!");
}
