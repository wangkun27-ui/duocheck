/**
 * DuoCheck API 工具模块
 * 封装所有后端 API 请求，提供统一的请求方法和错误处理
 */
window.API = {
  BASE_URL: '',

  getToken() { return localStorage.getItem('duocheck_token'); },
  setToken(token) { localStorage.setItem('duocheck_token', token); },
  removeToken() { localStorage.removeItem('duocheck_token'); },

  async request(method, url, data = null, isFormData = false) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && data) headers['Content-Type'] = 'application/json';

    const config = { method, headers };
    if (data) config.body = isFormData ? data : JSON.stringify(data);

    try {
      const res = await fetch(this.BASE_URL + url, config);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '请求失败');
      return json.data;
    } catch (err) {
      if (err.message === '请求失败' || err.message) throw err;
      throw new Error('网络错误，请稍后重试');
    }
  },

  auth: {
    register: (data) => API.request('POST', '/api/auth/register', data),
    login: (data) => API.request('POST', '/api/auth/login', data),
    me: () => API.request('GET', '/api/auth/me'),
  },
  users: {
    search: (q) => API.request('GET', `/api/users/search?q=${encodeURIComponent(q)}`),
  },
  partners: {
    request: (data) => API.request('POST', '/api/partners/request', data),
    getRequests: () => API.request('GET', '/api/partners/requests'),
    respondRequest: (id, data) => API.request('PUT', `/api/partners/requests/${id}`, data),
    list: () => API.request('GET', '/api/partners'),
    remove: (id) => API.request('DELETE', `/api/partners/${id}`),
  },
  goals: {
    create: (data) => API.request('POST', '/api/goals', data),
    list: () => API.request('GET', '/api/goals'),
    partnerGoals: (userId) => API.request('GET', `/api/goals/partner/${userId}`),
    update: (id, data) => API.request('PUT', `/api/goals/${id}`, data),
    delete: (id) => API.request('DELETE', `/api/goals/${id}`),
  },
  checkins: {
    create: (formData) => API.request('POST', '/api/checkins', formData, true),
    list: (goalId, month) => API.request('GET', `/api/checkins?goal_id=${goalId}&month=${month}`),
    partnerToday: (partnerId) => API.request('GET', `/api/checkins/partner/${partnerId}/today`),
    verify: (id, data) => API.request('PUT', `/api/checkins/${id}/verify`, data),
    dashboard: () => API.request('GET', '/api/checkins/dashboard'),
  },
  admin: {
    stats: () => API.request('GET', '/api/admin/stats'),
    users: () => API.request('GET', '/api/admin/users'),
    checkins: () => API.request('GET', '/api/admin/checkins'),
    deleteCheckin: (id) => API.request('DELETE', `/api/admin/checkins/${id}`),
    goals: () => API.request('GET', '/api/admin/goals'),
    updateGoal: (id, data) => API.request('PUT', `/api/admin/goals/${id}`, data),
  },
  messages: {
    send: (partnershipId, data) => API.request('POST', `/api/messages/${partnershipId}`, data),
    list: (partnershipId) => API.request('GET', `/api/messages/${partnershipId}`),
  },
};
