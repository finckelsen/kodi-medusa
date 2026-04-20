import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import KodiStripeProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [KodiStripeProviderService],
})
