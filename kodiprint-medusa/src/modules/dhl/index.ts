import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import DhlFulfillmentService from "./service"

const services = [DhlFulfillmentService]

export default ModuleProvider(Modules.FULFILLMENT, {
  services,
})
