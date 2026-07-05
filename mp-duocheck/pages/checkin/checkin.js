const api = require('../../utils/api.js');

Page({
  data: {
    mode: 'checkin', // 'checkin' (self) or 'review' (partner)
    partnerId: null,
    goals: [],
    partnerGoals: [],
    notes: {},
    tempImages: {}, // mapping: goalId -> Array of local image paths
    verifyComments: {} // mapping: checkinId -> comment string
  },

  onLoad(options) {
    if (options.mode === 'review') {
      this.setData({
        mode: 'review',
        partnerId: options.partner_id
      });
      wx.setNavigationBarTitle({ title: '监督搭档今日动态' });
      this.loadPartnerCheckins();
    } else {
      const goalId = options.goal_id;
      wx.setNavigationBarTitle({ title: '每日目标打卡' });
      this.loadSelfGoals(goalId);
    }
  },

  async loadSelfGoals(focusGoalId) {
    try {
      const data = await api.checkins.dashboard();
      let goals = data.today_goals || [];
      if (focusGoalId) {
        // Sort focus goal to top
        goals.sort((a, b) => (a.id == focusGoalId ? -1 : b.id == focusGoalId ? 1 : 0));
      }
      this.setData({ goals });
    } catch (err) {
      wx.showToast({ title: err.message || '加载目标失败', icon: 'none' });
    }
  },

  async loadPartnerCheckins() {
    try {
      const data = await api.checkins.partnerToday(this.data.partnerId);
      this.setData({ partnerGoals: data.checkins || [] });
    } catch (err) {
      wx.showToast({ title: err.message || '加载搭档数据失败', icon: 'none' });
    }
  },

  onInputNote(e) {
    const id = e.currentTarget.dataset.id;
    const notes = { ...this.data.notes, [id]: e.detail.value };
    this.setData({ notes });
  },

  chooseImages(e) {
    const id = e.currentTarget.dataset.id;
    const currentImages = this.data.tempImages[id] || [];
    const count = 3 - currentImages.length;

    wx.chooseMedia({
      count: count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res.tempFiles.map(file => file.tempFilePath);
        const tempImages = {
          ...this.data.tempImages,
          [id]: [...currentImages, ...paths]
        };
        this.setData({ tempImages });
      }
    });
  },

  removeImage(e) {
    const goalId = e.currentTarget.dataset.goalId;
    const imgIndex = e.currentTarget.dataset.imgIndex;
    const currentImages = this.data.tempImages[goalId] || [];

    currentImages.splice(imgIndex, 1);
    const tempImages = { ...this.data.tempImages, [goalId]: currentImages };
    this.setData({ tempImages });
  },

  async submitCheckin(e) {
    const id = e.currentTarget.dataset.id;
    const note = this.data.notes[id] || '';
    const filePaths = this.data.tempImages[id] || [];

    wx.showLoading({ title: '提交打卡证明...' });

    try {
      await api.checkins.submitCheckin(id, note.trim(), filePaths);
      wx.hideLoading();
      wx.showToast({ title: '已成功打卡！', icon: 'success' });
      
      // Reset input state for goal
      const notes = { ...this.data.notes, [id]: '' };
      const tempImages = { ...this.data.tempImages, [id]: [] };
      this.setData({ notes, tempImages });

      this.loadSelfGoals();
    } catch (err) {
      wx.hideLoading();
      wx.showModal({ title: '打卡失败', content: err.message, showCancel: false });
    }
  },

  onInputComment(e) {
    const checkinId = e.currentTarget.dataset.checkinId;
    const verifyComments = { ...this.data.verifyComments, [checkinId]: e.detail.value };
    this.setData({ verifyComments });
  },

  async verifyCheckin(e) {
    const checkinId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const comment = this.data.verifyComments[checkinId] || '';

    try {
      await api.checkins.verify(checkinId, status, comment.trim());
      wx.showToast({ title: '审核已提交', icon: 'success' });
      this.loadPartnerCheckins();
    } catch (err) {
      wx.showToast({ title: err.message || '核验失败', icon: 'none' });
    }
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({ current, urls });
  }
});
