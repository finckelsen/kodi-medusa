import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import * as fs from "fs"

interface CSVOrder {
  orderNumber: string
  email: string
  financialStatus: string
  subtotal: number
  shipping: number
  total: number
  klubb: string
  createdAt: string
  shippingMethod: string
  lineItems: LineItem[]
  billingAddress: AddressData
  shippingAddress: AddressData
}

interface LineItem {
  quantity: number
  name: string
  price: number
}

interface AddressData {
  name: string
  address1: string
  address2: string
  company: string
  city: string
  zip: string
  province: string
  country: string
  phone: string
}

// Fuzzy match klubb namn
function normalizeKlubbName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

function matchKlubb(csvKlubb: string, foreningar: any[]): any | null {
  const normalized = normalizeKlubbName(csvKlubb)

  for (const forening of foreningar) {
    const foreningName = normalizeKlubbName(forening.metadata?.foreningsnamn || "")

    // Exakt match
    if (normalized === foreningName) {
      return forening
    }

    // Delvis match (ena innehåller den andra)
    if (normalized.includes(foreningName) || foreningName.includes(normalized)) {
      return forening
    }
  }

  return null
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { first_name: "", last_name: "" }
  if (parts.length === 1) return { first_name: parts[0], last_name: "" }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

function parseCSV(csvContent: string): Map<string, CSVOrder> {
  const lines = csvContent.split("\n")
  const headers = lines[0].split(";")

  // Hitta kolumnindex
  const getIndex = (name: string) => headers.findIndex(h => h.trim() === name)

  const nameIdx = getIndex("Name")
  const emailIdx = getIndex("Email")
  const financialStatusIdx = getIndex("Financial Status")
  const subtotalIdx = getIndex("Subtotal")
  const shippingIdx = getIndex("Shipping")
  const totalIdx = getIndex("Total")
  const klubbIdx = getIndex("Klubb")
  const createdAtIdx = getIndex("Created at")
  const shippingMethodIdx = getIndex("Shipping Method")
  const lineitemQtyIdx = getIndex("Lineitem quantity")
  const lineitemNameIdx = getIndex("Lineitem name")
  const lineitemPriceIdx = getIndex("Lineitem price")

  // Adress-kolumner
  const billingNameIdx = getIndex("Billing Name")
  const billingAddress1Idx = getIndex("Billing Address1")
  const billingAddress2Idx = getIndex("Billing Address2")
  const billingCompanyIdx = getIndex("Billing Company")
  const billingCityIdx = getIndex("Billing City")
  const billingZipIdx = getIndex("Billing Zip")
  const billingProvinceIdx = getIndex("Billing Province")
  const billingCountryIdx = getIndex("Billing Country")
  const billingPhoneIdx = getIndex("Billing Phone")

  const shippingNameIdx = getIndex("Shipping Name")
  const shippingAddress1Idx = getIndex("Shipping Address1")
  const shippingAddress2Idx = getIndex("Shipping Address2")
  const shippingCompanyIdx = getIndex("Shipping Company")
  const shippingCityIdx = getIndex("Shipping City")
  const shippingZipIdx = getIndex("Shipping Zip")
  const shippingProvinceIdx = getIndex("Shipping Province")
  const shippingCountryIdx = getIndex("Shipping Country")
  const shippingPhoneIdx = getIndex("Shipping Phone")

  const orders = new Map<string, CSVOrder>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(";")
    const orderNumber = cols[nameIdx]?.trim()

    if (!orderNumber) continue

    // Om ordern inte finns, skapa den
    if (!orders.has(orderNumber)) {
      const subtotal = parseFloat(cols[subtotalIdx]?.replace(",", ".") || "0")
      const shipping = parseFloat(cols[shippingIdx]?.replace(",", ".") || "0")
      const total = parseFloat(cols[totalIdx]?.replace(",", ".") || "0")

      orders.set(orderNumber, {
        orderNumber,
        email: cols[emailIdx]?.trim() || "",
        financialStatus: cols[financialStatusIdx]?.trim() || "",
        subtotal,
        shipping,
        total,
        klubb: cols[klubbIdx]?.trim() || "",
        createdAt: cols[createdAtIdx]?.trim() || "",
        shippingMethod: cols[shippingMethodIdx]?.trim() || "",
        lineItems: [],
        billingAddress: {
          name: cols[billingNameIdx]?.trim() || "",
          address1: cols[billingAddress1Idx]?.trim() || "",
          address2: cols[billingAddress2Idx]?.trim() || "",
          company: cols[billingCompanyIdx]?.trim() || "",
          city: cols[billingCityIdx]?.trim() || "",
          zip: cols[billingZipIdx]?.trim() || "",
          province: cols[billingProvinceIdx]?.trim() || "",
          country: cols[billingCountryIdx]?.trim() || "",
          phone: cols[billingPhoneIdx]?.trim() || "",
        },
        shippingAddress: {
          name: cols[shippingNameIdx]?.trim() || "",
          address1: cols[shippingAddress1Idx]?.trim() || "",
          address2: cols[shippingAddress2Idx]?.trim() || "",
          company: cols[shippingCompanyIdx]?.trim() || "",
          city: cols[shippingCityIdx]?.trim() || "",
          zip: cols[shippingZipIdx]?.trim() || "",
          province: cols[shippingProvinceIdx]?.trim() || "",
          country: cols[shippingCountryIdx]?.trim() || "",
          phone: cols[shippingPhoneIdx]?.trim() || "",
        },
      })
    }

    // Lägg till line item
    const order = orders.get(orderNumber)!
    const qty = parseInt(cols[lineitemQtyIdx] || "0", 10)
    const itemName = cols[lineitemNameIdx]?.trim() || ""
    const itemPrice = parseFloat(cols[lineitemPriceIdx]?.replace(",", ".") || "0")

    if (qty > 0 && itemName) {
      order.lineItems.push({
        quantity: qty,
        name: itemName,
        price: itemPrice,
      })
    }
  }

  return orders
}

function mapFinancialStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
      return "completed"
    case "partially_refunded":
      return "completed"
    case "refunded":
      return "canceled"
    default:
      return "pending"
  }
}

function parseDate(dateStr: string): string {
  // Format: "2025-05-23 08:11:47 -0400"
  try {
    const date = new Date(dateStr)
    return date.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function buildMedusaAddress(addr: AddressData) {
  const { first_name, last_name } = splitName(addr.name)
  return {
    first_name,
    last_name,
    address_1: addr.address1 || null,
    address_2: addr.address2 || null,
    company: addr.company || null,
    city: addr.city || null,
    postal_code: addr.zip || null,
    province: addr.province ? addr.province.toLowerCase() : null,
    country_code: addr.country ? addr.country.toLowerCase() : "se",
    phone: addr.phone || null,
  }
}

export default async function importOrders({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderService = container.resolve(Modules.ORDER)

  logger.info("Starting order import from CSV...")

  // Läs CSV-filen
  const csvPath = "/Users/casperfinckelsen/Desktop/kodiprint/orders.csv"

  if (!fs.existsSync(csvPath)) {
    logger.error(`CSV file not found at: ${csvPath}`)
    return
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8")
  const orders = parseCSV(csvContent)

  logger.info(`Parsed ${orders.size} unique orders from CSV`)

  // Hämta region och sales channel
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: "sek" },
  })

  if (!regions.length) {
    logger.error("No region with currency_code 'sek' found. Run seed first.")
    return
  }
  const regionId = regions[0].id
  logger.info(`Using region: ${regionId}`)

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })

  if (!salesChannels.length) {
    logger.error("No sales channel found. Run seed first.")
    return
  }
  const salesChannelId = salesChannels[0].id
  logger.info(`Using sales channel: ${salesChannels[0].name} (${salesChannelId})`)

  // Hämta alla föreningar (kunder)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "metadata"],
  })

  const foreningar = (customers || []).filter(
    (c: any) => c.metadata?.is_forening === true
  )

  logger.info(`Found ${foreningar.length} föreningar in database`)

  // Hämta befintliga ordrar för dubblettdetektering
  const { data: existingOrders } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
  })

  const existingShopifyNumbers = new Set<string>()
  for (const o of existingOrders || []) {
    const meta = o.metadata as Record<string, unknown> | null
    if (meta?.shopify_order_number) {
      existingShopifyNumbers.add(meta.shopify_order_number as string)
    }
  }

  logger.info(`Found ${existingShopifyNumbers.size} already imported Shopify orders`)

  let createdCount = 0
  let skippedCount = 0
  let unmatchedCount = 0
  let errorCount = 0

  for (const [orderNumber, order] of orders) {
    // Dubblettdetektering
    if (existingShopifyNumbers.has(orderNumber)) {
      logger.info(`Skipping ${orderNumber} - already imported`)
      skippedCount++
      continue
    }

    // Matcha förening till kund
    const forening = matchKlubb(order.klubb, foreningar)

    if (!forening) {
      logger.warn(`Could not match klubb "${order.klubb}" for order ${orderNumber}`)
      unmatchedCount++
      continue
    }

    try {
      const medusaOrder = await orderService.createOrders({
        currency_code: "sek",
        region_id: regionId,
        sales_channel_id: salesChannelId,
        customer_id: forening.id,
        email: order.email,
        status: mapFinancialStatus(order.financialStatus),
        shipping_address: buildMedusaAddress(order.shippingAddress.name ? order.shippingAddress : order.billingAddress),
        billing_address: buildMedusaAddress(order.billingAddress),
        items: order.lineItems.map(item => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: Math.round(item.price),
        })),
        shipping_methods: [],
        metadata: {
          shopify_order_number: orderNumber,
          source: "shopify_import",
          shopify_created_at: parseDate(order.createdAt),
          shopify_financial_status: order.financialStatus,
          klubb: order.klubb,
        },
      })

      createdCount++
      logger.info(
        `Created order ${orderNumber} -> ${medusaOrder.id} (customer: ${forening.metadata?.foreningsnamn || forening.id})`
      )
    } catch (error: any) {
      errorCount++
      logger.error(`Failed to create order ${orderNumber}: ${error.message || error}`)
    }
  }

  // Sammanfattning
  logger.info("\n=== Import Summary ===")
  logger.info(`Created: ${createdCount}`)
  logger.info(`Skipped (duplicates): ${skippedCount}`)
  logger.info(`Unmatched klubb: ${unmatchedCount}`)
  logger.info(`Errors: ${errorCount}`)
  logger.info(`Total in CSV: ${orders.size}`)
  logger.info("\nOrder import completed!")
}
