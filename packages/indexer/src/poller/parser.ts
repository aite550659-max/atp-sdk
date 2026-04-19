import {
  hcsMessageSchema,
  agentInitializationSchema,
  agentCreatedSchema,
  openclawActionSchema,
  agentTransactionSchema,
  rentalInitiatedSchema,
  rentalCompletedSchema,
  agentCommsSchema,
  type HCSMessage,
  type MirrorNodeMessage,
} from '../types/hcs.js';

export interface ParsedMessage {
  raw: MirrorNodeMessage;
  decoded: unknown;
  validated: HCSMessage | null;
  messageType: string | null;
  error?: string;
}

export function decodeBase64Message(base64: string): unknown {
  try {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function toEpochTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeATPEnvelope(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const obj = data as Record<string, unknown>;
  const messageType = typeof obj.message_type === 'string' ? obj.message_type : null;
  const atpVersion = typeof obj.atp_version === 'string' ? obj.atp_version : null;
  const agentId = typeof obj.agent_id === 'string' ? obj.agent_id : undefined;
  const payload = (obj.payload ?? obj.data) as Record<string, unknown> | undefined;

  if (!messageType || !atpVersion || !payload) {
    return data;
  }

  const timestamp = toEpochTimestamp(obj.timestamp);

  if (messageType === 'agent_created') {
    return {
      version: atpVersion,
      type: 'agent_created',
      agentId: agentId ?? '',
      agentName: typeof payload.name === 'string' ? payload.name : (agentId ?? 'unknown-agent'),
      platform: typeof payload.platform === 'string' ? payload.platform : 'ATP',
      timestamp,
      metadata: payload,
    };
  }

  if (messageType === 'rental_initiated') {
    return {
      version: atpVersion,
      type: 'rental_initiated',
      agentId: agentId ?? '',
      rentalId: typeof payload.rental_id === 'string' ? payload.rental_id : '',
      renter: typeof payload.renter === 'string' ? payload.renter : '',
      escrowAccount: typeof payload.escrow_account === 'string' ? payload.escrow_account : '',
      stakeUsd: toNumber(payload.stake_usd),
      bufferUsd: toNumber(payload.usage_buffer_usd ?? payload.buffer_usd),
      timestamp,
    };
  }

  if (messageType === 'rental_completed') {
    const settlement = (payload.settlement ?? {}) as Record<string, unknown>;
    return {
      version: atpVersion,
      type: 'rental_completed',
      rentalId: typeof payload.rental_id === 'string' ? payload.rental_id : '',
      totalCostUsd: toNumber(payload.total_cost_usd ?? payload.total_cost),
      settlement: {
        owner: toNumber(settlement.owner),
        creator: toNumber(settlement.creator),
        network: toNumber(settlement.network),
        treasury: toNumber(settlement.treasury),
      },
      timestamp,
    };
  }

  return data;
}

export function classifyMessageType(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.type === 'string') {
    return obj.type;
  }

  if (typeof obj.message_type === 'string') {
    return obj.message_type;
  }

  if ('from' in obj && 'text' in obj && 'timestamp' in obj) {
    return 'agent_comms';
  }

  return 'unknown';
}

export function validateMessage(data: unknown): HCSMessage | null {
  const normalized = normalizeATPEnvelope(data);

  try {
    return hcsMessageSchema.parse(normalized);
  } catch {
    const schemas = [
      agentInitializationSchema,
      agentCreatedSchema,
      openclawActionSchema,
      agentTransactionSchema,
      rentalInitiatedSchema,
      rentalCompletedSchema,
      agentCommsSchema,
    ];

    for (const schema of schemas) {
      try {
        return schema.parse(normalized) as HCSMessage;
      } catch {
        continue;
      }
    }

    return null;
  }
}

export function parseMessage(message: MirrorNodeMessage): ParsedMessage {
  const decoded = decodeBase64Message(message.message);

  if (!decoded) {
    return {
      raw: message,
      decoded: null,
      validated: null,
      messageType: null,
      error: 'Failed to decode base64 message',
    };
  }

  const messageType = classifyMessageType(decoded);
  const validated = validateMessage(decoded);

  return {
    raw: message,
    decoded,
    validated,
    messageType,
    error: validated ? undefined : 'Message failed validation',
  };
}
