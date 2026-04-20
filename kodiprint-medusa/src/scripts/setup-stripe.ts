import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

export default async function setupStripePayment({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionService = container.resolve(Modules.REGION)
  const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL

  logger.info("Setting up Stripe payment provider...")

  if (!process.env.STRIPE_API_KEY) {
    logger.error("Missing STRIPE_API_KEY. Add it before enabling Stripe in the region.")
    return
  }

  // Find the Sverige region
  const regions = await regionService.listRegions({
    name: "Sverige",
  })

  if (regions.length === 0) {
    logger.error("No 'Sverige' region found. Run seed script first.")
    return
  }

  const region = regions[0]
  logger.info(`Found region: ${region.name} (${region.id})`)

  // Update region to include Stripe alongside existing payment providers
  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: ["pp_system_default", "pp_stripe_stripe"],
      },
    },
  })

  logger.info("Stripe payment provider linked to Sverige region!")
  logger.info("Payment providers: pp_system_default, pp_stripe_stripe")
  if (backendUrl) {
    logger.info(`Stripe webhook URL: ${backendUrl.replace(/\/$/, "")}/hooks/payment/stripe_stripe`)
  } else {
    logger.info("Stripe webhook URL: <your-medusa-backend-url>/hooks/payment/stripe_stripe")
  }
  logger.info(
    "Required Stripe webhook events: payment_intent.amount_capturable_updated, payment_intent.succeeded, payment_intent.payment_failed, payment_intent.partially_funded"
  )
  logger.info("Stripe setup complete!")
}
