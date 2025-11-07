const API_BASE = '/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Don't redirect on 401 for auth check - let the app handle it
      if (endpoint === '/auth/me' && error.message.includes('401')) {
        throw error;
      }
      if (error.message.includes('Invalid token') || error.message.includes('No token provided')) {
        this.setToken(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(email, password, name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async updateProfile(updates) {
    return this.request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Document endpoints
  async getDocuments() {
    return this.request('/documents');
  }

  async getDocument(id) {
    return this.request(`/documents/${id}`);
  }

  async createDocument(title) {
    return this.request('/documents', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async updateDocument(id, updates) {
    return this.request(`/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteDocument(id) {
    return this.request(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async shareDocument(id, email, role) {
    return this.request(`/documents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }
}

export default new ApiService();

