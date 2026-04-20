import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

interface ForeningData {
  name: string;
  slug: string;
  logoFile: string;
  city: string;
}

// Define the föreningar from the FÖRENINGAR folder
const foreningarData: ForeningData[] = [
  {
    name: "Boden City FC",
    slug: "boden-city-fc",
    logoFile: "logo.png",
    city: "Boden",
  },
  {
    name: "Bodens BK FF",
    slug: "bodens-bk-ff",
    logoFile: "logo.png",
    city: "Boden",
  },
  {
    name: "Hedens IF",
    slug: "hedens-if",
    logoFile: "logo.png",
    city: "Boden",
  },
  {
    name: "IBK Boden",
    slug: "ibk-boden",
    logoFile: "logo.png",
    city: "Boden",
  },
  {
    name: "Sävast AIF",
    slug: "savast-aif",
    logoFile: "logo.png",
    city: "Boden",
  },
  {
    name: "TIF Boden",
    slug: "tif-boden",
    logoFile: "logo.png",
    city: "Boden",
  },
];

export default async function seedForeningar({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const customerService = container.resolve(Modules.CUSTOMER);

  logger.info("Starting föreningar seeding...");

  // First, delete existing föreningar (customers with is_forening metadata)
  logger.info("Removing existing föreningar...");

  const { data: existingCustomers } = await query.graph({
    entity: "customer",
    fields: ["id", "metadata"],
  });

  const existingForeningar = (existingCustomers || []).filter(
    (c: any) => c.metadata?.is_forening === true
  );

  for (const forening of existingForeningar) {
    try {
      await customerService.deleteCustomers([forening.id]);
      logger.info(`Deleted förening: ${forening.id}`);
    } catch (error) {
      logger.warn(`Could not delete förening ${forening.id}: ${error}`);
    }
  }

  logger.info(`Removed ${existingForeningar.length} existing föreningar`);

  // Create new föreningar
  logger.info("Creating new föreningar...");

  for (const foreningData of foreningarData) {
    try {
      const email = `${foreningData.slug}@kodiprint.com`;

      // Check if customer with this email already exists
      const { data: existing } = await query.graph({
        entity: "customer",
        fields: ["id"],
        filters: { email },
      });

      if (existing && existing.length > 0) {
        logger.info(`Förening ${foreningData.name} already exists, skipping...`);
        continue;
      }

      const customer = await customerService.createCustomers({
        email,
        first_name: foreningData.name,
        last_name: "",
        metadata: {
          is_forening: true,
          foreningsnamn: foreningData.name,
          slug: foreningData.slug,
          ort: foreningData.city,
          logo_original: `/uploads/foreningar/${foreningData.slug}/${foreningData.logoFile}`,
          logo_preview: `/uploads/foreningar/${foreningData.slug}/${foreningData.logoFile}`,
          onboarding_completed: true,
          kickback_percentage: 25,
        },
      });

      logger.info(`Created förening: ${foreningData.name} (${customer.id})`);
    } catch (error) {
      logger.error(`Failed to create förening ${foreningData.name}: ${error}`);
    }
  }

  logger.info("Finished seeding föreningar!");
}
