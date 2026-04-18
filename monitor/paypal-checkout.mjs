/**
 * PayPal Checkout Module — ATP Fiat Payment Rail
 *
 * Creates PayPal/Venmo orders via the Orders v2 REST API,
 * captures payments, and triggers the HBAR conversion + rental activation flow.
 *
 * Supports:
 *   - PayPal (card, bank, PayPal balance)
 *   - Venmo (via PayPal's Venmo payment_source)
 *
 * Auth: PayPal client_id + client_secret stored in macOS Keychain
 *   security add-generic-password -s paypal-client-id -a atp -w "<client-id>"
 *   security add-generic-password -s paypal-client-secret -a atp -w "<client-secret>"
 *
 * Environment:
 *   PAYPAL_MODE=sandbox|live (default: sandbox)
 *   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (override Keychain)
 *   ATP_PAYPAL_RETURN_URL (where renter is sent after approval)
 *   ATP_PAYPAL_CANCEL_URL (where renter is sent on cancel)
 */

import { execSync } from 'node:child_process';

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const BASE_URL = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const DEFAULT_RETURN_URL = process.env.ATP_PAYPAL_RETURN_URL || 'https://atp.example.com/paypal/return';
const DEFAULT_CANCEL_URL = process.env.ATP_PAYPAL_CANCEL_URL || 'https://atp.example.com/paypal/cancel';

// ── Auth ────────────────────────────────────────────────────────────────────

function loadFromKeychain(service) {
  try {
    return execSync(`security find-generic-password -s ${service} -w`, { encoding: 'utf8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function getClientId() {
  return process.env.PAYPAL_CLIENT_ID || loadFromKeychain('paypal-client-id');
}

function getClientSecret() {
  return process.env.PAYPAL_CLIENT_SECRET || loadFromKeychain('paypal-client-secret');
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured. Set PAYPAL_CLIENT_ID/SECRET env vars or add to Keychain.');
  }

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`PayPal auth failed: ${data.error_description || data.error || res.status}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
  return cachedToken;
}

// ── API Helpers ─────────────────────────────────────────────────────────────

async function paypalRequest(method, path, body = null) {
  const token = await getAccessToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.details?.[0]?.description || data?.message || `HTTP ${res.status}`;
    throw new Error(`PayPal ${method} ${path}: ${msg}`);
  }
  return data;
}

// ── Order Management ────────────────────────────────────────────────────────

/**
 * Create a PayPal/Venmo checkout order.
 *
 * @param {Object} opts
 * @param {number} opts.amount - USD amount
 * @param {string} opts.fundingSource - 'paypal' | 'venmo'
 * @param {string} opts.description - Order description shown to buyer
 * @param {string} opts.referenceId - Internal reference (funding intent ID)
 * @param {string} [opts.returnUrl] - Redirect after approval
 * @param {string} [opts.cancelUrl] - Redirect on cancel
 * @returns {{ orderId, approvalUrl, status }}
 */
export async function createOrder({
  amount,
  fundingSource = 'paypal',
  description = 'ATP Agent Rental',
  referenceId,
  returnUrl = DEFAULT_RETURN_URL,
  cancelUrl = DEFAULT_CANCEL_URL,
}) {
  const paymentSource = fundingSource === 'venmo'
    ? {
        venmo: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      }
    : {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      };

  const order = await paypalRequest('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: referenceId || undefined,
        description,
        amount: {
          currency_code: 'USD',
          value: Number(amount).toFixed(2),
        },
      },
    ],
    payment_source: paymentSource,
  });

  const approvalLink = order.links?.find(l => l.rel === 'payer-action');
  return {
    orderId: order.id,
    status: order.status,
    approvalUrl: approvalLink?.href || null,
    raw: order,
  };
}

/**
 * Get order details.
 */
export async function getOrder(orderId) {
  return await paypalRequest('GET', `/v2/checkout/orders/${orderId}`);
}

/**
 * Capture a previously approved order.
 * Call this after the renter approves on PayPal/Venmo.
 *
 * @returns {{ captureId, status, amount, payerEmail }}
 */
export async function captureOrder(orderId) {
  const data = await paypalRequest('POST', `/v2/checkout/orders/${orderId}/capture`, {});

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  const payer = data.payer || data.payment_source?.paypal || data.payment_source?.venmo;

  return {
    orderId: data.id,
    status: data.status,
    captureId: capture?.id || null,
    captureStatus: capture?.status || null,
    amount: capture?.amount?.value ? Number(capture.amount.value) : null,
    currency: capture?.amount?.currency_code || 'USD',
    payerEmail: payer?.email_address || null,
    payerName: payer?.name ? `${payer.name.given_name || ''} ${payer.name.surname || ''}`.trim() : null,
    fundingSource: data.payment_source?.venmo ? 'venmo' : 'paypal',
    raw: data,
  };
}

/**
 * Check if PayPal credentials are configured.
 */
export function isConfigured() {
  return !!(getClientId() && getClientSecret());
}

/**
 * Get current mode (sandbox/live).
 */
export function getMode() {
  return PAYPAL_MODE;
}
