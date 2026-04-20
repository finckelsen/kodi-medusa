import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

const DEFAULT_PASSWORD = "Test12345"
const MEDUSA_URL = "http://localhost:9000"

export default async function setForeningPasswords({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const authModuleService = container.resolve(Modules.AUTH)

  logger.info("Setting passwords for föreningar...")

  // Get all customers with is_forening metadata
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "metadata"],
  })

  const foreningar = (customers || []).filter(
    (c: any) => c.metadata?.is_forening === true
  )

  logger.info(`Found ${foreningar.length} föreningar`)

  for (const forening of foreningar) {
    try {
      // First, delete any existing auth identities for this email
      const existingIdentities = await authModuleService.listAuthIdentities({
        provider_identities: {
          entity_id: forening.email,
        },
      })

      if (existingIdentities.length > 0) {
        for (const identity of existingIdentities) {
          await authModuleService.deleteAuthIdentities([identity.id])
          logger.info(`Deleted existing auth identity for: ${forening.email}`)
        }
      }

      // Now register via HTTP API (this handles password hashing correctly)
      const registerResponse = await fetch(`${MEDUSA_URL}/auth/customer/emailpass/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forening.email,
          password: DEFAULT_PASSWORD,
        }),
      })

      if (!registerResponse.ok) {
        const error = await registerResponse.json()
        throw new Error(error.message || "Registration failed")
      }

      const authData = await registerResponse.json()

      // Link the auth identity to the existing customer
      // The token contains the auth_identity_id, we need to update app_metadata
      const newIdentities = await authModuleService.listAuthIdentities({
        provider_identities: {
          entity_id: forening.email,
        },
      })

      if (newIdentities.length > 0) {
        await authModuleService.updateAuthIdentities([
          {
            id: newIdentities[0].id,
            app_metadata: {
              customer_id: forening.id,
            },
          },
        ])
      }

      logger.info(`Registered and linked: ${forening.email}`)
    } catch (error: any) {
      logger.error(`Failed for ${forening.email}: ${error.message}`)
    }
  }

  logger.info(`Done! Password for all föreningar: ${DEFAULT_PASSWORD}`)
}
