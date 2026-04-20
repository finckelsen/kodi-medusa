import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

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
  modules: [
    {
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
    },
    {
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
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
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
          },
          {
            resolve: "./src/modules/dhl",
            id: "dhl",
            options: {
              api_key: process.env.DHL_API_KEY,
              api_base_url:
                process.env.DHL_API_BASE_URL ||
                "https://test-api.freight-logistics.dhl.com",
              servicepoint_endpoint:
                process.env.DHL_SERVICEPOINT_ENDPOINT ||
                "/servicepointlocatorapi/servicepoint/findnearestservicepoints",
              transport_instruction_endpoint:
                process.env.DHL_TRANSPORT_INSTRUCTION_ENDPOINT ||
                "/transportinstructionapi/v1/transportinstruction/sendtransportinstruction",
              home_delivery_endpoint:
                process.env.DHL_HOME_DELIVERY_ENDPOINT ||
                "/homedeliverylocatorapi/v1/homedeliverylocator/validateadditionalservices",
              customer_number: process.env.DHL_CUSTOMER_NUMBER,
              sender_id: process.env.DHL_SENDER_ID,
              sender_name: process.env.DHL_SENDER_NAME || "Kodiprint",
              sender_address: process.env.DHL_SENDER_ADDRESS || "",
              sender_postal_code: process.env.DHL_SENDER_POSTAL_CODE || "96132",
              sender_city: process.env.DHL_SENDER_CITY || "Boden",
              sender_country: process.env.DHL_SENDER_COUNTRY || "SE",
              payer_code: process.env.DHL_PAYER_CODE || "1",
              service_point_product_code:
                process.env.DHL_SERVICE_POINT_PRODUCT_CODE || "103",
              home_delivery_product_code:
                process.env.DHL_HOME_DELIVERY_PRODUCT_CODE || "401",
              business_product_code: process.env.DHL_BUSINESS_PRODUCT_CODE,
            },
          },
        ],
      },
    },
  ],
})
