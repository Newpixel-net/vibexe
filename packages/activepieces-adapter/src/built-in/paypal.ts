/**
 * Built-in PayPal integration piece.
 *
 * Uses PayPal REST API v2 with OAuth2 Client Credentials auth.
 * Covers: Orders, Subscriptions, Invoicing, Payouts, Disputes, Products.
 */

// ─── Auth & Token Caching ───────────────────────────────

interface TokenEntry {
	token: string;
	expiresAt: number;
}

const tokenCache = new Map<string, TokenEntry>();

interface PayPalAuth {
	clientId?: string;
	clientSecret?: string;
	sandbox?: boolean | string;
}

function resolveAuth(
	properties: Record<string, unknown>,
	auth: unknown,
): { clientId: string; clientSecret: string; sandbox: boolean } {
	const a = (auth && typeof auth === "object" ? auth : {}) as PayPalAuth;
	const clientId =
		(properties.clientId as string) || a.clientId || "";
	const clientSecret =
		(properties.clientSecret as string) || a.clientSecret || "";
	const sandbox =
		properties.sandbox !== undefined
			? properties.sandbox === true || properties.sandbox === "true"
			: a.sandbox === true || a.sandbox === "true";

	if (!clientId || !clientSecret) {
		throw new Error(
			"Missing PayPal credentials. Provide clientId and clientSecret in the node configuration or credential store.",
		);
	}
	return { clientId, clientSecret, sandbox };
}

function baseUrl(sandbox: boolean): string {
	return sandbox
		? "https://api-m.sandbox.paypal.com"
		: "https://api-m.paypal.com";
}

async function getAccessToken(
	clientId: string,
	clientSecret: string,
	sandbox: boolean,
): Promise<string> {
	const cached = tokenCache.get(clientId);
	if (cached && cached.expiresAt > Date.now() + 60_000) {
		return cached.token;
	}

	const res = await fetch(`${baseUrl(sandbox)}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`PayPal auth failed (${res.status}): ${text}`);
	}

	const data = (await res.json()) as {
		access_token: string;
		expires_in: number;
	};
	tokenCache.set(clientId, {
		token: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	});
	return data.access_token;
}

async function paypalRequest(
	method: string,
	path: string,
	auth: { clientId: string; clientSecret: string; sandbox: boolean },
	body?: unknown,
): Promise<unknown> {
	const token = await getAccessToken(
		auth.clientId,
		auth.clientSecret,
		auth.sandbox,
	);
	const url = `${baseUrl(auth.sandbox)}${path}`;

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};

	const res = await fetch(url, {
		method,
		headers,
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	// Some PayPal endpoints return 204 No Content
	if (res.status === 204) return { success: true };

	const data = await res.json();
	if (!res.ok) {
		const msg =
			(data as { message?: string }).message ||
			JSON.stringify(data);
		throw new Error(`PayPal API error (${res.status}): ${msg}`);
	}
	return data;
}

// ─── Helper to extract properties ─────────────────────

function prop(properties: Record<string, unknown>, key: string): string {
	return (properties[key] as string) || "";
}

// ─── 1. Orders (One-Time Payments) ─────────────────────

export async function createOrder(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const currency = prop(properties, "currency") || "USD";
	const amount = prop(properties, "amount");
	const description = prop(properties, "description") || "";
	const returnUrl = prop(properties, "returnUrl") || "";
	const cancelUrl = prop(properties, "cancelUrl") || "";

	if (!amount) throw new Error("Missing required property: amount");

	const body: Record<string, unknown> = {
		intent: (prop(properties, "intent") || "CAPTURE").toUpperCase(),
		purchase_units: [
			{
				amount: { currency_code: currency, value: amount },
				...(description ? { description } : {}),
			},
		],
	};

	if (returnUrl || cancelUrl) {
		body.application_context = {
			...(returnUrl ? { return_url: returnUrl } : {}),
			...(cancelUrl ? { cancel_url: cancelUrl } : {}),
		};
	}

	return paypalRequest("POST", "/v2/checkout/orders", creds, body);
}

export async function captureOrder(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const orderId = prop(properties, "orderId");
	if (!orderId) throw new Error("Missing required property: orderId");
	return paypalRequest(
		"POST",
		`/v2/checkout/orders/${orderId}/capture`,
		creds,
		{},
	);
}

export async function getOrder(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const orderId = prop(properties, "orderId");
	if (!orderId) throw new Error("Missing required property: orderId");
	return paypalRequest("GET", `/v2/checkout/orders/${orderId}`, creds);
}

export async function authorizeOrder(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const orderId = prop(properties, "orderId");
	if (!orderId) throw new Error("Missing required property: orderId");
	return paypalRequest(
		"POST",
		`/v2/checkout/orders/${orderId}/authorize`,
		creds,
		{},
	);
}

// ─── 2. Subscriptions (Recurring Billing) ──────────────

export async function createPlan(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const productId = prop(properties, "productId");
	const name = prop(properties, "name");
	const intervalUnit = prop(properties, "intervalUnit") || "MONTH";
	const intervalCount = prop(properties, "intervalCount") || "1";
	const amount = prop(properties, "amount");
	const currency = prop(properties, "currency") || "USD";

	if (!productId) throw new Error("Missing required property: productId");
	if (!name) throw new Error("Missing required property: name");
	if (!amount) throw new Error("Missing required property: amount");

	return paypalRequest("POST", "/v1/billing/plans", creds, {
		product_id: productId,
		name,
		billing_cycles: [
			{
				frequency: {
					interval_unit: intervalUnit.toUpperCase(),
					interval_count: Number.parseInt(intervalCount, 10),
				},
				tenure_type: "REGULAR",
				sequence: 1,
				total_cycles: 0,
				pricing_scheme: {
					fixed_price: { value: amount, currency_code: currency },
				},
			},
		],
		payment_preferences: {
			auto_bill_outstanding: true,
			payment_failure_threshold: 3,
		},
	});
}

export async function listPlans(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const productId = prop(properties, "productId");
	const qs = productId ? `?product_id=${productId}` : "";
	return paypalRequest("GET", `/v1/billing/plans${qs}`, creds);
}

export async function createSubscription(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const planId = prop(properties, "planId");
	const returnUrl = prop(properties, "returnUrl") || "";
	const cancelUrl = prop(properties, "cancelUrl") || "";

	if (!planId) throw new Error("Missing required property: planId");

	const body: Record<string, unknown> = { plan_id: planId };
	if (returnUrl || cancelUrl) {
		body.application_context = {
			...(returnUrl ? { return_url: returnUrl } : {}),
			...(cancelUrl ? { cancel_url: cancelUrl } : {}),
		};
	}

	return paypalRequest("POST", "/v1/billing/subscriptions", creds, body);
}

export async function getSubscription(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const subscriptionId = prop(properties, "subscriptionId");
	if (!subscriptionId)
		throw new Error("Missing required property: subscriptionId");
	return paypalRequest(
		"GET",
		`/v1/billing/subscriptions/${subscriptionId}`,
		creds,
	);
}

export async function cancelSubscription(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const subscriptionId = prop(properties, "subscriptionId");
	const reason = prop(properties, "reason") || "Cancelled by user";
	if (!subscriptionId)
		throw new Error("Missing required property: subscriptionId");
	return paypalRequest(
		"POST",
		`/v1/billing/subscriptions/${subscriptionId}/cancel`,
		creds,
		{ reason },
	);
}

export async function suspendSubscription(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const subscriptionId = prop(properties, "subscriptionId");
	const reason = prop(properties, "reason") || "Suspended by user";
	if (!subscriptionId)
		throw new Error("Missing required property: subscriptionId");
	return paypalRequest(
		"POST",
		`/v1/billing/subscriptions/${subscriptionId}/suspend`,
		creds,
		{ reason },
	);
}

// ─── 3. Invoicing ──────────────────────────────────────

export async function createInvoice(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const recipientEmail = prop(properties, "recipientEmail");
	const itemName = prop(properties, "itemName") || "Service";
	const amount = prop(properties, "amount");
	const currency = prop(properties, "currency") || "USD";
	const quantity = prop(properties, "quantity") || "1";

	if (!recipientEmail)
		throw new Error("Missing required property: recipientEmail");
	if (!amount) throw new Error("Missing required property: amount");

	return paypalRequest("POST", "/v2/invoicing/invoices", creds, {
		detail: {
			currency_code: currency,
		},
		primary_recipients: [
			{
				billing_info: { email_address: recipientEmail },
			},
		],
		items: [
			{
				name: itemName,
				quantity,
				unit_amount: { currency_code: currency, value: amount },
			},
		],
	});
}

export async function sendInvoice(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const invoiceId = prop(properties, "invoiceId");
	if (!invoiceId) throw new Error("Missing required property: invoiceId");
	return paypalRequest(
		"POST",
		`/v2/invoicing/invoices/${invoiceId}/send`,
		creds,
		{
			send_to_recipient: true,
			send_to_invoicer: true,
		},
	);
}

export async function listInvoices(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const page = prop(properties, "page") || "1";
	const pageSize = prop(properties, "pageSize") || "20";
	return paypalRequest(
		"GET",
		`/v2/invoicing/invoices?page=${page}&page_size=${pageSize}`,
		creds,
	);
}

export async function getInvoice(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const invoiceId = prop(properties, "invoiceId");
	if (!invoiceId) throw new Error("Missing required property: invoiceId");
	return paypalRequest(
		"GET",
		`/v2/invoicing/invoices/${invoiceId}`,
		creds,
	);
}

// ─── 4. Payouts ────────────────────────────────────────

export async function createPayout(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const recipientEmail = prop(properties, "recipientEmail");
	const amount = prop(properties, "amount");
	const currency = prop(properties, "currency") || "USD";
	const note = prop(properties, "note") || "";
	const emailSubject = prop(properties, "emailSubject") || "You have a payout!";

	if (!recipientEmail)
		throw new Error("Missing required property: recipientEmail");
	if (!amount) throw new Error("Missing required property: amount");

	return paypalRequest("POST", "/v1/payments/payouts", creds, {
		sender_batch_header: {
			sender_batch_id: `batch_${Date.now()}`,
			email_subject: emailSubject,
		},
		items: [
			{
				recipient_type: "EMAIL",
				amount: { value: amount, currency },
				receiver: recipientEmail,
				...(note ? { note } : {}),
			},
		],
	});
}

export async function getPayoutBatch(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const batchId = prop(properties, "batchId");
	if (!batchId) throw new Error("Missing required property: batchId");
	return paypalRequest(
		"GET",
		`/v1/payments/payouts/${batchId}`,
		creds,
	);
}

export async function getPayoutItem(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const itemId = prop(properties, "itemId");
	if (!itemId) throw new Error("Missing required property: itemId");
	return paypalRequest(
		"GET",
		`/v1/payments/payouts-item/${itemId}`,
		creds,
	);
}

// ─── 5. Disputes ───────────────────────────────────────

export async function listDisputes(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const state = prop(properties, "state");
	const qs = state
		? `?dispute_state=${state.toUpperCase()}`
		: "";
	return paypalRequest(
		"GET",
		`/v1/customer/disputes${qs}`,
		creds,
	);
}

export async function getDispute(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const disputeId = prop(properties, "disputeId");
	if (!disputeId) throw new Error("Missing required property: disputeId");
	return paypalRequest(
		"GET",
		`/v1/customer/disputes/${disputeId}`,
		creds,
	);
}

export async function acceptDispute(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const disputeId = prop(properties, "disputeId");
	const note = prop(properties, "note") || "Accepting the claim";
	if (!disputeId) throw new Error("Missing required property: disputeId");
	return paypalRequest(
		"POST",
		`/v1/customer/disputes/${disputeId}/accept-claim`,
		creds,
		{ note },
	);
}

// ─── 6. Products (Catalog) ─────────────────────────────

export async function createProduct(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const name = prop(properties, "name");
	const productType = prop(properties, "productType") || "SERVICE";
	const description = prop(properties, "description") || "";
	const category = prop(properties, "category") || "";
	const imageUrl = prop(properties, "imageUrl") || "";
	const homeUrl = prop(properties, "homeUrl") || "";

	if (!name) throw new Error("Missing required property: name");

	return paypalRequest("POST", "/v1/catalogs/products", creds, {
		name,
		type: productType.toUpperCase(),
		...(description ? { description } : {}),
		...(category ? { category } : {}),
		...(imageUrl ? { image_url: imageUrl } : {}),
		...(homeUrl ? { home_url: homeUrl } : {}),
	});
}

export async function listProducts(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	const creds = resolveAuth(properties, auth);
	const page = prop(properties, "page") || "1";
	const pageSize = prop(properties, "pageSize") || "20";
	return paypalRequest(
		"GET",
		`/v1/catalogs/products?page=${page}&page_size=${pageSize}`,
		creds,
	);
}
