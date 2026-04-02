/**
 * Push custom events to the GTM dataLayer.
 * Works regardless of consent state — GTM respects Consent Mode v2 automatically.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

function push(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
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
