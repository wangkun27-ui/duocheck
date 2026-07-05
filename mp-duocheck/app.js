App({
  onLaunch() {
    // Mini Program global launch logic
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/auth/auth' });
    }
  },
  globalData: {
    userInfo: null
  }
});
