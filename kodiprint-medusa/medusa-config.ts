import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Build modules list conditionally based on available env vars
const modules: any[] = []

// Only load Resend if API key is provided
if (process.env.RESEND_API_KEY) {
  modules.push({
    resolve: "@medusajs/medusa/notification",
    options: {
      providers: [
        {
          resolve: "./src/modules/resend",
          id: "resend",
          options: {
            channels: ["email"],
            api_key: process.env.RESEND_API_KEY,
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            internal_to: process.env.RESEND_INTERNAL_TO,
            storefront_url: process.env.STOREFRONT_URL || "http://localhost:8000",
            storefront_public_path: process.env.STOREFRONT_PUBLIC_PATH,
          },
        },
      ],
    },
  })
}

// Only load Stripe if API key is provided
if (process.env.STRIPE_API_KEY) {
  modules.push({
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "./src/modules/stripe",
          id: "stripe",
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
          },
        },
      ],
    },
  })
}

// Fulfillment providers
const fulfillmentProviders: any[] = [
  {
    resolve: "@medusajs/medusa/fulfillment-manual",
    id: "manual",
  },
]

if (process.env.POSTNORD_API_KEY) {
  fulfillmentProviders.push({
    resolve: "./src/modules/postnord",
    id: "postnord",
    options: {
      api_key: process.env.POSTNORD_API_KEY,
      customer_number: process.env.POSTNORD_CUSTOMER_NUMBER,
      issuer_code: process.env.POSTNORD_ISSUER_CODE || "SE",
      api_base_url: process.env.POSTNORD_API_BASE_URL || "https://atapi2.postnord.com",
      sender_postal_code: process.env.POSTNORD_SENDER_POSTAL_CODE || "96132",
      sender_city: process.env.POSTNORD_SENDER_CITY || "Boden",
      sender_country: process.env.POSTNORD_SENDER_COUNTRY || "SE",
      sender_name: process.env.POSTNORD_SENDER_NAME || "Kodiprint",
      sender_address: process.env.POSTNORD_SENDER_ADDRESS || "",
    },
  })
}

if (process.env.DHL_API_KEY) {
  fulfillmentProviders.push({
    resolve: "./src/modules/dhl",
    id: "dhl",
    options: {
      api_key: process.env.DHL_API_KEY,
      api_base_url: process.env.DHL_API_BASE_URL || "https://test-api.freight-logistics.dhl.com",
      servicepoint_endpoint: process.env.DHL_SERVICEPOINT_ENDPOINT || "/servicepointlocatorapi/servicepoint/findnearestservicepoints",
      transport_instruction_endpoint: process.env.DHL_TRANSPORT_INSTRUCTION_ENDPOINT || "/transportinstructionapi/v1/transportinstruction/sendtransportinstruction",
      home_delivery_endpoint: process.env.DHL_HOME_DELIVERY_ENDPOINT || "/homedeliverylocatorapi/v1/homedeliverylocator/validateadditionalservices",
      customer_number: process.env.DHL_CUSTOMER_NUMBER,
      sender_id: process.env.DHL_SENDER_ID,
      sender_name: process.env.DHL_SENDER_NAME || "Kodiprint",
      sender_address: process.env.DHL_SENDER_ADDRESS || "",
      sender_postal_code: process.env.DHL_SENDER_POSTAL_CODE || "96132",
      sender_city: process.env.DHL_SENDER_CITY || "Boden",
      sender_country: process.env.DHL_SENDER_COUNTRY || "SE",
      payer_code: process.env.DHL_PAYER_CODE || "1",
      service_point_product_code: process.env.DHL_SERVICE_POINT_PRODUCT_CODE || "103",
      home_delivery_product_code: process.env.DHL_HOME_DELIVERY_PRODUCT_CODE || "401",
      business_product_code: process.env.DHL_BUSINESS_PRODUCT_CODE,
    },
  })
}

// File storage: use S3/R2 if credentials provided, otherwise local
if (process.env.R2_ACCESS_KEY_ID) {
  modules.push({
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/file-s3",
          id: "s3",
          options: {
            file_url: process.env.R2_PUBLIC_BASE_URL,
            access_key_id: process.env.R2_ACCESS_KEY_ID,
            secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
            region: process.env.R2_REGION || "auto",
            bucket: process.env.R2_BUCKET,
            endpoint: process.env.R2_ENDPOINT,
            additional_client_config: {
              forcePathStyle: true,
            },
          },
        },
      ],
    },
  })
}

modules.push({
  resolve: "@medusajs/medusa/fulfillment",
  options: {
    providers: fulfillmentProviders,
  },
})

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    }
  },
  modules,
})
