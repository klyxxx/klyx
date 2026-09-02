type KlyxMarketOfferAction = "accept" | "reject";

function authenticatedJsonHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function cancelKlyxMarketRequest(
  accessToken: string,
  requestId: string
) {
  const response = await fetch("/api/market/requests", {
    method: "PATCH",
    headers: authenticatedJsonHeaders(accessToken),
    body: JSON.stringify({
      requestId,
      action: "cancel",
    }),
  });

  if (!response.ok) {
    throw new Error("MARKET_REQUEST_ACTION_FAILED");
  }
}

export async function updateKlyxMarketOffer(
  accessToken: string,
  requestId: string,
  offerId: string,
  action: KlyxMarketOfferAction
) {
  const response = await fetch(`/api/market/requests/${requestId}/offers`, {
    method: "PATCH",
    headers: authenticatedJsonHeaders(accessToken),
    body: JSON.stringify({ offerId, action }),
  });

  if (!response.ok) {
    throw new Error("MARKET_OFFER_ACTION_FAILED");
  }
}
