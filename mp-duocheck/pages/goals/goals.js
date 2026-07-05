const api = require('../../utils/api.js');

Page({
  data: {
    goals: [],
    showModal: false,
    modalType: 'add', // 'add' or 'edit'
    selectedGoalId: null,
    goalTitle: '',
    goalDesc: ''
  },

  onShow() {
    this.loadGoals();
  },

  async loadGoals() {
    try {
      const data = await api.goals.list();
      this.setData({ goals: data.goals || [] });
    } catch (err) {
      wx.showToast({ title: err.message || '加载目标失败', icon: 'none' });
    }
  },

  showAddModal() {
    this.setData({
      showModal: true,
      modalType: 'add',
      selectedGoalId: null,
      goalTitle: '',
      goalDesc: ''
    });
  },

  showEditModal(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true,
      modalType: 'edit',
      selectedGoalId: item.id,
      goalTitle: item.title,
      goalDesc: item.description || ''
    });
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  onInputTitle(e) {
    this.setData({ goalTitle: e.detail.value });
  },

  onInputDesc(e) {
    this.setData({ goalDesc: e.detail.value });
  },

  async saveGoal() {
    const { modalType, selectedGoalId, goalTitle, goalDesc } = this.data;
    if (!goalTitle.trim()) {
      wx.showToast({ title: '请输入目标标题', icon: 'none' });
      return;
    }

    try {
      if (modalType === 'add') {
        await api.goals.create(goalTitle.trim(), goalDesc.trim());
        wx.showToast({ title: '目标已创建', icon: 'success' });
      } else {
        await api.goals.update(selectedGoalId, {
          title: goalTitle.trim(),
          description: goalDesc.trim()
        });
        wx.showToast({ title: '目标已更新', icon: 'success' });
      }
      this.setData({ showModal: false });
      this.loadGoals();
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';

    try {
      await api.goals.update(id, { status: newStatus });
      wx.showToast({ title: newStatus === 'paused' ? '已暂停' : '已恢复', icon: 'success' });
      this.loadGoals();
    } catch (err) {
      wx.showToast({ title: err.message || '更新失败', icon: 'none' });
    }
  },

  async deleteGoal(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.goals.delete(id);
      wx.showToast({ title: '已成功删除目标', icon: 'success' });
      this.loadGoals();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  }
});
