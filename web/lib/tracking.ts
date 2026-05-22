/**
 * Push custom events to the GTM dataLayer.
 * Works regardless of consent state — GTM respects Consent Mode v2 automatically.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

function sendServerEvent(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    event,
    params,
    path: `${window.location.pathname}${window.location.search}` || "/",
    title: document.title || undefined,
    referrer: document.referrer || "",
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
      return;
    }
  } catch {
    // Fall back to fetch below.
  }

  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function push(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
  sendServerEvent(event, params);
}

export function trackSearch(query: string, region?: string, filterCount?: number) {
  push("search_performed", {
    search_term: query,
    search_region: region || "alle",
    filter_count: filterCount ?? 0,
  });
}

export function trackFilter(filterName: string, active: boolean) {
  push("filter_applied", {
    filter_name: filterName,
    filter_state: active ? "on" : "off",
  });
}

export function trackShelterView(shelterName: string, shelterId: string) {
  push("shelter_viewed", {
    shelter_name: shelterName,
    shelter_id: shelterId,
  });
}

export function trackNewsletterSignup(source: string) {
  push("newsletter_signup", { signup_source: source });
}

export function trackShare(method: string, contentType: string) {
  push("share_click", { share_method: method, content_type: contentType });
}

export function trackOutboundClick(url: string, label?: string) {
  push("outbound_click", { outbound_url: url, link_label: label });
}

export function trackCommunitySubmit(type: "comment" | "photo" | "facilities") {
  push("community_submit", { submission_type: type });
}

/**
 * Fired when a user clicks the Book CTA on a shelter detail page.
 * Key funnel metric — measures view → click conversion.
 */
export function trackBookButtonClick(args: {
  shelterId: string;
  shelterSlug: string;
  bookingType: "shelterdk" | "external" | "multi_unit" | "naturstyrelsen_fallback";
  position: "main_card" | "sticky_mobile";
}) {
  push("book_button_clicked", {
    shelter_id: args.shelterId,
    shelter_slug: args.shelterSlug,
    booking_type: args.bookingType,
    cta_position: args.position,
  });
}

/** Fired when a user adds or removes a shelter from their wishlist. */
export function trackWishlist(action: "add" | "remove", shelterId: string) {
  push("wishlist_changed", { wishlist_action: action, shelter_id: shelterId });
}

/** Fired when a Stripe checkout is cancelled (user returns via cancel_url). */
export function trackPaymentCancelled(bookingId: string) {
  push("payment_cancelled", { booking_id: bookingId });
}
