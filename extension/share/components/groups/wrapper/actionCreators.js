const ActionCreators = {
  setGroups: function(groups) {
    return {
      type: "GROUPS_RECEIVE",
      groups: groups,
    };
  },

  setGroupsLoadState: function(groupsLoadState, groupsLoadError="") {
    return {
      type: "GROUPS_LOAD_STATE_RECEIVE",
      groupsLoadState: groupsLoadState,
      groupsLoadError: groupsLoadError,
    };
  },

  setCurrentWindowId: function(currentWindowId) {
    return {
      type: "CURRENT_WINDOWS_ID_RECEIVE",
      currentWindowId: currentWindowId,
    };
  },

  setDelayedTask: function(delayedTasks) {
    return {
      type: "DELAYED_TASKS_RECEIVE",
      delayedTasks: delayedTasks,
    };
  },

  setOptions: function(options) {
    return {
      type: "OPTIONS_RECEIVE",
      options: options,
    };
  },
};

export default ActionCreators
