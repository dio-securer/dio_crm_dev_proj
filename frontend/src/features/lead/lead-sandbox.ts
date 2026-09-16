import type { LeadSummary } from '@dio-crm/contracts';
import { createPublicId } from '../../account-sandbox';

const STORAGE_KEY = 'dio-crm:sandbox:global-leads';
let memoryStore: LeadSummary[] = [];

export type LeadQuickCreate = {
  hospitalName: string;
  country: string;
  phone: string;
  contactName?: string;
  address?: string;
  ownerName?: string;
};

function readAll(): LeadSummary[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LeadSummary[];
      if (Array.isArray(parsed)) {
        memoryStore = parsed;
        return parsed;
      }
    }
  } catch {
    // localStorage is unavailable in some test/SSR environments
  }
  return memoryStore;
}

function writeAll(rows: LeadSummary[]) {
  memoryStore = rows;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // keep the in-memory copy
  }
}

export function resetSandboxLeads() {
  memoryStore = [];
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function listSandboxLeads(search = ''): LeadSummary[] {
  const keyword = search.trim().toLocaleLowerCase();
  return readAll().filter(row => {
    if (!keyword) return true;
    return [row.hospital_name, row.phone ?? '', row.owner_name ?? '', row.business_no ?? '']
      .some(value => value.toLocaleLowerCase().includes(keyword));
  });
}

export function createSandboxLead(input: LeadQuickCreate): LeadSummary {
  const created: LeadSummary = {
    public_id: createPublicId(),
    hospital_name: input.hospitalName.trim(),
    status: 'NEW',
    owner_name: input.ownerName?.trim() || input.contactName?.trim() || null,
    phone: input.phone.trim(),
    address: input.address?.trim() || null,
    sido: input.country.trim() || null,
    sigungu: null,
    business_no: null
  };
  writeAll([created, ...readAll()]);
  return created;
}
