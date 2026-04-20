import StripeProviderService from "@medusajs/payment-stripe/dist/services/stripe-provider"
import type Stripe from "stripe"

class KodiStripeProviderService extends StripeProviderService {
  static identifier = "stripe"

  normalizePaymentIntentParameters(
    extra?: Record<string, unknown>
  ): Partial<Stripe.PaymentIntentCreateParams> {
    const params = super.normalizePaymentIntentParameters(extra)
    const amazonPayExclusion: Stripe.PaymentIntentCreateParams.ExcludedPaymentMethodType =
      "amazon_pay"
    const extraExcluded =
      (
        extra as
          | {
              excluded_payment_method_types?: Stripe.PaymentIntentCreateParams.ExcludedPaymentMethodType[]
            }
          | undefined
      )?.excluded_payment_method_types ?? []
    const currentExcluded =
      (params.excluded_payment_method_types ?? []) as Stripe.PaymentIntentCreateParams.ExcludedPaymentMethodType[]

    return {
      ...params,
      excluded_payment_method_types: Array.from(
        new Set([...currentExcluded, ...extraExcluded, amazonPayExclusion])
      ),
    }
  }
}

export default KodiStripeProviderService
