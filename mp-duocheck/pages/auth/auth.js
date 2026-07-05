const api = require('../../utils/api.js');

Page({
  data: {
    isLogin: true,
    username: '',
    password: ''
  },

  onLoad() {
    const token = wx.getStorageSync('token');
    if (token) {
      wx.switchTab({ url: '/pages/dashboard/dashboard' });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      isLogin: tab === 'login',
      username: '',
      password: ''
    });
  },

  onInputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async onSubmit() {
    const { username, password, isLogin } = this.data;
    if (!username.trim() || !password) {
      wx.showToast({ title: '请填写用户名和密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: isLogin ? '登录中...' : '注册中...' });

    try {
      let data;
      if (isLogin) {
        data = await api.auth.login(username.trim(), password);
      } else {
        data = await api.auth.register(username.trim(), password);
      }

      wx.hideLoading();
      wx.setStorageSync('token', data.token);
      wx.setStorageSync('user', data.user);

      wx.showToast({
        title: isLogin ? '登录成功' : '注册成功',
        icon: 'success',
        duration: 1000
      });

      setTimeout(() => {
        wx.reLaunch({ url: '/pages/dashboard/dashboard' });
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      wx.showModal({
        title: '提示',
        content: err.message || '操作失败',
        showCancel: false
      });
    }
  }
});
