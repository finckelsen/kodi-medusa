import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PostNordFulfillmentService from "./service"

const services = [PostNordFulfillmentService]

export default ModuleProvider(Modules.FULFILLMENT, {
  services,
})
