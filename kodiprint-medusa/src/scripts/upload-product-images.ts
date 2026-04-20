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

export default async function uploadProductImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productService = container.resolve(Modules.PRODUCT);
  const fileService = container.resolve(Modules.FILE);

  logger.info("Starting product image upload...");
  logger.info(`Looking for images in: ${IMAGES_BASE}`);

  if (!fs.existsSync(IMAGES_BASE)) {
    logger.error(`Image directory not found: ${IMAGES_BASE}`);
    return;
  }

  // Get all förening products (those with forening_slug in metadata)
  const products = await productService.listProducts(
    {},
    { take: 500, select: ["id", "handle", "thumbnail", "metadata"] }
  );

  const foreningProducts = products.filter(
    (p: any) => p.metadata?.forening_slug
  );

  logger.info(`Found ${foreningProducts.length} förening products`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of foreningProducts) {
    const slug = (product as any).metadata.forening_slug as string;
    const baseProduct = (product as any).metadata.base_product as string;

    // Skip if product already has a thumbnail
    if ((product as any).thumbnail) {
      logger.info(`  ${product.handle}: already has thumbnail, skipping`);
      skipped++;
      continue;
    }

    // Find the image file
    const imageFilename = productImageFiles[baseProduct];
    if (!imageFilename) {
      logger.warn(`  ${product.handle}: no image mapping for base "${baseProduct}"`);
      skipped++;
      continue;
    }

    // Look for image in the products directory (case-insensitive, .jpg or .png)
    const altDir = path.join(IMAGES_BASE, slug, "products");
    let resolvedImagePath = "";

    if (fs.existsSync(altDir)) {
      const available = fs.readdirSync(altDir);
      const baseName = imageFilename.replace(/\.[^.]+$/, "").toLowerCase();
      const match = available.find((f) => {
        const fBase = f.replace(/\.[^.]+$/, "").toLowerCase();
        const fExt = f.split(".").pop()?.toLowerCase();
        return fBase === baseName && (fExt === "jpg" || fExt === "jpeg" || fExt === "png");
      });
      if (match) {
        resolvedImagePath = path.join(altDir, match);
      }
    }

    if (!resolvedImagePath) {
      // Try matching by base product name prefix
      if (fs.existsSync(altDir)) {
        const available = fs.readdirSync(altDir);
        const match = available.find((f) =>
          f.toLowerCase().startsWith(baseProduct.toLowerCase())
        );
        if (match) {
          resolvedImagePath = path.join(altDir, match);
        }
      }
    }

    if (!resolvedImagePath) {
      logger.warn(`  ${product.handle}: no matching image found in ${altDir}`);
      failed++;
      continue;
    }

    const imagePath = resolvedImagePath;

    try {
      await uploadAndSetThumbnail(
        imagePath,
        product,
        fileService,
        productService,
        logger
      );
      uploaded++;
    } catch (error: any) {
      logger.error(`  ${product.handle}: upload failed - ${error.message}`);
      failed++;
    }
  }

  logger.info(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

async function uploadAndSetThumbnail(
  imagePath: string,
  product: any,
  fileService: any,
  productService: any,
  logger: any
) {
  const filename = path.basename(imagePath);
  const fileContent = fs.readFileSync(imagePath);

  // Upload via Medusa's file service
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const files = await fileService.createFiles({
    filename,
    mimeType,
    content: fileContent,
    access: "public",
  });

  const uploadedFile = Array.isArray(files) ? files[0] : files;
  const url = uploadedFile.url;

  // Set as product thumbnail and add to images
  await productService.updateProducts(product.id, {
    thumbnail: url,
    images: [{ url }],
  });

  logger.info(`  ${product.handle}: uploaded ${filename} -> ${url}`);
}
