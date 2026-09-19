import {
  Assignment,
  AvailableRun,
  Bank,
  DeliveryFailureReason,
  DeliveryPartner,
  Location,
  LoginResponse,
  Order,
  OrderOffer,
  Pagination,
  ResolvedBankAccount,
  RunDetail,
  WalletBalance,
  WalletTransaction,
  Withdrawal,
} from '../types';

// Source of truth: services/config.ts -- set EXPO_PUBLIC_API_URL per build.
import { API_BASE_URL, API_HOST } from './config';

// Not under /deliveries -- the wallet blueprint is a top-level resource
// shared with buyers/sellers (app/wallet/ in markt_python). A delivery
// partner's bearer token authenticates against it exactly the same way,
// since Flask-Login's user_loader resolves either a User or a
// DeliveryUser transparently. See REFACTOR_NOTES.md.
//
// Derived from API_HOST rather than written out, so a build pointed at a
// different backend takes the wallet with it.
const WALLET_BASE_URL = `${API_HOST}/api/v1/wallet`;

function normalizePagination(raw: any): Pagination {
  return {
    page: raw?.page ?? 1,
    perPage: raw?.per_page ?? 20,
    totalItems: raw?.total_items ?? 0,
    totalPages: raw?.total_pages ?? 0,
  };
}

function normalizeTransaction(raw: any): WalletTransaction {
  return {
    id: raw.id,
    type: raw.type,
    amount: raw.amount,
    balanceAfter: raw.balance_after,
    referenceType: raw.reference_type,
    referenceId: raw.reference_id,
    description: raw.description,
    createdAt: raw.created_at,
  };
}

function normalizeWithdrawal(raw: any): Withdrawal {
  return {
    id: raw.id,
    amount: raw.amount,
    currency: raw.currency,
    status: raw.status,
    accountName: raw.account_name,
    accountNumber: raw.account_number,
    paystackTransferRef: raw.paystack_transfer_ref,
    failureReason: raw.failure_reason,
    createdAt: raw.created_at,
  };
}

// --- Response normalizers -----------------------------------------------
// markt_python's schemas (app/deliveries/schemas.py) use snake_case keys
// and, for `pickup`, a LIST of locations (AvailableOrderSchema/
// ActiveAssignmentSchema -- an order/assignment can have more than one
// pickup stop), while this app's types use camelCase and a single
// {lat, lng}. These normalizers are the one place that translation
// happens so screens can keep using the existing Order/Assignment shapes.

function firstLocation(pickup: unknown): { lat: number; lng: number } {
  if (Array.isArray(pickup)) return pickup[0] ?? { lat: 0, lng: 0 };
  return (pickup as { lat: number; lng: number }) ?? { lat: 0, lng: 0 };
}

function normalizeOrder(raw: any): Order {
  return {
    orderId: raw.order_id,
    pickup: firstLocation(raw.pickup),
    dropoff: raw.dropoff,
    distanceMeters: raw.distance_meters,
    estimatedEarnings: raw.estimated_earnings,
  };
}

function normalizeAssignment(raw: any): Assignment {
  return {
    assignmentId: raw.assignment_id,
    orderId: raw.order_id,
    orderNumber: raw.order_number ?? null,
    pickup: firstLocation(raw.pickup),
    dropoff: raw.dropoff,
    status: raw.status,
    sellerName: raw.seller_name ?? null,
    pickupAddress: raw.pickup_address ?? null,
    sellerPhone: raw.seller_phone ?? null,
    buyerName: raw.buyer_name ?? null,
    dropoffAddress: raw.dropoff_address ?? null,
    buyerPhone: raw.buyer_phone ?? null,
  };
}

/** One shape for a partner, wherever it came from.
 *
 * getCurrentPartner and updatePartner both return one, and they used to
 * disagree: the first mapped snake_case to camelCase and dropped email,
 * phone and photo entirely, the second handed back the raw body. A profile
 * screen reading `profile_picture` off the first got undefined and showed
 * no picture however many had been uploaded. */
function normalizePartner(raw: any): DeliveryPartner {
  return {
    id: raw.id,
    name: raw.name,
    vehicleType: raw.vehicle_type,
    rating: raw.rating,
    status: raw.status === 'ACTIVE' ? 'ONLINE' : 'OFFLINE',
    email: raw.email ?? null,
    phone_number: raw.phone_number ?? null,
    profile_picture: raw.profile_picture ?? null,
  };
}

/** Someone else took it, or the hold ran out.
 *
 * Its own type so callers can tell "this order is gone" -- which happens
 * constantly and is nobody's fault -- apart from "the request failed",
 * which is worth logging and retrying. */
export class OrderTakenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderTakenError';
  }
}

class ApiService {
  private sessionToken: string | null = null;

  /** null clears it -- signing out must not leave the old token on the
   *  in-memory client, where the next request would still send it. */
  setSessionToken(token: string | null) {
    this.sessionToken = token;
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.sessionToken}` };
  }

  async sendOtp(phoneNumber: string): Promise<{ message: string; status: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('sendOtp failed:', error);
      throw error;
    }
  }

  async login(phone: string, otp: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.sessionToken = data.access_token;
      return data;
    } catch (error) {
      console.error('login failed:', error);
      throw error;
    }
  }

  /** GET /partners/me -- the login response (PartnerSchema) only ever
   * carries id/name/status; vehicle_type and rating are only returned
   * here (DeliveryDataResponseSchema). Call this after login/on app
   * start to fill those in. */
  async getCurrentPartner(): Promise<DeliveryPartner> {
    try {
      const response = await fetch(`${API_BASE_URL}/partners/me`, {
        headers: this.authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return normalizePartner(data);
    } catch (error) {
      console.error('getCurrentPartner failed:', error);
      throw error;
    }
  }

  /** Change the rider's own details. Name, email, vehicle -- not the
   *  phone number, which is the login credential. */
  async updatePartner(data: {
    name?: string;
    email?: string;
    vehicleType?: string;
  }): Promise<DeliveryPartner> {
    const response = await fetch(`${API_BASE_URL}/partners/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.vehicleType !== undefined
          ? { vehicle_type: data.vehicleType }
          : {}),
      }),
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(raw?.message || `Could not save (${response.status})`);
    }
    return normalizePartner(raw);
  }

  /** Upload the rider's photo. Multipart, field `file`. */
  async uploadProfilePhoto(uri: string): Promise<string | null> {
    const form = new FormData();
    const name = uri.split('/').pop() || 'photo.jpg';
    const extension = name.split('.').pop()?.toLowerCase() || 'jpg';
    form.append('file', {
      uri,
      name,
      type: extension === 'png' ? 'image/png' : 'image/jpeg',
    } as any);

    const response = await fetch(`${API_BASE_URL}/partners/me/photo`, {
      method: 'POST',
      // No Content-Type: fetch sets the multipart boundary itself, and
      // setting it by hand produces a body the server cannot parse.
      headers: this.authHeaders(),
      body: form,
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(raw?.message || `Could not upload (${response.status})`);
    }
    return raw.profile_picture ?? null;
  }

  async updatePartnerStatus(status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    // DeliveryStatusUpdateSchema only accepts ACTIVE/INACTIVE/SUSPENDED --
    // the app's own ONLINE/OFFLINE concept is a UI-level simplification.
    const backendStatus = status === 'ONLINE' ? 'ACTIVE' : 'INACTIVE';

    try {
      const response = await fetch(`${API_BASE_URL}/partners/me/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ status: backendStatus }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`);
      }
    } catch (error) {
      console.error('updatePartnerStatus failed:', error);
      throw error;
    }
  }

  async reportLocation(location: Location): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/partners/me/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        // DeliveryLocationRequestSchema requires lat/lng, not latitude/longitude.
        body: JSON.stringify({
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
        }),
      });
    } catch (error) {
      console.error('Failed to report location:', error);
    }
  }

  async getAvailableOrders(): Promise<Order[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/available`, {
        headers: this.authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return (data.orders || []).map(normalizeOrder);
    } catch (error) {
      console.error('getAvailableOrders failed:', error);
      throw error;
    }
  }

  /** Hold this order for this rider while they decide.
   *
   * The countdown on the accept card is only meaningful if the order is
   * really held for those seconds. The response carries the server's expiry
   * timestamp, and the app counts down to that rather than to a duration it
   * starts locally -- a phone's clock can be minutes out and is the rider's
   * to change.
   *
   * Throws OrderTakenError when someone else got there first, which is a
   * normal thing to happen and not an error worth a crash report.
   */
  async offerOrder(orderId: string): Promise<OrderOffer> {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/offer`, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      throw new OrderTakenError(data?.message || 'Someone else took this order');
    }
    if (!response.ok) {
      throw new Error(`Failed to hold order: ${response.status}`);
    }
    return {
      assignmentId: data.assignment_id,
      status: data.status,
      expiresAt: data.expires_at,
      seconds: data.seconds ?? 30,
    };
  }

  async acceptOrder(orderId: string): Promise<Assignment | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/accept`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
      if (response.status === 409) {
        // Another rider got there first, or this rider's hold ran out while
        // the screen was open. Normal, and the caller shows it as such.
        const data = await response.json().catch(() => ({}));
        throw new OrderTakenError(data?.message || 'Someone else took this order');
      }
      if (!response.ok) {
        throw new Error(`Failed to accept order: ${response.status}`);
      }
      // DeliveryOrderAcceptResponseSchema only returns {assignment_id,
      // status} -- fetch the full assignment (pickup/dropoff) from the
      // active-assignments list rather than assuming this response has it.
      const assignments = await this.getActiveAssignments();
      return assignments.find((a) => a.orderId === orderId) ?? null;
    } catch (error) {
      console.error('acceptOrder failed:', error);
      throw error;
    }
  }

  async rejectOrder(orderId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/reject`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to reject order: ${response.status}`);
      }
    } catch (error) {
      console.error('rejectOrder failed:', error);
      throw error;
    }
  }

  async getActiveAssignments(): Promise<Assignment[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/assignments/active`, {
        headers: this.authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return (data.assignments || []).map(normalizeAssignment);
    } catch (error) {
      console.error('getActiveAssignments failed:', error);
      throw error;
    }
  }

  /** The backend has no GET for a single assignment or a single active
   * assignment -- only the list (`GET /assignments/active`) and the
   * write-only `PATCH /assignments/<id>/status`. Both singular helpers
   * below are derived from that list until a real detail route exists
   * (see REFACTOR_NOTES.md). */
  async getActiveAssignment(): Promise<Assignment | null> {
    try {
      const assignments = await this.getActiveAssignments();
      return assignments[0] ?? null;
    } catch (error) {
      console.error('getActiveAssignment failed:', error);
      return null;
    }
  }

  async getAssignmentDetails(assignmentId: string): Promise<Assignment | null> {
    try {
      const assignments = await this.getActiveAssignments();
      return assignments.find((a) => a.assignmentId === assignmentId) ?? null;
    } catch (error) {
      console.error('getAssignmentDetails failed:', error);
      throw error;
    }
  }

  async updateAssignmentStatus(
    assignmentId: string,
    status: string
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update assignment status: ${response.status}`);
      }
    } catch (error) {
      console.error('updateAssignmentStatus failed:', error);
      throw error;
    }
  }

  // Note: GET /orders/<id>/qr ("get QR code for order escrow release")
  // issues the code the BUYER's app displays -- it's markt_mobile's
  // concern, not this rider app's, so there's no wrapper for it here.
  // The rider only ever consumes that code via confirmDelivery below
  // (mirrors the batch flow's pod-scan.tsx: buyer shows the code, rider
  // reads/enters it).

  async confirmDelivery(orderId: string, qrCode: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/qr/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ order_id: orderId, qr_code: qrCode }),
      });
      if (!response.ok) {
        throw new Error(`Failed to confirm delivery: ${response.status}`);
      }
    } catch (error) {
      console.error('confirmDelivery failed:', error);
      throw error;
    }
  }

  // --- Batched delivery runs (10.6-10.7) -------------------------------
  // The second permanent delivery option alongside the single-order flow
  // above (buyers choose one or the other at checkout; see
  // REFACTOR_NOTES.md) -- both are live and neither is going away.

  async getAvailableRuns(searchRadius = 5000): Promise<AvailableRun[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/runs/available?search_radius=${searchRadius}`,
        { headers: this.authHeaders() }
      );
      const data = await response.json();
      return data.runs || [];
    } catch (error) {
      console.error('getAvailableRuns failed:', error);
      throw error;
    }
  }

  async getActiveRun(): Promise<RunDetail> {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/active`, {
        headers: this.authHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('getActiveRun failed:', error);
      return { run_id: null, stops: [], orders: [] };
    }
  }

  async getRunDetail(runId: string): Promise<RunDetail> {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${runId}`, {
        headers: this.authHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('getRunDetail failed:', error);
      throw error;
    }
  }

  async acceptRun(runId: string): Promise<{ run_id: string; status: string; assignment_id: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${runId}/accept`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to accept run');
      return data;
    } catch (error) {
      console.error('acceptRun failed:', error);
      throw error;
    }
  }

  async rejectRun(runId: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/runs/${runId}/reject`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
    } catch (error) {
      console.error('rejectRun failed:', error);
      throw error;
    }
  }

  async failRun(runId: string, reason?: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/runs/${runId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      console.error('failRun failed:', error);
      throw error;
    }
  }

  async arriveAtStop(runId: string, sellerId: number): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/runs/${runId}/stops/${sellerId}/arrive`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
    } catch (error) {
      console.error('arriveAtStop failed:', error);
      throw error;
    }
  }

  async confirmPickupAtStop(runId: string, sellerId: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${runId}/stops/${sellerId}/pickup`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to confirm pickup');
    } catch (error) {
      console.error('confirmPickupAtStop failed:', error);
      throw error;
    }
  }

  async confirmRunOrderPod(runId: string, orderId: string, qrCode: string): Promise<{ run_completed: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${runId}/orders/${orderId}/pod-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ qr_code: qrCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Invalid code');
      return data;
    } catch (error) {
      console.error('confirmRunOrderPod failed:', error);
      throw error;
    }
  }

  async reportDeliveryFailure(
    runId: string,
    orderId: string,
    reason: DeliveryFailureReason,
    notes?: string
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${runId}/orders/${orderId}/report-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ reason, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to report failure');
    } catch (error) {
      console.error('reportDeliveryFailure failed:', error);
      throw error;
    }
  }

  /** Register this device for push.
   *
   * The endpoint is shared with the shopper app -- the backend files the
   * token against whoever the session belongs to, which for this app is the
   * rider. Never throws: a rider who cannot be pushed to can still work, and
   * failing sign-in over it would be worse than missing a notification. */
  async registerPushToken(token: string, platform: string): Promise<void> {
    try {
      await fetch(`${API_HOST}/api/v1/notifications/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ token, platform }),
      });
    } catch (error) {
      console.warn('registerPushToken failed:', error);
    }
  }

  /** Stop pushing to this device, on sign-out. */
  async removePushToken(token: string): Promise<void> {
    try {
      await fetch(`${API_HOST}/api/v1/notifications/push-token`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.warn('removePushToken failed:', error);
    }
  }

  // --- Wallet / payout ---------------------------------------------------

  async getWalletBalance(): Promise<WalletBalance> {
    try {
      const response = await fetch(`${WALLET_BASE_URL}/`, { headers: this.authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to load wallet balance (${response.status})`);
      return { currency: data.currency, availableBalance: data.available_balance };
    } catch (error) {
      console.error('getWalletBalance failed:', error);
      throw error;
    }
  }

  async getWalletTransactions(page = 1, perPage = 20): Promise<{ transactions: WalletTransaction[]; pagination: Pagination }> {
    try {
      const response = await fetch(`${WALLET_BASE_URL}/transactions?page=${page}&per_page=${perPage}`, {
        headers: this.authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to load wallet transactions (${response.status})`);
      return {
        transactions: (data.transactions || []).map(normalizeTransaction),
        pagination: normalizePagination(data.pagination),
      };
    } catch (error) {
      console.error('getWalletTransactions failed:', error);
      throw error;
    }
  }

  async getBanks(): Promise<Bank[]> {
    try {
      const response = await fetch(`${WALLET_BASE_URL}/banks`, { headers: this.authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to load banks (${response.status})`);
      return data.banks || [];
    } catch (error) {
      console.error('getBanks failed:', error);
      throw error;
    }
  }

  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<ResolvedBankAccount> {
    try {
      const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
      const response = await fetch(`${WALLET_BASE_URL}/banks/resolve?${query.toString()}`, {
        headers: this.authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to resolve account');
      return {
        accountNumber: data.account_number,
        accountName: data.account_name,
        bankCode: data.bank_code,
        resolved: data.resolved,
      };
    } catch (error) {
      console.error('resolveBankAccount failed:', error);
      throw error;
    }
  }

  async requestWithdrawal(data: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
  }): Promise<Withdrawal> {
    try {
      const response = await fetch(`${WALLET_BASE_URL}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          amount: data.amount,
          bank_code: data.bankCode,
          account_number: data.accountNumber,
          account_name: data.accountName,
        }),
      });
      const raw = await response.json();
      if (!response.ok) throw new Error(raw.message || 'Failed to request withdrawal');
      return normalizeWithdrawal(raw);
    } catch (error) {
      console.error('requestWithdrawal failed:', error);
      throw error;
    }
  }

  async getWithdrawals(page = 1, perPage = 20): Promise<{ withdrawals: Withdrawal[]; pagination: Pagination }> {
    try {
      const response = await fetch(`${WALLET_BASE_URL}/withdrawals?page=${page}&per_page=${perPage}`, {
        headers: this.authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to load withdrawals (${response.status})`);
      return {
        withdrawals: (data.withdrawals || []).map(normalizeWithdrawal),
        pagination: normalizePagination(data.pagination),
      };
    } catch (error) {
      console.error('getWithdrawals failed:', error);
      throw error;
    }
  }
}

const apiService = new ApiService();
export default apiService;
