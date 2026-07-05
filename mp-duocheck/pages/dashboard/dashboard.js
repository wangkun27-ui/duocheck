const api = require('../../utils/api.js');

Page({
  data: {
    user: {},
    streak: 0,
    todayGoals: [],
    dissolvedPartnerships: []
  },

  onShow() {
    this.loadDashboardData();
  },

  async loadDashboardData() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/auth/auth' });
      return;
    }

    try {
      const me = await api.auth.me();
      this.setData({ user: me.user });

      const data = await api.checkins.dashboard();
      this.setData({
        streak: data.streak || 0,
        todayGoals: data.today_goals || [],
        dissolvedPartnerships: data.dissolved_partnerships || []
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  gotoPage(e) {
    const page = e.currentTarget.dataset.page;
    if (page === 'goals' || page === 'partners' || page === 'checkin') {
      wx.navigateTo({ url: `/pages/${page}/${page}` });
    } else if (page === 'admin') {
      wx.navigateTo({ url: `/pages/admin/admin` });
    }
  },

  quickCheckin(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/checkin/checkin?goal_id=${id}` });
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.reLaunch({ url: '/pages/auth/auth' });
        }
      }
    });
  }
});
