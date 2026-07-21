import DelayedTaskManager from './delayedtaskmanager'
import RepeatedTaskManager from './repeatedtaskmanager'

const TaskManager = {
  DelayedTask: DelayedTaskManager,
  RepeatedTask: RepeatedTaskManager,
}
globalThis.TaskManager = TaskManager;

export default TaskManager
