const BASE_URL = 'https://duocheck-leonx.onrender.com';

const request = (method, url, data = {}, isUpload = false) => {
  const token = wx.getStorageSync('token');
  const header = {};
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.reLaunch({ url: '/pages/auth/auth' });
          reject(new Error('未登录或登录已过期'));
          return;
        }
        const json = res.data;
        if (json && json.success) {
          resolve(json.data);
        } else {
          reject(new Error((json && json.error) || '请求失败'));
        }
      },
      fail: (err) => {
        reject(new Error('网络错误，请稍后重试'));
      }
    });
  });
};

const uploadFiles = (url, filePaths, formData = {}) => {
  const token = wx.getStorageSync('token');
  const header = {};
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    // WeChat upload is single file per task, we execute consecutively or via Promise.all
    const promises = filePaths.map((filePath, index) => {
      return new Promise((resUpload, rejUpload) => {
        wx.uploadFile({
          url: BASE_URL + url,
          filePath: filePath,
          name: 'images',
          formData: index === 0 ? formData : {}, // only attach goal_id/note to the first upload or merge backend side
          header: header,
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              if (data.success) {
                resUpload(data.data);
              } else {
                rejUpload(new Error(data.error || '上传失败'));
              }
            } catch (e) {
              rejUpload(new Error('解析失败'));
            }
          },
          fail: rejUpload
        });
      });
    });

    Promise.all(promises).then(resolve).catch(reject);
  });
};

module.exports = {
  request,
  uploadFiles,
  auth: {
    login: (username, password) => request('POST', '/api/auth/login', { username, password }),
    register: (username, password) => request('POST', '/api/auth/register', { username, password }),
    me: () => request('GET', '/api/auth/me')
  },
  goals: {
    list: () => request('GET', '/api/goals'),
    create: (title, description) => request('POST', '/api/goals', { title, description }),
    update: (id, data) => request('PUT', `/api/goals/${id}`, data),
    delete: (id) => request('DELETE', `/api/goals/${id}`)
  },
  partners: {
    list: () => request('GET', '/api/partners'),
    search: (q) => request('GET', `/api/users/search?q=${encodeURIComponent(q)}`),
    request: (to_user_id) => request('POST', '/api/partners/request', { to_user_id }),
    getRequests: () => request('GET', '/api/partners/requests'),
    respondRequest: (id, action) => request('PUT', `/api/partners/requests/${id}`, { action }),
    remove: (partnershipId) => request('DELETE', `/api/partners/${partnershipId}`)
  },
  checkins: {
    dashboard: () => request('GET', '/api/checkins/dashboard'),
    partnerToday: (partnerId) => request('GET', `/api/checkins/partner/${partnerId}/today`),
    verify: (id, verified_status, verify_comment) => request('PUT', `/api/checkins/${id}/verify`, { verified_status, verify_comment }),
    submitCheckin: (goal_id, note, filePaths) => {
      if (filePaths && filePaths.length > 0) {
        return uploadFiles('/api/checkins', filePaths, { goal_id, note });
      }
      // if no images, construct FormData payload or normal multipart
      return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');
        const header = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (token) header['Authorization'] = `Bearer ${token}`;
        
        wx.request({
          url: BASE_URL + '/api/checkins',
          method: 'POST',
          header: header,
          data: { goal_id, note },
          success: (res) => {
            const json = res.data;
            if (json && json.success) resolve(json.data);
            else reject(new Error((json && json.error) || '打卡提交失败'));
          },
          fail: reject
        });
      });
    }
  },
  messages: {
    list: (partnershipId) => request('GET', `/api/messages/${partnershipId}`),
    send: (partnershipId, content) => request('POST', `/api/messages/${partnershipId}`, { content })
  }
};
