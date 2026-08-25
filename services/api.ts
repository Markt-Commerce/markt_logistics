import {
  Assignment,
  AvailableRun,
  DeliveryFailureReason,
  DeliveryPartner,
  Location,
  LoginResponse,
  Order,
  RunDetail,
} from '../types';

const API_BASE_URL = 'https://test.api.marktcommerce.com/api/v1/deliveries';
const USE_MOCK = false;

const MOCK_PARTNERS: Record<string, DeliveryPartner> = {
  '9876543210': {
    id: 'partner_001',
    name: 'Rajesh Kumar',
    vehicleType: 'BIKE',
    rating: 4.8,
    status: 'ONLINE',
  },
  '9123456789': {
    id: 'partner_002',
    name: 'Priya Singh',
    vehicleType: 'SCOOTER',
    rating: 4.9,
    status: 'OFFLINE',
  },
  '8765432109': {
    id: 'partner_003',
    name: 'Amit Patel',
    vehicleType: 'CAR',
    rating: 4.7,
    status: 'OFFLINE',
  },
};

const MOCK_ORDERS: Order[] = [
  {
    orderId: 'ord_001',
    pickup: { lat: 28.7041, lng: 77.1025 },
    dropoff: { lat: 28.5244, lng: 77.1855 },
    distanceMeters: 15000,
    estimatedEarnings: 125,
  },
  {
    orderId: 'ord_002',
    pickup: { lat: 28.6139, lng: 77.209 },
    dropoff: { lat: 28.6245, lng: 77.2163 },
    distanceMeters: 8000,
    estimatedEarnings: 85,
  },
  {
    orderId: 'ord_003',
    pickup: { lat: 28.5355, lng: 77.391 },
    dropoff: { lat: 28.5244, lng: 77.1855 },
    distanceMeters: 20000,
    estimatedEarnings: 150,
  },
];

class ApiService {
  private sessionToken: string | null = null;

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  async sendOtp(phoneNumber: string): Promise<{ message: string; status: string }> {
    if (USE_MOCK) {
      return this.mockSendOtp(phoneNumber);
    }

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

  private async mockSendOtp(phoneNumber: string): Promise<{ message: string; status: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      message: '123456',
      status: 'success',
    };
  }

  async login(phone: string, otp: string): Promise<LoginResponse> {
    if (USE_MOCK) {
      return this.mockLogin(phone, otp);
    }

    console.log("Attempting login with phone:", phone, "and OTP:", otp);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp }),
      });

      const data = await response.json();
      this.sessionToken = data.sessionToken;
      return data;
    } catch (error) {
      console.error('login failed:', error);
      throw error;
    }
  }

  private async mockLogin(phone: string, otp: string): Promise<LoginResponse> {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (otp !== '123456') {
      throw new Error('Invalid OTP');
    }

    let partner = MOCK_PARTNERS[phone];
    if (!partner) {
      partner = {
        id: `partner_${phone}`,
        name: `Partner ${phone.slice(-4)}`,
        vehicleType: (['BIKE', 'SCOOTER', 'CAR'][Math.floor(Math.random() * 3)] as any),
        rating: 4.5 + Math.random(),
        status: 'OFFLINE',
      };
    }

    const sessionToken = `session_${phone}_${Date.now()}`;
    this.sessionToken = sessionToken;

    return {
      partner,
      sessionToken,
    };
  }

  async updatePartnerStatus(status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/delivery-partners/me/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      console.error('updatePartnerStatus failed:', error);
      throw error;
    }
  }

  async reportLocation(location: Location): Promise<void> {
    if (USE_MOCK) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/partners/me/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify(location),
      });
    } catch (error) {
      console.error('Failed to report location:', error);
    }
  }

  async getAvailableOrders(): Promise<Order[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return MOCK_ORDERS;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders/available`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data.orders;
    } catch (error) {
      console.error('getAvailableOrders failed:', error);
      throw error;
    }
  }

  async acceptOrder(orderId: string): Promise<Assignment> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const order = MOCK_ORDERS.find((o) => o.orderId === orderId);
      if (!order) throw new Error('Order not found');

      return {
        assignmentId: `as_${Date.now()}`,
        orderId,
        pickup: order.pickup,
        dropoff: order.dropoff,
        status: 'EN_ROUTE_TO_PICKUP',
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('acceptOrder failed:', error);
      throw error;
    }
  }

  async getActiveAssignment(): Promise<Assignment | null> {
    if (USE_MOCK) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/assignments/active`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data || null;
    } catch (error) {
      console.error('getActiveAssignment failed:', error);
      return null;
    }
  }

  async updateAssignmentStatus(
    assignmentId: string,
    status: string
  ): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/delivery/assignments/${assignmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      console.error('updateAssignmentStatus failed:', error);
      throw error;
    }
  }

  async generateQRToken(orderId: string): Promise<string> {
    if (USE_MOCK) {
      return `QR_${orderId}_${Date.now()}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/orders/${orderId}/qr`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('generateQRToken failed:', error);
      throw error;
    }
  }

  async confirmDelivery(orderId: string): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/delivery/orders/${orderId}/qr/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
    } catch (error) {
      console.error('confirmDelivery failed:', error);
      throw error;
    }
  }

  async getActiveAssignments(): Promise<any[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return [
        {
          assignmentId: 'as_001',
          orderId: 'ord_001',
          pickup: { lat: 28.7041, lng: 77.1025 },
          dropoff: { lat: 28.5244, lng: 77.1855 },
          distanceMeters: 15000,
          estimatedEarnings: 125,
          estimatedDuration: 25,
          status: 'in_transit',
          pickupAddress: 'Green Gourmet Market, West 4th St, Manhattan',
          deliveryAddress: 'Chelsea Gardens Apts, Bldg 4, Apt 12C',
          sellerName: 'Green Gourmet Market',
          buyerName: 'John Doe',
          qrToken: 'frpdha34390293'
        },
        {
          assignmentId: 'as_002',
          orderId: 'ord_002',
          pickup: { lat: 28.6139, lng: 77.209 },
          dropoff: { lat: 28.6245, lng: 77.2163 },
          distanceMeters: 8000,
          estimatedEarnings: 85,
          estimatedDuration: 12,
          status: 'picked_up',
          pickupAddress: 'Artisan Bakery & Co, Greenwich Ave',
          deliveryAddress: 'West Village Lofts, Floor 2, Door 201',
          sellerName: 'Artisan Bakery & Co',
          buyerName: 'Jane Smith',
          qrToken: 'frpdha34390294'
        },
      ];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/assignments/active`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data.assignments || [];
    } catch (error) {
      console.error('getActiveAssignments failed:', error);
      throw error;
    }
  }

  async getAssignmentDetails(assignmentId: string): Promise<any> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const assignments = await this.getActiveAssignments();
      return assignments.find((a) => a.assignmentId === assignmentId) || null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('getAssignmentDetails failed:', error);
      throw error;
    }
  }

  // --- Batched delivery runs (10.6-10.7) -------------------------------
  // Real target model -- see types/index.ts's own note. No USE_MOCK
  // branch for these (mock mode is off; adding parallel fake data for a
  // second delivery model wasn't worth the upkeep for this pass).

  private authHeaders() {
    return { Authorization: `Bearer ${this.sessionToken}` };
  }

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
}

const apiService = new ApiService();
export default apiService;
