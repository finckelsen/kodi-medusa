import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seedProfilering({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("Starting profilering product seeding...");

  // Get default sales channel
  const defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    logger.error("No default sales channel found. Run the main seed first.");
    return;
  }

  // Get shipping profile
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  const shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    logger.error("No shipping profile found. Run the main seed first.");
    return;
  }

  // Check if "Profilering" category exists, create if not
  logger.info("Checking Profilering category...");
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  });

  let categoryResult = existingCategories || [];
  const hasProfilering = categoryResult.find((c: any) => c.name === "Profilering");

  if (!hasProfilering) {
    logger.info("Creating Profilering category...");
    const { result: newCategories } = await createProductCategoriesWorkflow(
      container
    ).run({
      input: {
        product_categories: [
          {
            name: "Profilering",
            is_active: true,
          },
        ],
      },
    });
    categoryResult = [...categoryResult, ...newCategories];
  }

  const profileringCategory = categoryResult.find(
    (c: any) => c.name === "Profilering"
  );

  // Check if products already exist
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  });

  const productHandles = [
    "termosflaska-profilering",
    "sportflaska-profilering",
  ];

  const existingHandles = (existingProducts || []).map((p: any) => p.handle);
  const productsToCreate = productHandles.filter(
    (handle) => !existingHandles.includes(handle)
  );

  if (productsToCreate.length === 0) {
    logger.info("All profilering products already exist. Skipping creation.");
    return;
  }

  logger.info(`Creating ${productsToCreate.length} profilering products...`);

  const allProducts = [
    {
      title: "Termosflaska Profilering",
      category_ids: profileringCategory ? [profileringCategory.id] : [],
      description:
        "Dubbelväggig termosflaska i rostfritt stål med ert företags logotyp. Håller drycker kalla i 24h eller varma i 12h. Progressiv prissättning vid volymköp.",
      handle: "termosflaska-profilering",
      weight: 350,
      status: ProductStatus.PUBLISHED,
      metadata: {
        type: "profilering",
        model_url: "/models/termosflaska-profilering.glb",
        price_tiers: [
          { min_quantity: 1, price: 149 },
          { min_quantity: 50, price: 129 },
          { min_quantity: 100, price: 109 },
          { min_quantity: 250, price: 89 },
        ],
        print_prices: { wrap: 45, spot: 35, name: 25 },
      },
      shipping_profile_id: shippingProfile.id,
      options: [{ title: "Färg", values: ["Svart", "Vit", "Silver"] }],
      variants: [
        {
          title: "Svart",
          sku: "PROF-TERMOS-SVART",
          options: { Färg: "Svart" },
          prices: [{ amount: 149, currency_code: "sek" }],
        },
        {
          title: "Vit",
          sku: "PROF-TERMOS-VIT",
          options: { Färg: "Vit" },
          prices: [{ amount: 149, currency_code: "sek" }],
        },
        {
          title: "Silver",
          sku: "PROF-TERMOS-SILVER",
          options: { Färg: "Silver" },
          prices: [{ amount: 149, currency_code: "sek" }],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    },
    {
      title: "Sportflaska Profilering",
      category_ids: profileringCategory ? [profileringCategory.id] : [],
      description:
        "Lätt och smidig sportflaska med ert företags logotyp. 750ml kapacitet, BPA-fri. Progressiv prissättning vid volymköp.",
      handle: "sportflaska-profilering",
      weight: 120,
      status: ProductStatus.PUBLISHED,
      metadata: {
        type: "profilering",
        model_url: "/models/sportflaska-profilering.glb",
        price_tiers: [
          { min_quantity: 1, price: 119 },
          { min_quantity: 50, price: 99 },
          { min_quantity: 100, price: 85 },
          { min_quantity: 250, price: 69 },
        ],
        print_prices: { wrap: 45, spot: 35, name: 25 },
      },
      shipping_profile_id: shippingProfile.id,
      options: [{ title: "Färg", values: ["Svart", "Vit", "Röd"] }],
      variants: [
        {
          title: "Svart",
          sku: "PROF-SPORT-SVART",
          options: { Färg: "Svart" },
          prices: [{ amount: 119, currency_code: "sek" }],
        },
        {
          title: "Vit",
          sku: "PROF-SPORT-VIT",
          options: { Färg: "Vit" },
          prices: [{ amount: 119, currency_code: "sek" }],
        },
        {
          title: "Röd",
          sku: "PROF-SPORT-ROD",
          options: { Färg: "Röd" },
          prices: [{ amount: 119, currency_code: "sek" }],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    },
  ];

  // Filter to only create products that don't exist
  const productsToAdd = allProducts.filter((p) =>
    productsToCreate.includes(p.handle)
  );

  if (productsToAdd.length > 0) {
    await createProductsWorkflow(container).run({
      input: {
        products: productsToAdd,
      },
    });
    logger.info(`Created ${productsToAdd.length} profilering products successfully!`);
  }

  logger.info("Finished seeding profilering products!");
}
