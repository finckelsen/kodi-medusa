import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["se"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "sek",
          is_default: true,
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const paymentProviders = process.env.STRIPE_API_KEY
    ? ["pp_system_default", "pp_stripe_stripe"]
    : ["pp_system_default"]
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Sverige",
          currency_code: "sek",
          countries,
          payment_providers: paymentProviders,
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
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
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "KODIPRINT Leverans",
    type: "shipping",
    service_zones: [
      {
        name: "Sverige",
        geo_zones: [
          {
            country_code: "se",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standardfrakt",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Leverans inom 3-5 arbetsdagar.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "sek",
            amount: 79,
          },
          {
            region_id: region.id,
            amount: 79,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Expressfrakt",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Leverans inom 1-2 arbetsdagar.",
          code: "express",
        },
        prices: [
          {
            currency_code: "sek",
            amount: 149,
          },
          {
            region_id: region.id,
            amount: 149,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Flaskor",
          is_active: true,
        },
        {
          name: "Glas",
          is_active: true,
        },
        {
          name: "Tillbehör",
          is_active: true,
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Termosflaska",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Flaskor")!.id,
          ],
          description:
            "Dubbelväggig termosflaska i rostfritt stål. Håller drycker kalla i 24 timmar eller varma i 12 timmar. Perfekt för föreningens logga.",
          handle: "termosflaska",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Färg",
              values: ["Svart", "Vit", "Silver"],
            },
          ],
          variants: [
            {
              title: "Svart",
              sku: "TERMOS-SVART",
              options: {
                Färg: "Svart",
              },
              prices: [
                {
                  amount: 179,
                  currency_code: "sek",
                },
              ],
            },
            {
              title: "Vit",
              sku: "TERMOS-VIT",
              options: {
                Färg: "Vit",
              },
              prices: [
                {
                  amount: 179,
                  currency_code: "sek",
                },
              ],
            },
            {
              title: "Silver",
              sku: "TERMOS-SILVER",
              options: {
                Färg: "Silver",
              },
              prices: [
                {
                  amount: 179,
                  currency_code: "sek",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Sportflaska",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Flaskor")!.id,
          ],
          description:
            "Lätt och smidig sportflaska med pop-up lock. 750ml kapacitet. BPA-fri plast. Perfekt för träning och matcher.",
          handle: "sportflaska",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Färg",
              values: ["Svart", "Vit", "Röd"],
            },
          ],
          variants: [
            {
              title: "Svart",
              sku: "SPORT-SVART",
              options: {
                Färg: "Svart",
              },
              prices: [
                {
                  amount: 139,
                  currency_code: "sek",
                },
              ],
            },
            {
              title: "Vit",
              sku: "SPORT-VIT",
              options: {
                Färg: "Vit",
              },
              prices: [
                {
                  amount: 139,
                  currency_code: "sek",
                },
              ],
            },
            {
              title: "Röd",
              sku: "SPORT-ROD",
              options: {
                Färg: "Röd",
              },
              prices: [
                {
                  amount: 139,
                  currency_code: "sek",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Kontorsflaska",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Flaskor")!.id,
          ],
          description:
            "Snygg kontorsflaska med föreningens logga. Inkluderar personligt namn. Perfekt för kontoret eller hemmet.",
          handle: "kontorsflaska",
          weight: 280,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Färg",
              values: ["Svart", "Vit", "Rosa"],
            },
          ],
          variants: [
            {
              title: "Svart",
              sku: "KONTOR-SVART",
              options: {
                Färg: "Svart",
              },
              prices: [
                {
                  amount: 159,
                  currency_code: "sek",
                },
              ],
            },
            {
              title: "Vit",
              sku: "KONTOR-VIT",
              options: {
                Färg: "Vit",
              },
              prices: [
                {
                  amount: 159,
                  currency_code: "sek",
                },
              ],
            },
            {
              title: "Rosa",
              sku: "KONTOR-ROSA",
              options: {
                Färg: "Rosa",
              },
              prices: [
                {
                  amount: 159,
                  currency_code: "sek",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Ölglas",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Glas")!.id,
          ],
          description:
            "Klassiskt ölglas med föreningens logga. 50cl kapacitet. Perfekt för supporterträffar och föreningsfester.",
          handle: "olglas",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Variant",
              values: ["Standard"],
            },
          ],
          variants: [
            {
              title: "Standard",
              sku: "OLGLAS-STD",
              options: {
                Variant: "Standard",
              },
              prices: [
                {
                  amount: 149,
                  currency_code: "sek",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Dryckesglas",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Glas")!.id,
          ],
          description:
            "Stilrent dryckesglas med föreningens logga. Perfekt för alla typer av drycker.",
          handle: "dryckesglas",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Variant",
              values: ["Standard"],
            },
          ],
          variants: [
            {
              title: "Standard",
              sku: "DRYCKESGLAS-STD",
              options: {
                Variant: "Standard",
              },
              prices: [
                {
                  amount: 149,
                  currency_code: "sek",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Bordsunderlägg",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Tillbehör")!.id,
          ],
          description:
            "Set med 6 glasunderlägg med föreningens logga. Perfekt present eller för klubbstugan.",
          handle: "underlagg",
          weight: 100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Variant",
              values: ["6-pack"],
            },
          ],
          variants: [
            {
              title: "6-pack",
              sku: "UNDERLAGG-6",
              options: {
                Variant: "6-pack",
              },
              prices: [
                {
                  amount: 159,
                  currency_code: "sek",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
