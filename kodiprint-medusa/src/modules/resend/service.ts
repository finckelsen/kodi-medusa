import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { Resend, CreateEmailOptions } from "resend"
import { readFile } from "fs/promises"
import path from "path"
import { orderPlacedEmail } from "./emails/order-placed"
import { internalOrderEmail } from "./emails/internal-order"

type ResendOptions = {
  api_key: string
  from: string
  internal_to?: string
  storefront_url?: string
  storefront_public_path?: string
  html_templates?: Record<string, {
    subject?: string
    content: string
  }>
}

type InjectedDependencies = {
  logger: Logger
}

type Attachment = {
  filename: string
  content?: Buffer
  path?: string
  contentType?: string
  contentId?: string
}

type InlineImageMap = Record<
  string,
  {
    product_thumbnail_cid?: string
    logo_preview_cid?: string
  }
>

enum Templates {
  ORDER_PLACED = "order-placed",
  INTERNAL_ORDER = "internal-order",
}

const templates: { [key in Templates]?: (props: unknown) => React.ReactNode } = {
  [Templates.ORDER_PLACED]: orderPlacedEmail,
  [Templates.INTERNAL_ORDER]: internalOrderEmail,
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  private resendClient: Resend
  private options: ResendOptions
  private logger: Logger

  constructor(
    { logger }: InjectedDependencies,
    options: ResendOptions
  ) {
    super()
    this.resendClient = new Resend(options.api_key)
    this.options = options
    this.logger = logger
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      )
    }
  }

  getTemplate(template: Templates) {
    if (this.options.html_templates?.[template]) {
      return this.options.html_templates[template].content
    }
    const allowedTemplates = Object.keys(templates)

    if (!allowedTemplates.includes(template)) {
      return null
    }

    return templates[template]
  }

  getTemplateSubject(template: Templates, data?: Record<string, unknown>) {
    if (this.options.html_templates?.[template]?.subject) {
      return this.options.html_templates[template].subject
    }
    switch (template) {
      case Templates.ORDER_PLACED:
        return "Orderbekräftelse"
      case Templates.INTERNAL_ORDER: {
        const order = data?.order as Record<string, unknown> | undefined
        const displayId = order?.display_id ?? ""
        return `Ny order #${displayId} - tryckunderlag`
      }
      default:
        return "Nytt mejl"
    }
  }

  /**
   * Build attachments from order item metadata for the internal email.
   * Downloads files from URLs and attaches them as Buffers.
   */
  private async buildAttachments(data: Record<string, unknown>): Promise<Attachment[]> {
    const attachments: Attachment[] = []
    const order = data?.order as Record<string, unknown> | undefined
    if (!order) return attachments

    const items = order.items as Array<Record<string, unknown>> | undefined
    if (!items) return attachments

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const meta = (item.metadata || {}) as Record<string, unknown>
      const itemLabel = `artikel${index + 1}`

      // Download and attach logo file
      if (meta.logo_url && typeof meta.logo_url === "string") {
        const originalName = (meta.logo_original_name as string) || "logo"
        const extension = originalName.includes(".") ? "" : this.guessExtension(meta.logo_mime_type as string)
        const fileBuffer = await this.downloadFile(meta.logo_url)
        if (fileBuffer) {
          attachments.push({
            filename: `${itemLabel}_${originalName}${extension}`,
            content: fileBuffer,
          })
        }
      }

      // Download and attach 3D preview
      if (meta.variant_thumbnail && typeof meta.variant_thumbnail === "string") {
        const fileBuffer = await this.downloadFile(meta.variant_thumbnail)
        if (fileBuffer) {
          attachments.push({
            filename: `${itemLabel}_forhandsvisning.png`,
            content: fileBuffer,
          })
        }
      }

      // Attach names list as CSV
      const namesList = meta.names_list as string[] | undefined
      if (namesList && Array.isArray(namesList) && namesList.length > 0) {
        const csvHeader = "Nr,Namn"
        const csvRows = namesList.map((name, i) => `${i + 1},${name}`)
        const csvContent = [csvHeader, ...csvRows].join("\n")
        attachments.push({
          filename: `${itemLabel}_namnlista_${namesList.length}st.csv`,
          content: Buffer.from(csvContent, "utf-8"),
        })
      }

      // Attach print settings as JSON
      if (meta.print_settings || meta.print_mode) {
        const printInfo = {
          produkt: item.product_title,
          variant: item.variant_title,
          antal: item.quantity,
          tryckmetod: meta.print_mode,
          inställningar: meta.print_settings,
          personalisering_namn: meta.personalization_name || null,
          personalisering_gravyr: meta.personalization_engraving || null,
          förening: meta.forening_name || null,
          logo_är_vektor: meta.logo_is_vector || false,
        }
        attachments.push({
          filename: `${itemLabel}_tryckinställningar.json`,
          content: Buffer.from(JSON.stringify(printInfo, null, 2), "utf-8"),
        })
      }
    }

    return attachments
  }

  /**
   * Build inline images for the customer confirmation email so the snapshot
   * and print preview render in the email body without depending on public URLs.
   */
  private async buildCustomerInlineImages(
    data: Record<string, unknown>
  ): Promise<{ attachments: Attachment[]; inlineImages: InlineImageMap }> {
    const attachments: Attachment[] = []
    const inlineImages: InlineImageMap = {}
    const order = data?.order as Record<string, unknown> | undefined
    if (!order) return { attachments, inlineImages }

    const items = order.items as Array<Record<string, unknown>> | undefined
    if (!items) return { attachments, inlineImages }

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const meta = (item.metadata || {}) as Record<string, unknown>
      const itemId = String(item.id || `item_${index + 1}`)
      inlineImages[itemId] = {}

      const snapshotUrl =
        (typeof meta.variant_thumbnail === "string" && meta.variant_thumbnail) ||
        (typeof item.thumbnail === "string" && item.thumbnail) ||
        null

      if (snapshotUrl) {
        const fileBuffer = await this.downloadFile(snapshotUrl)
        if (fileBuffer) {
          const contentId = `product_snapshot_${index + 1}`
          attachments.push({
            filename: `produkt-${index + 1}.png`,
            content: fileBuffer,
            contentType: this.inferContentType(snapshotUrl) || "image/png",
            contentId,
          })
          inlineImages[itemId].product_thumbnail_cid = contentId
        }
      }

      const logoPreviewUrl =
        (typeof meta.logo_preview_url === "string" && meta.logo_preview_url) ||
        (typeof meta.logo_url === "string" && meta.logo_url) ||
        null

      if (logoPreviewUrl) {
        const fileBuffer = await this.downloadFile(logoPreviewUrl)
        if (fileBuffer) {
          const contentId = `print_preview_${index + 1}`
          attachments.push({
            filename: `tryckbild-${index + 1}.png`,
            content: fileBuffer,
            contentType: this.inferContentType(logoPreviewUrl) || "image/png",
            contentId,
          })
          inlineImages[itemId].logo_preview_cid = contentId
        }
      }
    }

    return { attachments, inlineImages }
  }

  /**
   * Download a file from a URL and return it as a Buffer.
   * For /uploads/ paths: tries reading from the storefront's public directory first,
   * then falls back to HTTP download via the storefront URL.
   */
  private async downloadFile(url: string): Promise<Buffer | null> {
    // For /uploads/ paths, try reading directly from the storefront filesystem first
    if (url.startsWith("/uploads/")) {
      const publicPath = this.options.storefront_public_path
      if (publicPath) {
        try {
          const resolved = path.isAbsolute(publicPath)
            ? path.join(publicPath, url)
            : path.resolve(process.cwd(), publicPath, `.${url}`)
          const buffer = await readFile(resolved)
          this.logger.info(`[attachments] Read from filesystem: ${resolved}`)
          return buffer
        } catch {
          this.logger.warn(`[attachments] File not found on disk: ${url}, trying HTTP...`)
        }
      }
    }

    try {
      let fullUrl = url
      if (url.startsWith("/")) {
        if (url.startsWith("/static/")) {
          fullUrl = `http://localhost:9000${url}`
        } else {
          const storefrontBase = this.options.storefront_url || "http://localhost:8000"
          fullUrl = `${storefrontBase}${url}`
        }
      }

      const response = await fetch(fullUrl)
      if (!response.ok) {
        this.logger.warn(`[attachments] Failed to download ${fullUrl}: ${response.status}`)
        return null
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (err) {
      this.logger.warn(`[attachments] Error downloading ${url}: ${(err as Error).message}`)
      return null
    }
  }

  private guessExtension(mimeType?: string): string {
    if (!mimeType) return ""
    const map: Record<string, string> = {
      "image/svg+xml": ".svg",
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
      "image/gif": ".gif",
    }
    return map[mimeType] || ""
  }

  private inferContentType(url: string): string | undefined {
    const normalized = url.toLowerCase().split("?")[0]
    if (normalized.endsWith(".png")) return "image/png"
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg"
    if (normalized.endsWith(".webp")) return "image/webp"
    if (normalized.endsWith(".gif")) return "image/gif"
    if (normalized.endsWith(".svg")) return "image/svg+xml"
    return undefined
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const templateKey = notification.template as Templates

    // For internal-order, also handle the case where the template
    // is triggered but no internal_to address is configured
    if (templateKey === Templates.INTERNAL_ORDER && !this.options.internal_to) {
      this.logger.warn(
        "Internal order email template triggered but no `internal_to` address configured. Skipping."
      )
      return {}
    }

    const template = this.getTemplate(templateKey)

    if (!template) {
      this.logger.error(
        `Couldn't find an email template for ${notification.template}. The valid options are ${Object.values(Templates)}`
      )
      return {}
    }

    const isInternal = templateKey === Templates.INTERNAL_ORDER
    const recipient = isInternal ? this.options.internal_to! : notification.to

    const commonOptions = {
      from: this.options.from,
      to: [recipient],
      subject: this.getTemplateSubject(
        templateKey,
        notification.data as Record<string, unknown>
      ),
    }

    let emailOptions: CreateEmailOptions | null = null
    let templateData = notification.data

    if (templateKey === Templates.ORDER_PLACED) {
      try {
        const { attachments, inlineImages } = await this.buildCustomerInlineImages(
          notification.data as Record<string, unknown>
        )

        templateData = {
          ...(notification.data as Record<string, unknown>),
          inline_images: inlineImages,
        }

        if (attachments.length > 0) {
          this.logger.info(
            `Attaching ${attachments.length} inline image(s) to customer confirmation email`
          )
        }

        if (typeof template === "string") {
          emailOptions = {
            ...commonOptions,
            html: template,
            attachments,
          }
        } else {
          emailOptions = {
            ...commonOptions,
            react: template(templateData),
            attachments,
          }
        }
      } catch (err) {
        this.logger.error(
          "Failed to build inline images for customer email",
          err as Error
        )
      }
    }

    if (!emailOptions) {
      if (typeof template === "string") {
        emailOptions = {
          ...commonOptions,
          html: template,
        }
      } else {
        emailOptions = {
          ...commonOptions,
          react: template(templateData),
        }
      }
    }

    // Add attachments for internal order emails
    if (isInternal) {
      try {
        const attachments = await this.buildAttachments(
          notification.data as Record<string, unknown>
        )
        if (attachments.length > 0) {
          emailOptions.attachments = attachments
          this.logger.info(
            `Attaching ${attachments.length} file(s) to internal order email`
          )
        }
      } catch (err) {
        this.logger.error(
          "Failed to build attachments for internal email",
          err as Error
        )
        // Continue sending without attachments rather than failing entirely
      }
    }

    const { data, error } = await this.resendClient.emails.send(emailOptions)

    if (error || !data) {
      if (error) {
        this.logger.error("Failed to send email", error as unknown as Error)
      } else {
        this.logger.error("Failed to send email: unknown error")
      }
      return {}
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
