import {
  Assignment,
  AvailableRun,
  Bank,
  DeliveryFailureReason,
  DeliveryPartner,
  Location,
  LoginResponse,
  Order,
  Pagination,
  ResolvedBankAccount,
  RunDetail,
  WalletBalance,
  WalletTransaction,
  Withdrawal,
} from '../types';

const API_BASE_URL = 'https://test.api.marktcommerce.com/api/v1/deliveries';
// Not under /deliveries -- the wallet blueprint is a top-level resource
// shared with buyers/sellers (app/wallet/ in markt_python). A delivery
// partner's bearer token authenticates against it exactly the same way,
// since Flask-Login's user_loader resolves either a User or a
// DeliveryUser transparently. See REFACTOR_NOTES.md.
const WALLET_BASE_URL = 'https://test.api.marktcommerce.com/api/v1/wallet';

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
    pickup: firstLocation(raw.pickup),
    dropoff: raw.dropoff,
    status: raw.status,
  };
}

class ApiService {
  private sessionToken: string | null = null;

  setSessionToken(token: string) {
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
      return {
        id: data.id,
        name: data.name,
        vehicleType: data.vehicle_type,
        rating: data.rating,
        status: data.status === 'ACTIVE' ? 'ONLINE' : 'OFFLINE',
      };
    } catch (error) {
      console.error('getCurrentPartner failed:', error);
      throw error;
    }
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

  async acceptOrder(orderId: string): Promise<Assignment | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/accept`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
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
